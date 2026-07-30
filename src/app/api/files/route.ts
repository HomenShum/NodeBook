import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost, PresignedPost } from "@aws-sdk/s3-presigned-post";

import { env } from "@/envBackend";

const ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
const BUCKET_NAME = "nodebook-nodebook-uploads";
const MAX_UPLOAD_IN_BYTES = 16777216; //16 MB (in binary)

const s3Client = new S3Client({
  region: "us-west-1",
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/jpg", "image/webp", "image/svg"];

export const GET = getHandler;
async function getHandler(req: NextRequest) {
  const mime = req.nextUrl.searchParams.get("mime")?.toLowerCase() || "";

  if (mime.length < 1 || !allowedImageMimeTypes.includes(mime)) {
    return NextResponse.json({ error: "Bad request, invalid mime" }, { status: 400 });
  }

  const objectKey = uuidv4() + "." + mime.split("/").pop() || "jpg";

  let presignedPost: PresignedPost | null = null;

  try {
    presignedPost = await createPresignedPost(s3Client, {
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Expires: 300,
      Conditions: [["content-length-range", 0, MAX_UPLOAD_IN_BYTES]],
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 505 });
  }

  return NextResponse.json(presignedPost);
}
