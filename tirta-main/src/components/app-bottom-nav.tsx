"use client";

import { Clock, Home, MapPin } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function AppBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const items = [
    {
      key: "home",
      label: "Home",
      path: "/home",
      icon: Home,
    },
    {
      key: "map",
      label: "Map",
      path: "/map",
      icon: MapPin,
    },
    {
      key: "history",
      label: "History",
      path: "/history",
      icon: Clock,
    },
  ];
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.path === pathname),
  );
  const baseButton =
    "flex flex-1 flex-col items-center gap-1.5 rounded-xl py-2 transition-colors";
  const inactiveButton =
    "text-slate-500 hover:bg-slate-50 hover:text-brand-600";
  const activeButton = "text-brand-600";
  const raisedButton = "relative -mt-5";
  const baseMapBubble =
    "flex h-12 w-12 items-center justify-center rounded-full shadow-md ring-4 ring-white";

  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 w-full">
      <div className="relative mx-auto flex w-full max-w-md items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-2.5 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur md:rounded-t-2xl">
        <div className="pointer-events-none absolute inset-x-2 bottom-1 h-1">
          <div
            className="h-full w-1/3 rounded-full bg-brand transition-transform duration-300"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        </div>

        {items.map((item) => {
          const isActive = item.path === pathname;
          const Icon = item.icon;
          const buttonClass = [
            baseButton,
            isActive ? activeButton : inactiveButton,
            item.key === "map" ? raisedButton : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={item.key}
              type="button"
              className={buttonClass}
              onClick={() => router.push(item.path)}
            >
              {item.key === "map" ? (
                <span
                  className={
                    isActive
                      ? `${baseMapBubble} bg-brand-600 text-white`
                      : `${baseMapBubble} bg-brand text-white`
                  }
                >
                  <Icon size={22} />
                </span>
              ) : (
                <Icon size={20} />
              )}
              <span className="text-[11px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
