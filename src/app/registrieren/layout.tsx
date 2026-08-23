import { redirectIfAuthenticated } from "@/lib/auth/redirect-if-authenticated";

export default async function RegistrierenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfAuthenticated();
  return children;
}
