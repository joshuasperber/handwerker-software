import { SpecViewer } from "@/components/docs/spec-viewer";
import { specBetriebssystemV1 } from "@/data/spec-betriebssystem-v1";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Produktkonzept v1.0 – Handwerker Betriebssystem",
  description:
    "Spezifikationsanalyse für Baudienstleister, Innenausbau und vorbereitete Elektro-Erweiterung",
};

export default function BetriebssystemSpecPage() {
  return <SpecViewer doc={specBetriebssystemV1} />;
}
