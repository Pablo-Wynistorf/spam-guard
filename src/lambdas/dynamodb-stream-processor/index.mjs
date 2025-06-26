import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  SESClient,
  DescribeReceiptRuleCommand,
  UpdateReceiptRuleCommand
} from '@aws-sdk/client-ses';

const s3 = new S3Client({});
const ses = new SESClient({});

const EMAIL_STORAGE_BUCKET = process.env.EMAIL_STORAGE_BUCKET;
const SES_RULE_SET_NAME = process.env.SES_RULE_SET_NAME;
const SES_RULE_NAME = process.env.SES_RULE_NAME;

export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'REMOVE') {
      try {
        const oldImage = record.dynamodb.OldImage;
        const s3Key = oldImage?.s3Key?.S;
        const email = oldImage?.email?.S;
        const emailId = oldImage?.emailId?.S;

        if (emailId === "Session") {
          const { Rule } = await ses.send(new DescribeReceiptRuleCommand({
            RuleSetName: SES_RULE_SET_NAME,
            RuleName: SES_RULE_NAME
          }));

          if (!Rule) throw new Error("SES rule not found");

          const existingRecipients = Rule.Recipients || [];

          if (existingRecipients.includes(email)) {
            const updatedRecipients = existingRecipients.filter(r => r !== email);

            const updatedRule = {
              ...Rule,
              Recipients: updatedRecipients
            };

            await ses.send(new UpdateReceiptRuleCommand({
              RuleSetName: SES_RULE_SET_NAME,
              Rule: updatedRule
            }));

            console.log(`Removed ${email} from SES recipient rule.`);
          } else {
            console.log(`${email} not found in SES recipient list.`);
          }
        } else {

          const deleteCommand = new DeleteObjectCommand({
            Bucket: EMAIL_STORAGE_BUCKET,
            Key: s3Key,
          });

          await s3.send(deleteCommand);
          
          console.log(`emailId exists (${emailId}), not removing ${email} from SES rule.`);
        }

      } catch (err) {
        console.error(`Failed to handle REMOVE event for ${record?.dynamodb?.OldImage?.email?.S}:`, err);
      }
    }
  }
};
