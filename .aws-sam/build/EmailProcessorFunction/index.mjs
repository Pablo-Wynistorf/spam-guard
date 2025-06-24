import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});

const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET;


export const handler = async (event) => {
  try {
    const snsMessage = event.Records?.[0]?.Sns?.Message;
    if (!snsMessage) throw new Error("Missing SNS message");

    const notification = JSON.parse(snsMessage);
    const mail = notification.mail || {};
    const rawMime = notification.content;
    const messageId = mail.messageId || crypto.randomUUID();

    const email = mail.destination?.[0] || "unknown@app";
    const sender = mail.source || "unknown@sender";
    const subject = mail.commonHeaders?.subject || "(No Subject)";
    const date = mail.commonHeaders?.date || new Date().toISOString();

    const mime = Buffer.from(rawMime, "base64").toString("utf8");
    const htmlBody = extractHtmlOrFallback(mime);

    const key = `${messageId}.html`;

    await s3.send(new PutObjectCommand({
      Bucket: EMAIL_STORAGE_BUCKET,
      Key: key,
      Body: htmlBody,
      ContentType: "text/html",
    }));

    const ttl = Math.floor(Date.now() / 1000) + 15 * 60;

    await dynamodb.send(new PutItemCommand({
      TableName: "emailsTable",
      Item: {
        emailId: { S: email },
        subject:   { S: subject },
        sender:    { S: sender },
        s3Key:     { S: key },
        date:      { S: date },
        messageId: { S: messageId },
        ttl:       { N: ttl.toString() }
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

function extractHtmlOrFallback(mime) {
  const boundaryMatch = mime.match(/boundary="([^"]+)"|boundary=([^\s;]+)/i);
  const boundary = boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;
  if (!boundary) return wrapHtml("[Email format not recognized: no boundary]");

  const parts = mime.split(new RegExp(`--${boundary}(--)?\\r?\\n`, 'g'));
  let htmlBody = null;
  let plainBody = null;

  for (const part of parts) {
    const headersEnd = part.indexOf("\r\n\r\n");
    if (headersEnd === -1) continue;

    const rawHeaders = part.slice(0, headersEnd).trim();
    const body = part.slice(headersEnd + 4).trim();

    const headers = parseHeaders(rawHeaders);
    const contentType = headers["content-type"] || "";
    const encoding = (headers["content-transfer-encoding"] || "").toLowerCase();

    const decodedBody = decodeBody(body, encoding);

    if (/text\/html/i.test(contentType) && !htmlBody) {
      htmlBody = decodedBody;
    } else if (/text\/plain/i.test(contentType) && !plainBody) {
      plainBody = decodedBody;
    }
  }

  if (htmlBody) return htmlBody;
  if (plainBody) return wrapHtml(`<pre>${escapeHtml(plainBody)}</pre>`);
  return wrapHtml("[No readable HTML or plain text found]");
}

function parseHeaders(headerBlock) {
  const lines = headerBlock.split(/\r?\n/);
  const headers = {};
  let lastKey = null;

  for (let line of lines) {
    if (/^\s/.test(line) && lastKey) {
      headers[lastKey] += " " + line.trim();
    } else {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) continue;
      lastKey = key.trim().toLowerCase();
      headers[lastKey] = rest.join(":").trim();
    }
  }

  return headers;
}

function decodeBody(content, encoding) {
  switch (encoding) {
    case "base64":
      return Buffer.from(content.replace(/\r?\n/g, ""), "base64").toString("utf8");
    case "quoted-printable":
      return decodeQuotedPrintable(content);
    default:
      return content;
  }
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch)
  );
}

function wrapHtml(inner) {
  return `<html><body>${inner}</body></html>`;
}
