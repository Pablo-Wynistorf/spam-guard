import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const TABLE_NAME = process.env.TABLE_NAME;

const dynamodb = new DynamoDBClient({});

function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
        const [key, ...val] = part.trim().split('=');
        acc[key] = decodeURIComponent(val.join('='));
        return acc;
    }, {});
}

export const handler = async (event) => {
    const headers = event.headers || {};
    const cookies = parseCookies(headers.Cookie || headers.cookie);
    const token = cookies['email_session'];

    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Missing authentication token' }),
        };
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid or expired token' }),
        };
    }

    const email = decoded.email.toLowerCase();

    try {
        const result = await dynamodb.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': { S: email },
            },
        }));

        const emails = (result.Items || [])
            .map(item => ({
                emailId: item.emailId?.S,
                subject: item.subject?.S,
                sender: item.sender?.S,
                date: item.date?.S,
                s3Key: item.s3Key?.S,
            }))
            .filter(email => email.emailId !== "Session");

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emails }),
        };
    } catch (err) {
        console.error('DynamoDB query error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
