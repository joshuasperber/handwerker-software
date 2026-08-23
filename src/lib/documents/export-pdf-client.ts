export type PdfSource = "snapshot" | "current";

export async function fetchDocumentPdf(
  documentId: string,
  options: { download?: boolean; source?: PdfSource; save?: boolean } = {}
): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();
  if (options.download) params.set("download", "1");
  if (options.source === "current") params.set("source", "current");
  if (options.save) params.set("save", "1");
  const qs = params.toString();
  const res = await fetch(`/api/documents/${documentId}/pdf${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "PDF konnte nicht erzeugt werden");
  }
  const blob = await res.blob();
  const headerName = res.headers.get("X-Document-Filename");
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  return { blob, filename: headerName || match?.[1] || "rechnung.pdf" };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
