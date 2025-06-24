import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import jwt from "jsonwebtoken";

const EMAIL_DOMAINS = process.env.EMAIL_DOMAINS.split(',');
const JWT_SECRET = process.env.JWT_SECRET;
const TABLE_NAME = process.env.TABLE_NAME;

const dynamodb = new DynamoDBClient({});

function generateRandomString() {
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export const handler = async (event) => {
    if (!EMAIL_DOMAINS.length) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "EMAIL_DOMAINS not configured" }),
        };
    }

    let email = "";
    let isUnique = false;
    const maxAttempts = 10;
    let attempts = 0;

    while (!isUnique && attempts < maxAttempts) {
        const randomDomain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
        const randomString = generateRandomString();
        email = `${randomString}@${randomDomain}`;

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
