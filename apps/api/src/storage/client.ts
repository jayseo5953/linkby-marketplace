import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';

/** Removing `endpoint` and `forcePathStyle` points this at real S3 (T-09). */
export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  requestHandler: { connectionTimeout: 2_000, requestTimeout: 3_000 },
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
});

/** Throws unless the bucket exists and is reachable — proves storage-init ran. */
export async function headBucket(): Promise<void> {
  await s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
}
