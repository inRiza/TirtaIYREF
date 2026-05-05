"use client";

import {
  AlertCircle,
  Camera,
  Car,
  ChevronLeft,
  Droplets,
  FileText,
  Loader2,
  MapPin,
  Send,
  Trash2,
  TreePine,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { LocationIndicator } from "./components/location-indicator";
import { ReportBreadcrumbs } from "./components/report-breadcrumbs";

type DrainageQuality = "BAIK" | "SEDANG" | "BURUK" | "TIDAK_ADA";
type GarbageCategory = "RINGAN" | "SEDANG" | "BANYAK" | "TIDAK_ADA";
type RoadType = "ASPAL" | "BETON" | "PAVING" | "TANAH" | "LAINNYA";
type VegetationDensity = "RINGAN" | "SEDANG" | "BANYAK" | "TIDAK_ADA";

const DRAINAGE_OPTIONS: {
  value: DrainageQuality;
  label: string;
  desc: string;
}[] = [
  { value: "BAIK", label: "Baik", desc: "Mengalir lancar" },
  { value: "SEDANG", label: "Sedang", desc: "Sedikit tersumbat" },
  { value: "BURUK", label: "Buruk", desc: "Tersumbat parah" },
  { value: "TIDAK_ADA", label: "Tidak Ada", desc: "Tanpa drainase" },
];

const GARBAGE_OPTIONS: { value: GarbageCategory; label: string }[] = [
  { value: "TIDAK_ADA", label: "Tidak Ada" },
  { value: "RINGAN", label: "Ringan" },
  { value: "SEDANG", label: "Sedang" },
  { value: "BANYAK", label: "Banyak" },
];

const ROAD_OPTIONS: { value: RoadType; label: string }[] = [
  { value: "ASPAL", label: "Aspal" },
  { value: "BETON", label: "Beton" },
  { value: "PAVING", label: "Paving" },
  { value: "TANAH", label: "Tanah" },
  { value: "LAINNYA", label: "Lainnya" },
];

const VEGETATION_OPTIONS: { value: VegetationDensity; label: string }[] = [
  { value: "TIDAK_ADA", label: "Tidak Ada" },
  { value: "RINGAN", label: "Ringan" },
  { value: "SEDANG", label: "Sedang" },
  { value: "BANYAK", label: "Banyak" },
];

function SectionLabel({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/10">
        <Icon size={13} className="text-brand-600" />
      </div>
      <p className="text-sm font-bold text-slate-600">{label}</p>
    </div>
  );
}

function ChipSelector<T extends string>({
  options,
  value,
  onChange,
  colorFn,
}: {
  options: { value: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
  colorFn?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        const color = colorFn?.(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start rounded-lg px-4 py-2.5 text-left transition-all duration-150 active:scale-95",
              active
                ? (color ?? "bg-brand text-white")
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            <span className="text-xs font-bold leading-none">{opt.label}</span>
            {opt.desc && (
              <span
                className={cn(
                  "mt-1 text-xs leading-none",
                  active ? "text-white/70" : "text-slate-400",
                )}
              >
                {opt.desc}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ReportAddPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [address, setAddress] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 1
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // step 2
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drainage, setDrainage] = useState<DrainageQuality>("SEDANG");
  const [garbage, setGarbage] = useState<GarbageCategory>("RINGAN");
  const [road, setRoad] = useState<RoadType>("ASPAL");
  const [vegetation, setVegetation] = useState<VegetationDensity>("SEDANG");

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=address,poi,neighborhood`,
          );
          const data = await res.json();
          if (data.features?.length) {
            setAddress(data.features[0].place_name);
            const mainPlace = data.features[0].text;
            setTitle(`Potensi Banjir di ${mainPlace}`);
          }
        } catch {
          setAddress("Lokasi tidak ditemukan");
        }
      },
      () => setError("Izin lokasi diperlukan untuk membuat laporan."),
    );
  }, []);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
    // reset input
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!user || !coords) return;
    if (!title.trim()) {
      setError("Judul laporan wajib diisi");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("latitude", coords.lat.toString());
      formData.append("longitude", coords.lng.toString());
      formData.append("address", address || "Lokasi tidak diketahui");
      formData.append("title", title);
      formData.append("description", description);
      formData.append("drainageQuality", drainage);
      formData.append("garbageCategory", garbage);
      formData.append("roadType", road);
      formData.append("vegetationDensity", vegetation);
      photos.forEach((file) => {
        formData.append("photos", file);
      });

      const res = await fetch(`/api/report/add?firebaseUID=${user.uid}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim laporan");
      router.push(`/report/${data.reportId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) return null;
  if (!user) {
    router.push("/auth/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="px-5 pt-6 pb-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => (step === 2 ? setStep(1) : router.back())}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {step === 1 ? "Buat Laporan" : "Lengkapi Detail"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 1
                  ? "Unggah foto kondisi area"
                  : "Isi informasi laporan"}
              </p>
            </div>
          </div>
        </header>
        <div className="px-5 pt-3">
          <LocationIndicator
            latitude={coords?.lat ?? null}
            longitude={coords?.lng ?? null}
            address={address}
          />
        </div>

        <ReportBreadcrumbs currentStep={step} />

        <main className="flex-1 px-5 pt-6 pb-36 overflow-y-auto">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg bg-red-50 p-4 border border-red-100">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="flex-1 text-xs font-semibold text-red-600 leading-relaxed">
                {error}
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="relative group">
                <div className="flex flex-col items-center justify-center gap-2 rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 px-6">
                  <div className="flex items-center justify-center">
                    <Camera size={32} className="text-slate-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-sm text-slate-900">
                      Unggah Foto Lokasi
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400 max-w-[200px]">
                      Ambil foto langsung atau pilih dari galeri untuk analisis
                      FRI
                    </p>
                  </div>
                  <div className="flex gap-3 w-full max-w-[280px] font-semibold mt-4">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand py-3.5 text-xs text-white"
                    >
                      <Camera size={16} />
                      Ambil Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white py-3.5 text-xs text-slate-600 border border-slate-200"
                    >
                      <Upload size={16} />
                      Upload Galeri
                    </button>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoAdd}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoAdd}
                className="hidden"
              />

              {previews.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold   text-slate-400">
                    Preview Foto ({previews.length})
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {previews.map((url, i) => (
                      <div
                        key={url}
                        className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 border border-slate-100 shadow-sm"
                      >
                        <img
                          src={url}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white backdrop-blur-md"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <SectionLabel icon={FileText} label="Informasi Laporan" />

                <div className="space-y-1.5">
                  <label
                    htmlFor="report-title"
                    className="text-xs font-bold text-slate-400 ml-1 "
                  >
                    Judul
                  </label>
                  <input
                    id="report-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Banjir setinggi 30cm di Jl. Cibadak"
                    className="mt-3 w-full rounded-lg border-2 border-slate-100 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand-500 focus:bg-white placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="report-description"
                    className="text-xs font-bold text-slate-400 ml-1 mb-2"
                  >
                    Catatan Tambahan
                  </label>
                  <textarea
                    id="report-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Jelaskan kondisi terkini secara detail..."
                    className="mt-3 w-full resize-none rounded-lg border-2 border-slate-100 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-brand-500 focus:bg-white placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* divider */}
              <div className="h-px bg-slate-100" />

              {/* kualitas drainase */}
              <div>
                <SectionLabel icon={Droplets} label="Kualitas Drainase" />
                <ChipSelector
                  options={DRAINAGE_OPTIONS}
                  value={drainage}
                  onChange={setDrainage}
                  colorFn={(v) =>
                    ({
                      BAIK: "bg-green-500 text-white",
                      SEDANG: "bg-amber-500 text-white",
                      BURUK: "bg-orange-500 text-white",
                      TIDAK_ADA: "bg-red-500 text-white",
                    })[v]
                  }
                />
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <SectionLabel icon={Trash2} label="Kepadatan Sampah" />
                <ChipSelector
                  options={GARBAGE_OPTIONS}
                  value={garbage}
                  onChange={setGarbage}
                  colorFn={(v) =>
                    ({
                      SEDANG: "bg-orange-500 text-white",
                      BANYAK: "bg-red-500 text-white",
                      RINGAN: "bg-amber-400 text-white",
                      TIDAK_ADA: "bg-green-500 text-white",
                    })[v]
                  }
                />
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <SectionLabel icon={Car} label="Jenis Jalan" />
                <ChipSelector
                  options={ROAD_OPTIONS}
                  value={road}
                  onChange={setRoad}
                />
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <SectionLabel icon={TreePine} label="Kepadatan Vegetasi" />
                <ChipSelector
                  options={VEGETATION_OPTIONS}
                  value={vegetation}
                  onChange={setVegetation}
                  colorFn={(v) =>
                    ({
                      TIDAK_ADA: "bg-red-500 text-white",
                      RINGAN: "bg-orange-500 text-white",
                      SEDANG: "bg-amber-400 text-white",
                      BANYAK: "bg-green-500 text-white",
                    })[v]
                  }
                />
              </div>

              {previews.length > 0 && (
                <>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <SectionLabel
                      icon={Camera}
                      label={`Foto Terlampir (${previews.length})`}
                    />
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {previews.map((url, i) => (
                        <div
                          key={url}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                        >
                          <img
                            src={url}
                            alt={`foto-${i}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white px-5 py-4">
          <div
            className={cn(
              "flex items-center",
              step === 1 ? "justify-end" : "justify-between",
            )}
          >
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border-2 border-slate-100 py-3 px-12 text-sm text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
              >
                Sebelumnya
              </button>
            )}

            <button
              type="button"
              onClick={step === 1 ? () => setStep(2) : handleSubmit}
              disabled={isSubmitting || (step === 1 && photos.length === 0)}
              className="flex items-center justify-center gap-2 rounded-lg py-3 px-12 text-sm bg-brand text-white font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Mengirim...</span>
                </>
              ) : step === 1 ? (
                <span>Lanjut</span>
              ) : (
                <>
                  <span>Submit</span>
                  <Send size={18} />
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
