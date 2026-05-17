/** Wizard step 2 — pick test-target platform and app identifier (WAVAAAA-53). */

import { useCallback, useRef, useState } from "react";

export interface PlatformTarget {
  platform: "ios" | "android" | null;
  identifier: string;
  file: File | null;
}

interface Props {
  value: PlatformTarget;
  onChange: (next: PlatformTarget) => void;
}

const ACCEPT = { ios: ".ipa", android: ".apk" } as const;

const META = {
  ios: { idLabel: "Bundle ID", placeholder: "com.example.myapp" },
  android: { idLabel: "App ID", placeholder: "com.example.myapp" },
} as const;

export function Step2PlatformCard({ value, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setPlatform = useCallback((p: "ios" | "android") => {
    if (p === value.platform) return;
    // Switching platform clears identifier and file.
    onChange({ platform: p, identifier: "", file: null });
  }, [value.platform, onChange]);

  const setIdentifier = useCallback((identifier: string) => {
    onChange({ ...value, identifier });
  }, [value, onChange]);

  const acceptFile = useCallback((f: File) => {
    if (!value.platform) return;
    if (!f.name.toLowerCase().endsWith(ACCEPT[value.platform])) return;
    onChange({ ...value, file: f });
  }, [value, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, [acceptFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    e.target.value = "";
  }, [acceptFile]);

  const meta = value.platform ? META[value.platform] : null;
  const ext = value.platform ? ACCEPT[value.platform] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Platform toggle */}
      <div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: "0.6rem" }}>Platform</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["ios", "android"] as const).map((p) => {
            const active = value.platform === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                style={{
                  flex: 1,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: active ? "var(--surface-2)" : "transparent",
                  color: "var(--text)",
                  borderRadius: 8,
                  padding: "0.6rem 1rem",
                  fontWeight: active ? 700 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              >
                {p === "ios" ? "iOS" : "Android"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Platform-specific fields */}
      {meta && ext && (
        <>
          {/* Identifier field */}
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
              {meta.idLabel}
              <span style={{ color: "var(--warning)", marginLeft: "0.3rem", fontSize: 12 }}>*</span>
            </div>
            <input
              type="text"
              value={value.identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={meta.placeholder}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </label>

          {/* Drop zone */}
          <div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: "0.5rem" }}>
              App binary <span style={{ fontSize: 12 }}>(optional {ext})</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `1px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8,
                padding: "1.25rem",
                textAlign: "center",
                cursor: "pointer",
                background: dragging
                  ? "color-mix(in srgb, var(--accent) 5%, transparent)"
                  : "var(--surface)",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              {value.file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: 13 }}>📎 {value.file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange({ ...value, file: null }); }}
                    className="secondary"
                    style={{ fontSize: 11, padding: "0.2rem 0.5rem" }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="text-dim" style={{ fontSize: 13 }}>
                  Drop {ext} here or{" "}
                  <span style={{ color: "var(--accent)" }}>browse</span>
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ext}
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
          </div>
        </>
      )}

      {/* Help text */}
      <p className="text-dim" style={{ fontSize: 13, margin: 0, fontStyle: "italic" }}>
        This is the app we will run your smoke tests against. You can change it later.
      </p>
    </div>
  );
}
