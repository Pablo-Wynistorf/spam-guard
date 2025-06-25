import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
    SESClient,
    DescribeReceiptRuleCommand,
    UpdateReceiptRuleCommand
} from "@aws-sdk/client-ses";
import jwt from "jsonwebtoken";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;
const JWT_SECRET = process.env.JWT_SECRET;
const TABLE_NAME = process.env.TABLE_NAME;
const SES_RULE_SET_NAME = process.env.SES_RULE_SET_NAME;
const SES_RULE_NAME = process.env.SES_RULE_NAME;

const dynamodb = new DynamoDBClient({});
const ses = new SESClient({});

function generateRandomString() {
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function addEmailToSesRule(newEmail) {
    try {
        const { Rule } = await ses.send(new DescribeReceiptRuleCommand({
            RuleSetName: SES_RULE_SET_NAME,
            RuleName: SES_RULE_NAME
        }));

        if (!Rule) throw new Error("SES rule not found");

        const existingRecipients = Rule.Recipients || [];
        if (existingRecipients.includes(newEmail)) return;

        const updatedRule = {
            ...Rule,
            Recipients: [...existingRecipients, newEmail]
        };

        await ses.send(new UpdateReceiptRuleCommand({
            RuleSetName: SES_RULE_SET_NAME,
            Rule: updatedRule
        }));

        console.log(`Added ${newEmail} to SES recipient rule.`);
    } catch (err) {
        console.error("Failed to update SES rule:", err);
        throw err;
    }
}

export const handler = async (event) => {
    if (!EMAIL_DOMAIN?.length) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "EMAIL_DOMAIN not configured" }),
        };
    }

    let email = "";
    let isUnique = false;
    const maxAttempts = 10;
    let attempts = 0;

    while (!isUnique && attempts < maxAttempts) {
        const randomString = generateRandomString();
        email = `${randomString}@${EMAIL_DOMAIN}`;

        try {
            const { Items } = await dynamodb.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "email = :email",
                ExpressionAttributeValues: {
                    ":email": { S: email }
                },
                Limit: 1
            }));

            if (!Items || Items.length === 0) {
                isUnique = true;
            } else {
                attempts++;
            }
        } catch (err) {
            console.error("DynamoDB error:", err);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Internal server error" }),
            };
        }
    }

    if (!isUnique) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Could not generate a unique email" }),
        };
    }

    try {
        await addEmailToSesRule(email);
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to update SES rule" }),
        };
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "20m" });

    const headers = {
        "Set-Cookie": `email_session=${token}; Max-Age=1200; Path=/; SameSite=Lax`,
        "Content-Type": "application/json",
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Email session created successfully", email }),
    };
};
