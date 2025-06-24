import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { simpleParser } from "mailparser";
import { uuidv4 } from "uuid";

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});

const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET;
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
  try {
    const snsMessage = event.Records?.[0]?.Sns?.Message;
    if (!snsMessage) throw new Error("Missing SNS message");

    const notification = JSON.parse(snsMessage);
    const mail = notification.mail || {};
    const rawMime = notification.content;
    
    const messageId = uuidv4();

    const parsedEmail = await simpleParser(Buffer.from(rawMime, "base64"));

    const htmlBody = parsedEmail.html
      ? typeof parsedEmail.html === "string"
        ? parsedEmail.html
        : parsedEmail.html.toString()
      : parsedEmail.textAsHtml || `<pre>${escapeHtml(parsedEmail.text || "[No readable content]")}</pre>`;

    const key = `emails/${messageId}.html`;

    await s3.send(new PutObjectCommand({
      Bucket: EMAIL_STORAGE_BUCKET,
      Key: key,
      Body: wrapHtml(htmlBody),
      ContentType: "text/html",
    }));

    const ttl = Math.floor(Date.now() / 1000) + 15 * 60;

    await dynamodb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        email:  { S: mail.destination?.[0] },
        emailId: { S: messageId },
        subject:  { S: parsedEmail.subject || "(No Subject)" },
        sender:   { S: parsedEmail.from?.text || mail.source || "unknown@sender" },
        s3Key:    { S: key },
        date:     { S: parsedEmail.date?.toISOString() || mail.commonHeaders?.date || new Date().toISOString() },
        messageId:{ S: messageId },
        ttl:      { N: ttl.toString() }
      }
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Stored metadata and HTML body" })
    };
  } catch (err) {
    console.error("Lambda error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal error" })
    };
  }
};

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch)
  );
}

function wrapHtml(inner) {
  return `<html><body>${inner}</body></html>`;
}
