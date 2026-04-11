import { NextResponse } from "next/server";

import { getShareRecord } from "@/lib/server/share-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await context.params;
  const record = await getShareRecord(shareId);

  if (!record) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }

  return NextResponse.json(record);
}
