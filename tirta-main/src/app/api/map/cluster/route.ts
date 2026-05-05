import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/map/cluster?ids=id1,id2,id3
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50); // hard cap

  if (ids.length === 0) {
    return NextResponse.json({
      reports: [],
    });
  }

  const reports = await prisma.userReport.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
      title: true,
      address: true,
      reportedAt: true,
      user: {
        select: {
          name: true,
          photoURL: true,
        },
      },
      analysis: {
        select: {
          floodRiskScore: true,
          categoryLevel: true,
        },
      },
    },
    orderBy: [
      // tinggi FRI dulu
      {
        analysis: {
          floodRiskScore: "desc",
        },
      },
      {
        reportedAt: "desc",
      },
    ],
  });

  const mapped = reports.map((report) => ({
    id: report.id,
    title: report.title,
    address: report.address,
    reportedAt: report.reportedAt.toISOString(),
    floodRiskScore: report.analysis?.floodRiskScore ?? 0,
    categoryLevel: report.analysis?.categoryLevel ?? null,
    user: report.user,
  }));

  return NextResponse.json({
    reports: mapped,
  });
}
