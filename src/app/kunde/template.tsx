import type { ReactNode } from "react";

export default function CustomerTemplate({ children }: { children: ReactNode }) {
  return <div className="app-route-transition">{children}</div>;
}
