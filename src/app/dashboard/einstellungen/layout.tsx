import { SettingsSubnav } from "@/components/dashboard/settings-subnav";

export default function EinstellungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SettingsSubnav />
      {children}
    </div>
  );
}
