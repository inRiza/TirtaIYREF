import { cn } from "@/lib/utils";

export function ReportCardOverlaySkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 w-44 h-52 rounded-3xl bg-slate-100 animate-pulse relative overflow-hidden",
        className,
      )}
    />
  );
}

export function ReportCardRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl bg-white p-3 border animate-pulse relative",
        className,
      )}
    >
      <div className="h-16 w-16 rounded-lg bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-20 bg-slate-200 rounded" />
        <div className="h-4 w-3/4 bg-slate-200 rounded" />
        <div className="h-3 w-1/2 bg-slate-200 rounded" />
      </div>
      <div className="absolute top-3 right-3 h-5 w-12 bg-slate-200 rounded-sm" />
    </div>
  );
}
