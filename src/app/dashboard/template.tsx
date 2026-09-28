import type { ReactNode } from "react";

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="app-route-transition">{children}</div>;
}
