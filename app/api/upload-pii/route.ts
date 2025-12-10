// app/api/upload-pii/route.ts

import { NextResponse } from "next/server";

// Force Node.js runtime so Node libs work correctly
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
      // ---- PDF HANDLING ----
      const pdfModule: any = await import("pdf-parse");

      // pdf-parse can be exported in a few different shapes, so we normalize it:
      let pdfParse: any = pdfModule.default || pdfModule;

      if (typeof pdfParse !== "function") {
        if (typeof pdfModule.pdfParse === "function") {
          pdfParse = pdfModule.pdfParse;
        } else if (
          pdfModule.default &&
          typeof pdfModule.default.pdfParse === "function"
        ) {
          pdfParse = pdfModule.default.pdfParse;
        } else if (
          pdfModule.default &&
          typeof pdfModule.default.default === "function"
        ) {
          pdfParse = pdfModule.default.default;
        } else {
          throw new Error("pdf-parse module did not export a callable function");
        }
      }

      const parsed = await pdfParse(buffer);
      text = parsed?.text || "";
    } else if (name.endsWith(".docx")) {
      // ---- DOCX HANDLING ----
      const mammothModule: any = await import("mammoth");
      const mammoth = mammothModule.default || mammothModule;
      const result = await mammoth.extractRawText({ buffer });
      text = result?.value || "";
    } else if (name.endsWith(".txt")) {
      // ---- TXT HANDLING ----
      text = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX or TXT." },
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
