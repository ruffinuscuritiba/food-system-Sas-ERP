"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

interface MetaPixelProps {
  pixelId: string;
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  useEffect(() => {
    if (!pixelId || window.fbq) return;

    // Initialize fbq
    const fbq: any = function (...args: any[]) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    // Inject script
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
  }, [pixelId]);

  return null;
}

export function trackPixelPurchase(value: number, currency = "BRL") {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Purchase", { value, currency });
  }
}

export function trackPixelAddToCart(value: number, productName: string) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "AddToCart", { value, currency: "BRL", content_name: productName });
  }
}
