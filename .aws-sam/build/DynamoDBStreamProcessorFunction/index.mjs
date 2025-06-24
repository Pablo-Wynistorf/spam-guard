import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET;

export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'REMOVE') {
      try {
        const s3Key = record.dynamodb.OldImage.s3Key.S;

        const command = new DeleteObjectCommand({
          Bucket: EMAIL_STORAGE_BUCKET,
          Key: s3Key,
        });

        await s3.send(command);
        console.log(`Deleted: ${s3Key}`);
      } catch (err) {
        console.error(`Failed to delete ${record?.dynamodb?.OldImage?.s3Key?.S}:`, err);
      }
    }
  }
};
