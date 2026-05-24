import { NextRequest, NextResponse } from "next/server";
import { expireStaleReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await expireStaleReservations();
  return NextResponse.json({ expired, timestamp: new Date().toISOString() });
}
