import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportBreadcrumbsProps {
  currentStep: 1 | 2;
}

export function ReportBreadcrumbs({ currentStep }: ReportBreadcrumbsProps) {
  const steps = [
    { id: 1, label: "Foto Laporan" },
    { id: 2, label: "Detail Laporan" },
  ];

  return (
    <div className="flex items-center justify-center py-6">
      <div className="flex items-center w-full max-w-80">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="flex flex-1 items-center last:flex-none"
          >
            <div className="flex flex-col items-center relative">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  currentStep === step.id
                    ? "bg-brand text-white"
                    : currentStep > step.id
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-400",
                )}
              >
                {currentStep > step.id ? <Check size={16} /> : step.id}
              </div>
              <span
                className={cn(
                  "absolute -bottom-6 whitespace-nowrap text-xs font-bold",
                  currentStep >= step.id ? "text-brand" : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="mx-2 h-1 flex-1 bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    "h-full bg-brand transition-all duration-500",
                    currentStep > step.id ? "w-full" : "w-0",
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
