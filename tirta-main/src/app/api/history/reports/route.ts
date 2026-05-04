import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const firebaseUID = searchParams.get("firebaseUID");
  const sort = (searchParams.get("sort") ?? "latest") as
    | "latest"
    | "oldest"
    | "nearest";
  const riskRaw = searchParams.get("riskCategory");

  if (!firebaseUID) {
    return NextResponse.json(
      {
        error: "Missing firebaseUID",
      },
      {
        status: 400,
      },
    );
  }

  // parse filter risiko
  const riskFilter = riskRaw
    ? (riskRaw.split(",").filter(Boolean) as ("TINGGI" | "SEDANG" | "RENDAH")[])
    : null;

  const categoryFilter = riskFilter?.length ? { in: riskFilter } : undefined;

  const query = {
    where: {
      user: {
        firebaseUID,
      },
      analysis: categoryFilter
        ? {
            is: {
              categoryLevel: categoryFilter,
            },
          }
        : {
            isNot: null,
          },
    },
    include: {
      photos: {
        select: {
          photoURL: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
      analysis: {
        select: {
          floodRiskScore: true,
          riskLevel: true,
          categoryLevel: true,
        },
      },
    },
    orderBy: {
      reportedAt: "desc",
    },
  } satisfies Prisma.UserReportFindManyArgs;

  const raw = (await prisma.userReport.findMany(
    query,
  )) as Prisma.UserReportGetPayload<{
    include: typeof query.include;
  }>[];

  const reports = raw.map((r) => ({
    id: r.id,
    address: r.address,
    reportedAt: r.reportedAt.toISOString(),
    description: r.description,
    imageUrl: r.photos[0]?.photoURL ?? null,
    friScore: r.analysis?.floodRiskScore ?? null,
    riskCategory: r.analysis?.categoryLevel ?? null,
    distanceLabel: null,
  }));

  if (sort === "oldest") {
    reports.sort(
      (a, b) =>
        new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime(),
    );
  } else if (sort === "latest") {
    reports.sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
  }

  return NextResponse.json({
    listed: reports,
  });
}
