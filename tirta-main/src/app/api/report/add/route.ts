import { v2 as cloudinary } from "cloudinary";
import { type NextRequest, NextResponse } from "next/server";
import { RiskCategory, ZoneRiskLevel } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const FAST_API_URL = process.env.FAST_API_URL!;

if (!FAST_API_URL) {
  throw new Error("FAST_API_URL is not defined");
}

const W_PHOTO = 0.45;
const W_ZONE = 0.3;
const W_FORM = 0.25;

const ZONE_SCORE: Record<string, number> = {
  SANGAT_RAWAN: 100,
  RAWAN: 75,
  CUKUP_RAWAN: 50,
  KURANG_RAWAN: 25,
  TIDAK_RAWAN: 0,
  UNKNOWN: 0,
};

const DRAINAGE_SCORE: Record<string, number> = {
  TIDAK_ADA: 100,
  BURUK: 75,
  SEDANG: 40,
  BAIK: 10,
};

const GARBAGE_SCORE: Record<string, number> = {
  BANYAK: 100,
  SEDANG: 55,
  RINGAN: 20,
  TIDAK_ADA: 0,
};

const ROAD_SCORE: Record<string, number> = {
  ASPAL: 90,
  BETON: 80,
  PAVING: 40,
  TANAH: 10,
  LAINNYA: 0,
};

function calcFormScore(
  drainage: string,
  garbage: string,
  road: string | null,
): number {
  const d = DRAINAGE_SCORE[drainage];
  const g = GARBAGE_SCORE[garbage];
  const r = road ? ROAD_SCORE[road] : 0;

  return d * 0.4 + g * 0.35 + r * 0.25;
}

function calcFinalFRI(
  photoScore: number,
  zoneScore: number,
  formScore: number,
): number {
  return Math.min(
    100,
    Math.max(0, photoScore * W_PHOTO + zoneScore * W_ZONE + formScore * W_FORM),
  );
}

function toCategoryLevel(fri: number): RiskCategory {
  if (fri >= 70) return RiskCategory.TINGGI;
  if (fri >= 40) return RiskCategory.SEDANG;
  return RiskCategory.RENDAH;
}

// function toRiskLevel(zone: number): ZoneRiskLevel {
//     if (zone >= 75) return ZoneRiskLevel.SANGAT_RAWAN;
//     if (zone >= 50) return ZoneRiskLevel.RAWAN;
//     if (zone >= 25) return ZoneRiskLevel.CUKUP_RAWAN;
//     if (zone > 0) return ZoneRiskLevel.TIDAK_RAWAN;
//     return ZoneRiskLevel.UNKNOWN;
// }

function pointInZoneBbox(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusM: number,
): boolean {
  const latDelta = radiusM / 111000;
  const lngDelta = radiusM / (111000 * Math.cos((centerLat * Math.PI) / 180));

  return (
    lat >= centerLat - latDelta &&
    lat <= centerLat + latDelta &&
    lng >= centerLng - lngDelta &&
    lng <= centerLng + lngDelta
  );
}

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const arrBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrBuffer);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, res) => {
        if (error || !res) reject(error ?? new Error("Failed to upload image"));
        else resolve(res.secure_url);
      },
    );
    stream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const firebaseUID = searchParams.get("firebaseUID") as string;

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

  // const form = await req.formData();
  let form: FormData;

  try {
    form = await req.formData();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid form data",
      },
      {
        status: 400,
      },
    );
  }

  const latitude = parseFloat(form.get("latitude") as string);
  const longitude = parseFloat(form.get("longitude") as string);
  const address = form.get("address") as string;
  const title = form.get("title") as string;
  const description = (form.get("description") as string) || null;
  const drainageQuality = form.get("drainageQuality") as string;
  const garbageCategory = form.get("garbageCategory") as string;
  const roadType = form.get("roadType") as string;
  const vegetationDensity = (form.get("vegetationDensity") as string) || null;

  if (!latitude || !longitude) {
    return NextResponse.json(
      {
        error: "Missing latitude or longitude",
      },
      {
        status: 400,
      },
    );
  }

  let floodHistories: {
    occuredAt: string;
    notes?: string;
  }[] = [];

  try {
    floodHistories = JSON.parse((form.get("floodHistories") as string) || "[]");
  } catch {
    // make empty histories as a state
    floodHistories = [];
  }

  const photoFiles = (form.getAll("photos") as File[]).filter(
    (f) => f instanceof File && f.size > 0,
  );

  const segForm = new FormData();

  for (const file of photoFiles) {
    segForm.append("files", file);
  }

  const [uploadResults, segResult] = await Promise.allSettled([
    Promise.allSettled(
      photoFiles.map((f) => uploadToCloudinary(f, "tirta/reports")),
    ),
    (async () => {
      if (photoFiles.length === 0) return 0; // default fri no photo

      const res = await fetch(`${FAST_API_URL}/model/segmentation`, {
        method: "POST",
        body: segForm,
      });

      if (!res.ok) throw new Error("FastAPI segmentation error");

      const data = (await res.json()) as {
        fri_score: number;
      };

      return data.fri_score;
    })(),
  ]);

  const friPhoto = segResult.status === "fulfilled" ? segResult.value : 0;

  const uploadedPhotoURLs: string[] = [];

  if (uploadResults.status === "fulfilled") {
    for (const r of uploadResults.value) {
      if (r.status === "fulfilled") uploadedPhotoURLs.push(r.value);
    }
  }

  const nearbyZones = await prisma.floodZone.findMany({
    where: {
      centerLat: {
        gte: latitude - 0.2,
        lte: latitude + 0.2,
      },
      centerLng: {
        gte: longitude - 0.2,
        lte: longitude + 0.2,
      },
    },
    select: {
      id: true,
      centerLat: true,
      centerLng: true,
      riskCategory: true,
    },
  });

  const matchedZone =
    nearbyZones.find((z) =>
      pointInZoneBbox(latitude, longitude, z.centerLat, z.centerLng, 500),
    ) ?? null;
  const zoneRiskLevel: ZoneRiskLevel =
    matchedZone?.riskCategory ?? ZoneRiskLevel.UNKNOWN;
  const zoneScore = ZONE_SCORE[zoneRiskLevel] ?? 0;

  const formScore = calcFormScore(
    drainageQuality ?? "",
    garbageCategory ?? "",
    roadType,
  );

  const friFinal = calcFinalFRI(friPhoto, zoneScore, formScore);
  const categoryLevel = toCategoryLevel(friFinal);

  const report = await prisma.$transaction(async (tx) => {
    const newReport = await tx.userReport.create({
      data: {
        userId: firebaseUID,
        zoneId: matchedZone?.id ?? null,
        title,
        description,
        latitude,
        longitude,
        address,
        drainageQuality: drainageQuality as never,
        garbageCategory: garbageCategory as never,
        roadType: roadType as never,
        vegetationDensity: vegetationDensity as never,
      },
    });

    if (uploadedPhotoURLs.length > 0) {
      await tx.reportPhoto.createMany({
        data: uploadedPhotoURLs.map((url) => ({
          reportId: newReport.id,
          photoURL: url,
        })),
      });
    }

    if (floodHistories.length > 0) {
      await tx.reportFloodHistory.createMany({
        data: floodHistories.map((h) => ({
          reportId: newReport.id,
          occurredAt: new Date(h.occuredAt),
          notes: h.notes ?? null,
        })),
      });
    }

    await tx.reportAnalysis.create({
      data: {
        reportId: newReport.id,
        drainageStatus: drainageQuality,
        vegetation: vegetationDensity,
        zoneIncidentCount: null,
        floodRiskScore: friFinal,
        riskLevel: zoneRiskLevel,
        categoryLevel,
      },
    });

    return newReport;
  });

  return NextResponse.json(
    {
      reportId: report.id,
      fri: {
        final: Math.round(friFinal * 10) / 10,
        breakdown: {
          photo: Math.round(friPhoto * 10) / 10,
          zone: zoneScore,
          form: Math.round(formScore * 10) / 10,
        },
        categoryLevel,
        riskLevel: zoneRiskLevel,
      },
    },
    {
      status: 201,
    },
  );
}
