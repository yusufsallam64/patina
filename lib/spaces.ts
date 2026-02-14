import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT!,
  forcePathStyle: false,
  region: "us-east-1", // Required by SDK but ignored — endpoint determines actual region
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
});

/**
 * Upload a buffer to DigitalOcean Spaces and return the public CDN URL.
 */
export async function uploadToSpaces(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const bucket = process.env.DO_SPACES_BUCKET!;
  const region = process.env.DO_SPACES_REGION!;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  return `https://${bucket}.${region}.digitaloceanspaces.com/${key}`;
}
