"use client";

import { useEffect } from "react";

function setFavicon(url) {
  if (!url) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = `${url}${url.includes("?") ? "&" : "?"}favicon=${Date.now()}`;
}

export default function DynamicFavicon() {
  useEffect(() => {
    let mounted = true;
    const readLocal = () => {
      try { setFavicon(JSON.parse(window.localStorage.getItem("nail-japan-settings") || "{}").logoUrl); } catch {}
    };
    const readServer = async () => {
      try {
        const response = await fetch("/api/settings?public=1", { cache: "no-store" });
        const result = await response.json();
        if (mounted && result.value?.logoUrl) setFavicon(result.value.logoUrl);
      } catch {}
    };
    readLocal();
    readServer();
    window.addEventListener("nail-japan-settings-updated", readLocal);
    return () => { mounted = false; window.removeEventListener("nail-japan-settings-updated", readLocal); };
  }, []);
  return null;
}
