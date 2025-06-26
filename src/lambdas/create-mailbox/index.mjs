import { DynamoDBClient, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
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
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to update SES rule" }),
        };
    }
}

async function addEmailToDynamoDB(email) {
    const ttl = Math.floor(Date.now() / 1000) + 15 * 60;
    const params = {
        TableName: TABLE_NAME,
        Item: {
            email: { S: email },
            emailId: { S: "Session" },
            createdAt: { N: Date.now().toString() },
            ttl: { N: ttl.toString() }
        }
    };

    try {
        await dynamodb.send(new PutItemCommand(params));
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to store email in database" }),
        };
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

    while (true) {
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
                break;
            }
        } catch (err) {
            console.error("DynamoDB error:", err);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Internal server error" }),
            };
        }
    }


    try {
        await addEmailToSesRule(email);
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to update email rule" }),
        };
    }

    try {
        await addEmailToDynamoDB(email);
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to store email in database" }),
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
        body: JSON.stringify({ message: "Email session created successfully" }),
    };
};
