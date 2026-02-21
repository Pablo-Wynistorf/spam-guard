import { DynamoDBClient, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import jwt from "jsonwebtoken";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;
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

export const handler = async () => {
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
        ExpressionAttributeValues: { ":email": { S: email } },
        Limit: 1,
      }));
      if (!Items || Items.length === 0) break;
    } catch (err) {
      console.error("DynamoDB error:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  }

  const ttl = Math.floor(Date.now() / 1000) + 15 * 60;
  try {
    await dynamodb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        email: { S: email },
        emailId: { S: "Session" },
        createdAt: { N: Date.now().toString() },
        ttl: { N: ttl.toString() },
      },
    }));
  } catch (err) {
    console.error("DynamoDB error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to store email in database" }),
    };
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "15m" });

  return {
    statusCode: 200,
    headers: {
      "Set-Cookie": `email_session=${token}; Max-Age=900; Path=/; SameSite=Lax`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "Email session created successfully" }),
  };
};
