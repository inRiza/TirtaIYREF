"use client";

import { MapPin, SlidersHorizontal } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { MapActionButtons } from "./components/map-actions";
import { MapBottomSheet } from "./components/map-bottom-sheets";
import { MapLegend } from "./components/map-legend";

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface MapReport {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  reportedAt: string;
  floodRiskScore: number;
  riskLevel: "SANGAT_RAWAN" | "RAWAN" | "TIDAK_RAWAN" | "UNKNOWN";
  categoryLevel: "TINGGI" | "SEDANG" | "RENDAH" | null;
  clusterCount: number;
  clusterIds: string[];
}

interface ClusterReport {
  id: string;
  title: string | null;
  address: string | null;
  reportedAt: string;
  floodRiskScore: number;
  categoryLevel: "TINGGI" | "SEDANG" | "RENDAH" | null;
  user: { name: string | null; photoURL: string | null };
}

interface ZoneOverlay {
  id: string;
  name: string;
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  riskCategory: "SANGAT_RAWAN" | "RAWAN" | "TIDAK_RAWAN" | "UNKNOWN";
}

const FRI_COLOR: Record<string, string> = {
  TINGGI: "#EF4444",
  SEDANG: "#F59E0B",
  RENDAH: "#3B82F6",
};

const ZONE_COLOR: Record<string, string> = {
  SANGAT_RAWAN: "rgba(239,68,68,0.18)",
  RAWAN: "rgba(245,158,11,0.18)",
  TIDAK_RAWAN: "rgba(34,197,94,0.12)",
  UNKNOWN: "rgba(148,163,184,0.10)",
};

const ZONE_BORDER: Record<string, string> = {
  SANGAT_RAWAN: "rgba(239,68,68,0.7)",
  RAWAN: "rgba(245,158,11,0.7)",
  TIDAK_RAWAN: "rgba(34,197,94,0.5)",
  UNKNOWN: "rgba(148,163,184,0.4)",
};

function friColor(score: number, category: string | null): string {
  if (category) return FRI_COLOR[category] ?? "#3B82F6";
  if (score >= 70) return "#EF4444";
  if (score >= 40) return "#F59E0B";
  return "#3B82F6";
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  return `${Math.floor(hrs / 24)}h lalu`;
}

export default function MapPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const [locationLabel, setLocationLabel] = useState("Memuat lokasi...");
  const [reports, setReports] = useState<MapReport[]>([]);
  const [zones, setZones] = useState<ZoneOverlay[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<MapReport | null>(
    null,
  );
  const [clusterReports, setClusterReports] = useState<ClusterReport[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [showLegend, setShowLegend] = useState(false);
  const headingRef = useRef<number>(0);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const userMarkerEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  const fetchMapData = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `/api/map/reports?lat=${lat}&lng=${lng}&radius=5000`,
      );
      const data = await res.json();
      setReports(data.reports ?? []);
      setZones(data.zones ?? []);
    } catch {}
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality,place&language=id&access_token=${mapboxToken}`,
      );
      const data = await res.json();
      const label = data.features?.[0]?.place_name ?? "Lokasi tidak diketahui";
      setLocationLabel(label.split(",").slice(0, 2).join(",").trim());
    } catch {
      setLocationLabel("Lokasi tidak diketahui");
    }
  }, []);

  const syncUserMarker = useCallback(
    (lat: number, lng: number, bearing: number) => {
      if (!map.current) return;

      if (!userMarker.current) {
        const el = document.createElement("div");
        el.innerHTML = `
        <div class="user-dot-outer">
          <div class="user-dot-bearing">
            <div class="user-dot-cone"></div>
          </div>
          <div class="user-dot-inner"></div>
        </div>
      `;
        userMarkerEl.current = el.firstElementChild as HTMLDivElement;
        // wrap the outer div properly
        const wrapper = document.createElement("div");
        wrapper.appendChild(el.firstElementChild!);

        userMarker.current = new mapboxgl.Marker({
          element: wrapper,
          anchor: "center",
        })
          .setLngLat([lng, lat])
          .addTo(map.current);
      } else {
        userMarker.current.setLngLat([lng, lat]);
      }

      // update cone rotation
      const cone = userMarker.current
        .getElement()
        .querySelector<HTMLElement>(".user-dot-bearing");
      if (cone) cone.style.transform = `rotate(${bearing}deg)`;
    },
    [],
  );

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const alpha = e.alpha ?? 0;
      headingRef.current = alpha;
      const cone = userMarker.current
        ?.getElement()
        .querySelector<HTMLElement>(".user-dot-bearing");
      if (cone) cone.style.transform = `rotate(${alpha}deg)`;
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

  // recenter ke posisi user dan arahkan bearing sesuai device
  const handleRecenter = useCallback(() => {
    if (!map.current || !userCoords) return;
    map.current.flyTo({
      center: [userCoords.lng, userCoords.lat],
      zoom: 15,
      bearing: headingRef.current,
      pitch: 45,
      duration: 800,
    });
  }, [userCoords]);

  // init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!mapboxToken) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [107.5732, -6.9147],
      zoom: 14,
      pitch: 45,
      antialias: true,
    });

    map.current.on("load", () => {
      map.current?.resize();

      // terrain 3d
      map.current?.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.current?.setTerrain({
        source: "mapbox-dem",
        exaggeration: 1.2,
      });
      map.current?.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0, 0],
          "sky-atmosphere-sun-intensity": 12,
        },
      });

      // fly ke posisi pertama
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1200,
          });
          reverseGeocode(latitude, longitude);
          fetchMapData(latitude, longitude);
          syncUserMarker(latitude, longitude, headingRef.current);
        },
        () => {
          reverseGeocode(-6.9147, 107.5732);
          fetchMapData(-6.9147, 107.5732);
        },
      );

      // watch position
      navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          syncUserMarker(latitude, longitude, headingRef.current);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );

      map.current?.on("moveend", () => {
        const center = map.current?.getCenter();
        if (center) reverseGeocode(center.lat, center.lng);
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [fetchMapData, reverseGeocode, syncUserMarker]);

  // render zone overlay
  useEffect(() => {
    if (!map.current || zones.length === 0) return;

    const waitReady = () => {
      if (!map.current?.isStyleLoaded()) {
        setTimeout(waitReady, 100);
        return;
      }
      zones.forEach((zone) => {
        const sourceId = `zone-${zone.id}`;
        if (map.current?.getSource(sourceId)) return;

        map.current?.addSource(sourceId, {
          type: "geojson",
          data: { type: "Feature", geometry: zone.boundary, properties: {} },
        });
        map.current?.addLayer({
          id: `zone-fill-${zone.id}`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": ZONE_COLOR[zone.riskCategory],
            "fill-opacity": 1,
          },
        });
        map.current?.addLayer({
          id: `zone-line-${zone.id}`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": ZONE_BORDER[zone.riskCategory],
            "line-width": 1.5,
          },
        });
      });
    };
    waitReady();
  }, [zones]);

  const handleMarkerClick = useCallback(async (report: MapReport) => {
    setSelectedCluster(report);
    setClusterReports([]);
    setSheetLoading(true);
    try {
      const ids = report.clusterIds.join(",");
      const res = await fetch(`/api/map/cluster?ids=${ids}`);
      const data = await res.json();
      setClusterReports(data.reports ?? []);
    } catch {
      setClusterReports([]);
    } finally {
      setSheetLoading(false);
    }
  }, []);

  // render report markers
  useEffect(() => {
    if (!map.current) return;
    for (const m of markers.current) m.remove();
    markers.current = [];

    const filtered =
      activeFilter === "ALL"
        ? reports
        : reports.filter((r) => r.categoryLevel === activeFilter);

    filtered.forEach((report) => {
      const color = friColor(report.floodRiskScore, report.categoryLevel);
      const isHigh = report.categoryLevel === "TINGGI";
      const score = Math.round(report.floodRiskScore);

      const el = document.createElement("div");
      el.className = "fri-marker";
      el.innerHTML = `
        <div class="fri-bubble" style="background:${color}">
          ${isHigh ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` : ""}
          <span>${score} FRI</span>
          ${report.clusterCount > 1 ? `<span class="cluster-badge">${report.clusterCount}</span>` : ""}
        </div>
        <div class="fri-tail" style="border-top-color:${color}"></div>
      `;
      el.addEventListener("click", () => handleMarkerClick(report));

      const currentMap = map.current;
      if (!currentMap) return;

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([report.longitude, report.latitude])
        .addTo(currentMap);
      markers.current.push(marker);
    });
  }, [reports, activeFilter, handleMarkerClick]);

  if (loading || !user) return null;

  return (
    <>
      <style>{`
        /* FRI report markers */
        .fri-marker { cursor: pointer; }
        .fri-bubble {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: 20px;
          color: white; font-size: 13px; font-weight: 600;
          white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.22);
        }
        .fri-tail {
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top-width: 7px; border-top-style: solid;
          margin: 0 auto;
        }
        .cluster-badge {
          background: rgba(255,255,255,0.28);
          border-radius: 10px; padding: 0 5px;
          font-size: 11px; font-weight: 700;
        }

        /* user location dot */
        .user-dot-outer {
          position: relative;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
        }
        .user-dot-bearing {
          position: absolute; inset: 0;
          display: flex; align-items: flex-start; justify-content: center;
          transform-origin: center center;
          transition: transform 0.25s linear;
        }
        .user-dot-cone {
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 16px solid rgba(59,130,246,0.38);
          margin-top: -4px;
        }
        .user-dot-inner {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 14px; height: 14px;
          background: #3B82F6;
          border: 2.5px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.2), 0 2px 6px rgba(0,0,0,0.2);
          z-index: 1;
        }

        /* suppress default mapbox controls */
        .mapboxgl-ctrl-bottom-left,
        .mapboxgl-ctrl-bottom-right { display: none !important; }
      `}</style>

      <div className="relative h-dvh w-full max-w-md mx-auto overflow-hidden bg-slate-100">
        {/* search bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-12 pb-3 bg-linear-to-b from-white/95 via-white/80 to-transparent pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-3 shadow-md border border-slate-100">
              <MapPin size={16} className="text-blue-500 shrink-0" />
              <span className="text-sm text-slate-700 font-medium truncate">
                {locationLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilterVisible((v) => !v)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {filterVisible && (
            <div className="mt-2 flex gap-2 pointer-events-auto">
              {(["ALL", "TINGGI", "SEDANG", "RENDAH"] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all",
                    activeFilter === f
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200",
                  )}
                >
                  {f === "ALL"
                    ? "Semua"
                    : f === "TINGGI"
                      ? "Tinggi"
                      : f === "SEDANG"
                        ? "Sedang"
                        : "Rendah"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* map */}
        <div
          ref={mapContainer}
          className="absolute inset-0 z-0"
          style={{ width: "100%", height: "100%" }}
        />

        <MapActionButtons
          canRecenter={Boolean(userCoords)}
          onRecenter={handleRecenter}
          onToggleLegend={() => setShowLegend((value) => !value)}
          onReport={() => router.push("/report/add")}
        />

        <MapLegend show={showLegend} />

        {/* bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <AppBottomNav />
        </div>

        {/* bottom sheet (detail cluster) */}
        {selectedCluster && (
          <MapBottomSheet
            selectedCluster={selectedCluster}
            clusterReports={clusterReports}
            sheetLoading={sheetLoading}
            onClose={() => setSelectedCluster(null)}
            onSelectReport={(id) => router.push(`/report/${id}`)}
            formatRelative={formatRelative}
            getScoreColor={friColor}
          />
        )}
      </div>
    </>
  );
}
