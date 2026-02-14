import { NextResponse } from "next/server";
import { uploadToSpaces } from "@/lib/spaces";
import type { UploadResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const key = `references/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const url = await uploadToSpaces(buffer, key, file.type);

    return NextResponse.json({ url } satisfies UploadResponse);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
