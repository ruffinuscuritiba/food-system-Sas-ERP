import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "FoodSaaS ERP - Demonstrações",
  description:
    "Teste gratuitamente as versões Basic, Pro e Enterprise do FoodSaaS ERP.",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
