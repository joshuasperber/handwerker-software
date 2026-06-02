import { redirect } from "next/navigation";

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/buchen/${slug}`);
}
