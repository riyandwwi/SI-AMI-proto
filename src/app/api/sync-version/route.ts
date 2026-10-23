import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [isianAgg, indCount, periodeAgg] = await Promise.all([
      prisma.isian.aggregate({
        _max: { updatedAt: true },
        _count: { _all: true },
      }),
      prisma.indikator.count(),
      prisma.periode.aggregate({
        _max: { createdAt: true, disahkanAt: true },
        _count: { _all: true },
      }),
    ]);

    const v = [
      isianAgg._count._all,
      isianAgg._max.updatedAt?.getTime() ?? 0,
      indCount,
      periodeAgg._count._all,
      periodeAgg._max.createdAt?.getTime() ?? 0,
      periodeAgg._max.disahkanAt?.getTime() ?? 0,
    ].join(":");

    return NextResponse.json(
      { v },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json({ v: "0" }, { status: 200 });
  }
}
