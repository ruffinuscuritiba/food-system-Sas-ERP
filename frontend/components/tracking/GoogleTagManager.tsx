"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: any[];
  }
}

interface GoogleTagManagerProps {
  containerId: string;
}

/** Injeta o container GTM (head script + dataLayer). O noscript de fallback
 *  (<iframe>) é renderizado separado, logo no topo do <body> — ver
 *  GoogleTagManagerNoScript abaixo. */
export function GoogleTagManager({ containerId }: GoogleTagManagerProps) {
  useEffect(() => {
    if (!containerId || document.getElementById("gtm-script")) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

    const script = document.createElement("script");
    script.id = "gtm-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
    document.head.appendChild(script);
  }, [containerId]);

  return null;
}

export function GoogleTagManagerNoScript({ containerId }: GoogleTagManagerProps) {
  if (!containerId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
