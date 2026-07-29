"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { Plus } from "lucide-react";

export type ProjectOption = {
  id: string;
  name: string;
  status: string;
  customerId?: string;
};

type Props = {
  customerId: string | null;
  value: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
  /** Wenn true: neues Projekt mit aktuellem Kunden anlegen */
  allowCreate?: boolean;
  className?: string;
  label?: string;
};

export function ProjectAssignField({
  customerId,
  value,
  onChange,
  disabled,
  allowCreate = true,
  className,
  label = "Projekt (optional)",
}: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const loadProjects = useCallback(async () => {
    if (!customerId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    const res = await fetchJson<ProjectOption[]>(`/api/projects?customerId=${customerId}`);
    setLoading(false);
    if (res.success && res.data) {
      setProjects(
        res.data.filter((p) => p.status !== "STORNIERT")
      );
    }
  }, [customerId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function createProject() {
    if (!customerId || !newName.trim()) return;
    setCreating(true);
    const res = await saveJson<ProjectOption>(
      "/api/projects",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), customerId }),
      },
      { success: "Projekt angelegt" }
    );
    setCreating(false);
    if (res.success && res.data) {
      setProjects((prev) => [res.data!, ...prev]);
      onChange(res.data.id);
      setNewName("");
      setShowCreate(false);
    }
  }

  return (
    <div className={className}>
      <label className="text-sm font-medium">{label}</label>
      <select
        className="mt-1 h-10 w-full rounded-lg border px-3 text-sm disabled:opacity-60"
        value={value}
        disabled={disabled || !customerId || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Kein Projekt</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {!customerId && (
        <p className="mt-1 text-xs text-slate-400">Bitte zuerst einen Kunden wählen.</p>
      )}
      {allowCreate && customerId && (
        <div className="mt-2">
          {!showCreate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Neues Projekt anlegen
            </Button>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <Input
                  label="Projektname"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z. B. Hausbau Friedrichstraße"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={creating || !newName.trim()}
                onClick={() => void createProject()}
              >
                {creating ? "…" : "Anlegen"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
              >
                Abbrechen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
