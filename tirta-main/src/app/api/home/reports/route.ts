import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m dari lokasi Anda`;
  return `${(meters / 1000).toFixed(1)} Km dari lokasi Anda`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radiusM = parseFloat(searchParams.get("radius") ?? "10000");
  const nearbyLimit = parseInt(searchParams.get("nearbyLimit") ?? "6");
  const latestLimit = parseInt(searchParams.get("latestLimit") ?? "20");
  const sort = (searchParams.get("sort") ?? "latest") as
    | "nearest"
    | "latest"
    | "oldest";
  const riskRaw = searchParams.get("riskCategory");

  // parse filter risiko
  const riskFilter = riskRaw
    ? (riskRaw.split(",").filter(Boolean) as ("TINGGI" | "SEDANG" | "RENDAH")[])
    : null;

  const hasLocation = lat !== 0 && lng !== 0;

  const latDelta = radiusM / 111000;
  const lngDelta = hasLocation
    ? radiusM / (111000 * Math.cos((lat * Math.PI) / 180))
    : 0;

  const categoryFilter = riskFilter?.length
    ? {
        in: riskFilter,
      }
    : undefined;

  const query = {
    where: {
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
    take: 100,
  } satisfies Prisma.UserReportFindManyArgs;

  const raw = (await prisma.userReport.findMany(
    query,
  )) as Prisma.UserReportGetPayload<{
    include: typeof query.include;
  }>[];

  // hitung jarak per item
  const withDistance = raw.map((r) => ({
    ...r,
    distanceM: hasLocation
      ? haversineMeters(lat, lng, r.latitude, r.longitude)
      : null,
    imageUrl: r.photos[0]?.photoURL ?? null,
    friScore: r.analysis?.floodRiskScore ?? null,
    riskCategory: r.analysis?.categoryLevel ?? null,
  }));

  const nearbyResults = hasLocation
    ? withDistance.filter((r) => r.distanceM! <= radiusM)
    : withDistance;

  const listedResults = withDistance;

  const nearby = hasLocation
    ? [...nearbyResults]
        .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
        .slice(0, nearbyLimit)
    : nearbyResults.slice(0, nearbyLimit);

  let listed = [...listedResults];
  if (sort === "nearest" && hasLocation) {
    listed.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  } else if (sort === "oldest") {
    listed.sort(
      (a, b) =>
        new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime(),
    );
  } else {
    listed.sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
  }
  listed = listed.slice(0, latestLimit);

  const serialize = (r: (typeof withDistance)[number]) => ({
    id: r.id,
    address: r.address,
    reportedAt: r.reportedAt.toISOString(),
    description: r.description,
    imageUrl: r.imageUrl,
    friScore: r.friScore,
    riskCategory: r.riskCategory,
    distanceLabel: r.distanceM != null ? distanceLabel(r.distanceM) : null,
  });

  return NextResponse.json({
    nearby: nearby.map(serialize),
    listed: listed.map(serialize),
  });
}
