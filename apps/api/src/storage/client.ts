import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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

/** ContentType is explicit because MinIO stores what it is told, and browsers trust it on GET. */
export async function putObject(
  key: string,
  body: string | Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Paginated because a listing returns at most 1000 keys, and a partial delete leaks silently. */
export async function deleteByPrefix(prefix: string): Promise<number> {
  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? []).map((object) => ({ Key: object.Key! }));
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: config.S3_BUCKET,
          Delete: { Objects: keys },
        }),
      );
      deleted += keys.length;
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);

  return deleted;
}
