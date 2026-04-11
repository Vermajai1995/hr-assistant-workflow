import { NextRequest, NextResponse } from "next/server";

import { createShareRecord } from "@/lib/server/share-store";
import { log } from "@/lib/server/logger";
import { assertRateLimit } from "@/lib/server/rate-limit";
import type { SessionSnapshot } from "@/types/hireflow";

type ShareRequest = {
  snapshot?: SessionSnapshot;
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    assertRateLimit(`share:${ip}`, 15);

    const body = (await request.json()) as ShareRequest;

    if (!body.snapshot?.id || !body.snapshot.rows?.length) {
      return NextResponse.json(
        { error: "A completed session is required to generate a share link." },
        { status: 400 }
      );
    }

    const record = await createShareRecord({
      ...body.snapshot,
      updatedAt: new Date().toISOString(),
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    return NextResponse.json({
      shareId: record.shareId,
      shareUrl: `${baseUrl}/share/${record.shareId}`,
    });
  } catch (error) {
    log("error", "Failed to create share session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Unable to create a shareable session right now." },
      { status: 500 }
    );
  }
}
