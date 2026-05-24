"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

interface GoogleAnalyticsProps {
  gaId: string;
}

export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps) {
  useEffect(() => {
    if (!gaId || document.getElementById("ga-script")) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", gaId);

    const script = document.createElement("script");
    script.id = "ga-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);
  }, [gaId]);

  return null;
}

export function trackGAPurchase(
  orderId: string,
  total: number,
  items: Array<{ name: string; price: number; quantity: number }>,
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: orderId,
      value: total,
      currency: "BRL",
      items: items.map((i, idx) => ({
        item_id: String(idx),
        item_name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
    });
  }
}

export function trackGAAddToCart(productName: string, price: number) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "add_to_cart", {
      currency: "BRL",
      value: price,
      items: [{ item_name: productName, price, quantity: 1 }],
    });
  }
}
