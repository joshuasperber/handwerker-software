"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Camera,
  ImagePlus,
  Loader2,
  Trash2,
  FileText,
  Calendar,
  User as UserIcon,
  Download,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { compressImage } from "@/lib/image-compression";
import {
  PHOTO_CATEGORIES,
  fileCategoryLabel,
  formatBytes,
} from "@/lib/files";
import { formatDateTime } from "@/lib/utils";

export interface PhotoFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  description: string | null;
  orderPhaseId: string | null;
  createdAt: string;
  url: string | null;
  uploadedBy?: { firstName: string; lastName: string } | null;
}

interface PhotoGalleryProps {
  /** Basis-URL der Datei-API, z. B. `/api/orders/123/files`. */
  baseUrl: string;
  /** Darf der/die Nutzer:in Fotos hochladen? */
  canUpload?: boolean;
  /** Darf der/die Nutzer:in Fotos löschen? */
  canDelete?: boolean;
  /** Auswählbare Phasen (optionale Zuordnung). */
  phases?: { id: string; name: string }[];
  /** Wenn gesetzt, werden nur Fotos dieser Phase angezeigt und neue Uploads ihr zugeordnet. */
  fixedPhaseId?: string;
  /** Kompakte Darstellung (z. B. innerhalb einer Phase oder auf Mobile). */
  compact?: boolean;
  /** Callback nach Upload/Löschen (z. B. um Eltern-Ansicht zu aktualisieren). */
  onChanged?: () => void;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function PhotoGallery({
  baseUrl,
  canUpload = false,
  canDelete = false,
  phases = [],
  fixedPhaseId,
  compact = false,
  onChanged,
}: PhotoGalleryProps) {
  const [files, setFiles] = useState<PhotoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>(PHOTO_CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [phaseId, setPhaseId] = useState<string>(fixedPhaseId ?? "");
  const [filter, setFilter] = useState<string>("ALL");
  const [lightbox, setLightbox] = useState<PhotoFile | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const listUrl = fixedPhaseId
    ? `${baseUrl}?orderPhaseId=${fixedPhaseId}`
    : baseUrl;

  const load = useCallback(() => {
    return fetchJson<PhotoFile[]>(listUrl)
      .then((d) => {
        if (d.success && d.data) setFiles(d.data);
      })
      .finally(() => setLoading(false));
  }, [listUrl]);

  useEffect(() => {
    let active = true;
    fetchJson<PhotoFile[]>(listUrl)
      .then((d) => {
        if (active && d.success && d.data) setFiles(d.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [listUrl]);

  async function handleSelected(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setError(null);
    setUploading(true);

    const list = Array.from(selected);
    setProgress({ done: 0, total: list.length });

    try {
      const fd = new FormData();
      fd.append("category", category);
      if (description.trim()) fd.append("description", description.trim());
      const effectivePhase = fixedPhaseId ?? phaseId;
      if (effectivePhase) fd.append("orderPhaseId", effectivePhase);

      for (let i = 0; i < list.length; i++) {
        const compressed = await compressImage(list[i]);
        fd.append("file", compressed, compressed.name);
        setProgress({ done: i + 1, total: list.length });
      }

      const res = await fetch(baseUrl, { method: "POST", body: fd });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        toast.success(
          list.length > 1 ? `${list.length} Fotos hochgeladen` : "Foto hochgeladen"
        );
        setDescription("");
        load();
        onChanged?.();
      } else {
        const msg = data?.error ?? `Upload fehlgeschlagen (HTTP ${res.status})`;
        setError(msg);
        toast.error("Upload fehlgeschlagen", { description: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler beim Upload";
      setError(msg);
      toast.error("Upload fehlgeschlagen", { description: msg });
    } finally {
      setUploading(false);
      setProgress(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function handleDelete(file: PhotoFile) {
    const res = await fetch(`${baseUrl}/${file.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Foto gelöscht");
      setLightbox(null);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      onChanged?.();
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  const visibleFiles =
    filter === "ALL" ? files : files.filter((f) => f.category === filter);

  const phaseNameById = new Map(phases.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                {PHOTO_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {!fixedPhaseId && phases.length > 0 && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Phase (optional)
                </label>
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                >
                  <option value="">— Keine Phase —</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Beschreibung / Notiz (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z. B. Wasserschaden Decke Bad"
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Kamera: nimmt auf Mobilgeräten direkt ein Foto auf. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleSelected(e.target.files)}
            />
            {/* Galerie: Mehrfachauswahl, auch PDFs. */}
            <input
              ref={galleryRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleSelected(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={uploading}
              onClick={() => cameraRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              <span className="ml-1">Foto aufnehmen</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              <span className="ml-1">Aus Galerie</span>
            </Button>
            {progress && (
              <span className="text-xs text-slate-500">
                Verarbeite {progress.done}/{progress.total}…
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Bilder werden vor dem Upload automatisch komprimiert. Max. {formatBytes(15 * 1024 * 1024)} pro Datei.
          </p>

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>
      )}

      {/* Kategorie-Filter (nur wenn nicht auf eine Phase fixiert und mehrere vorhanden) */}
      {!fixedPhaseId && files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Alle"
            active={filter === "ALL"}
            onClick={() => setFilter("ALL")}
          />
          {Array.from(new Set(files.map((f) => f.category))).map((cat) => (
            <FilterChip
              key={cat}
              label={fileCategoryLabel(cat)}
              active={filter === cat}
              onClick={() => setFilter(cat)}
            />
          ))}
        </div>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Fotos werden geladen…
        </p>
      ) : visibleFiles.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Fotos oder Dateien.</p>
      ) : (
        <div
          className={`grid gap-2 ${
            compact
              ? "grid-cols-3 sm:grid-cols-4"
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
          }`}
        >
          {visibleFiles.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setLightbox(file)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left"
              title={file.description ?? file.fileName}
            >
              {isImage(file.mimeType) && file.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.url}
                  alt={file.description ?? file.fileName}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : isImage(file.mimeType) && !file.url ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-center text-[10px] leading-tight">Speicher nicht verfügbar</span>
                </span>
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-slate-400">
                  <FileText className="h-6 w-6" />
                  <span className="line-clamp-2 text-center text-[10px] leading-tight">
                    {file.fileName}
                  </span>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {fileCategoryLabel(file.category)}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl">
          {lightbox && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 break-all">
                  {lightbox.description || lightbox.fileName}
                </DialogTitle>
              </DialogHeader>

              <div className="flex max-h-[60vh] items-center justify-center overflow-auto rounded-lg bg-slate-100">
                {isImage(lightbox.mimeType) && lightbox.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightbox.url}
                    alt={lightbox.description ?? lightbox.fileName}
                    className="max-h-[60vh] w-auto object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8 text-slate-500">
                    <FileText className="h-12 w-12" />
                    <span className="text-sm">{lightbox.fileName}</span>
                  </div>
                )}
              </div>

              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {fileCategoryLabel(lightbox.category)}
                  </span>
                  {lightbox.orderPhaseId && phaseNameById.get(lightbox.orderPhaseId) && (
                    <span className="inline-flex items-center rounded-full bg-[#0d5c63]/10 px-2 py-0.5 text-xs font-medium text-[#0d5c63]">
                      {phaseNameById.get(lightbox.orderPhaseId)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar className="h-4 w-4" />
                  {formatDateTime(lightbox.createdAt)}
                </div>
                {lightbox.uploadedBy && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <UserIcon className="h-4 w-4" />
                    {lightbox.uploadedBy.firstName} {lightbox.uploadedBy.lastName}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  {lightbox.fileName} · {formatBytes(lightbox.sizeBytes)}
                </div>
              </dl>

              <div className="flex flex-wrap justify-end gap-2">
                {lightbox.url && (
                  <a href={lightbox.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-1" /> Öffnen
                    </Button>
                  </a>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(lightbox)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Löschen
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-[#0d5c63] bg-[#0d5c63]/10 text-[#0d5c63]"
          : "border-slate-200 text-slate-500 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
