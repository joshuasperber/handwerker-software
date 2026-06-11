"use client";

import { useEffect } from "react";

/**
 * Fängt Fehler ab, die im Root-Layout selbst auftreten (wo die normale
 * error.tsx nicht greift). Muss eigene <html>/<body>-Tags rendern.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Schwerwiegender Fehler (Root):", error);
  }, [error]);

  return (
    <html lang="de">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              background: "#fff",
              borderRadius: 12,
              padding: "2rem",
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#0f172a" }}>
              Es ist ein schwerwiegender Fehler aufgetreten.
            </h1>
            <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#64748b" }}>
              Bitte laden Sie die Anwendung neu.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 24,
                padding: "0.5rem 1.25rem",
                borderRadius: 8,
                border: "none",
                background: "#0d5c63",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
