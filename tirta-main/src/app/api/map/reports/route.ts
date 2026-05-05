import { type NextRequest, NextResponse } from "next/server";
import type { RiskCategory, ZoneRiskLevel } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

// in meters
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

const CLUSTER_RADIUS_M = 100;

function clusterReports(reports: RawReport[]): ClusteredReport[] {
  const visited = new Set<string>();
  const clusters: ClusteredReport[] = [];

  for (const report of reports) {
    if (visited.has(report.id)) continue;

    const nearby = reports.filter(
      (r) =>
        !visited.has(r.id) &&
        haversineMeters(
          report.latitude,
          report.longitude,
          r.latitude,
          r.longitude,
        ) <= CLUSTER_RADIUS_M,
    );

    for (const nearbyReport of nearby) {
      visited.add(nearbyReport.id);
    }

    const representative = nearby.reduce((a, b) =>
      (b.analysis?.floodRiskScore ?? 0) > (a.analysis?.floodRiskScore ?? 0)
        ? b
        : a,
    );

    clusters.push({
      id: representative.id,
      latitude: representative.latitude,
      longitude: representative.longitude,
      address: representative.address,
      reportedAt: representative.reportedAt.toISOString(),
      floodRiskScore: representative.analysis?.floodRiskScore ?? 0,
      riskLevel: representative.analysis?.riskLevel ?? "UNKNOWN",
      categoryLevel: representative.analysis?.categoryLevel ?? null,
      clusterCount: nearby.length,
      clusterIds: nearby.map((r) => r.id),
    });
  }

  return clusters;
}

interface RawReport {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  reportedAt: Date;
  photos: {
    photoURL: string;
  }[];
  analysis: {
    floodRiskScore: number;
    riskLevel: ZoneRiskLevel;
    categoryLevel: RiskCategory;
  } | null;
}

interface ClusteredReport {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  reportedAt: string;
  floodRiskScore: number;
  riskLevel: ZoneRiskLevel;
  categoryLevel: RiskCategory | null;
  clusterCount: number;
  clusterIds: string[];
}

// GET /api/map/reports?lat=&lng=&radius=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radiusM = parseFloat(searchParams.get("radius") ?? "5000");

  if (!lat || !lng) {
    return NextResponse.json(
      {
        error: "lat dan lng wajib diisi",
      },
      {
        status: 400,
      },
    );
  }

  const latDelta = radiusM / 111000;
  const lngDelta = radiusM / (111000 * Math.cos((lat * Math.PI) / 180));

  const [rawReports, zones] = await Promise.all([
    prisma.userReport.findMany({
      where: {
        latitude: {
          gte: lat - latDelta,
          lte: lat + latDelta,
        },
        longitude: {
          gte: lng - lngDelta,
          lte: lng + lngDelta,
        },
        analysis: {
          isNot: null,
        },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        address: true,
        reportedAt: true,
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
      take: 500,
    }),

    prisma.floodZone.findMany({
      where: {
        centerLat: { gte: lat - latDelta * 3, lte: lat + latDelta * 3 },
        centerLng: { gte: lng - lngDelta * 3, lte: lng + lngDelta * 3 },
      },
      select: {
        id: true,
        name: true,
        boundary: true,
        riskCategory: true,
      },
    }),
  ]);

  // filter presisi radius
  const inRadius = rawReports.filter(
    (report) =>
      haversineMeters(lat, lng, report.latitude, report.longitude) <= radiusM,
  );

  const clustered = clusterReports(inRadius);

  return NextResponse.json({
    reports: clustered,
    zones,
  });
}
