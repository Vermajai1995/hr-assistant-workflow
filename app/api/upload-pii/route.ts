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

    if (name.endsWith(".pdf")) {
      // ---- PDF via pdfjs-dist ----
      const pdfjsModule: any = await import("pdfjs-dist");
      const pdfjs = pdfjsModule.default || pdfjsModule;

      // In Node environment workers generally not needed for simple text extraction
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = "";
      }

      const loadingTask = pdfjs.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;

      let collected = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        collected += strings.join(" ") + "\n";
      }

      text = collected.trim();
    } else if (name.endsWith(".docx")) {
      // ---- DOCX via mammoth ----
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } else if (name.endsWith(".txt")) {
      // ---- Plain text ----
      text = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        { error: "Only PDF, DOCX or TXT are supported." },
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
