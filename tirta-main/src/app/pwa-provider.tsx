"use client";

import { useEffect } from "react";

export function PWAProvider() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
    }

    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement("meta");
      viewport.name = "viewport";
      viewport.content =
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no";
      document.head.appendChild(viewport);
    }

    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      themeColor.content = "#000000";
      document.head.appendChild(themeColor);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const appleMobile = document.createElement("meta");
      appleMobile.name = "apple-mobile-web-app-capable";
      appleMobile.content = "yes";
      document.head.appendChild(appleMobile);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const appleStatusBar = document.createElement("meta");
      appleStatusBar.name = "apple-mobile-web-app-status-bar-style";
      appleStatusBar.content = "black-translucent";
      document.head.appendChild(appleStatusBar);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const appleTitle = document.createElement("meta");
      appleTitle.name = "apple-mobile-web-app-title";
      appleTitle.content = "Tirta App";
      document.head.appendChild(appleTitle);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleTouchIcon = document.createElement("link");
      appleTouchIcon.rel = "apple-touch-icon";
      appleTouchIcon.href = "/icon-192x192.png";
      document.head.appendChild(appleTouchIcon);
    }
  }, []);

  return null;
}
