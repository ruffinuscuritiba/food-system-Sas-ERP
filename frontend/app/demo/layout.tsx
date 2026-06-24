import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "R_FoodSaaS ERP | Demonstrações",
  description:
    "Teste gratuitamente os planos Basic, Pro e Enterprise do R_FoodSaaS ERP.",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
