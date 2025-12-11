// app/api/upload-pii/route.ts

import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const name = file.name.toLowerCase();

    let text = "";

    // ---------- Explicitly block PDF for now ----------
    if (name.endsWith(".pdf")) {
      return NextResponse.json(
        {
          error:
            "PDF parsing is not supported in this prototype. " +
            "Please export your JD / transcript as DOCX or TXT and upload again.",
          text: "",
        },
        { status: 400 }
      );
    }

    // ---------- DOCX via mammoth ----------
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    }
    // ---------- Plain text ----------
    else if (name.endsWith(".txt")) {
      text = buffer.toString("utf8");
    }
    // ---------- Unsupported ----------
    else {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload DOCX or TXT (PDF coming soon).",
          text: "",
        },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No readable text found in this file.", text: "" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("upload-pii error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to parse file" },
      { status: 500 }
    );
  }
}
