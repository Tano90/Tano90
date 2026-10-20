"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type RowError = { row: number; message: string };

type Props = {
  label: string;
  accept?: string;
  maxBytes?: number;
  state?: "idle" | "uploading" | "done";
  errors?: RowError[];
  /** What kind of file, e.g. "CSV"; shown in the hint under the label. */
  formats?: string;
  onFile: (file: File) => void;
};

/** Drop zone that is also a real file input, so keyboard and screen readers work. */
export function FileUpload({ label, accept = ".xlsx,.csv", maxBytes = 10 * 1024 * 1024, state = "idle", errors = [], formats = "Excel oder CSV", onFile }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [tooBig, setTooBig] = useState(false);

  const take = (file?: File) => {
    if (!file) return;
    setTooBig(file.size > maxBytes);
    if (file.size <= maxBytes) onFile(file);
  };
  // A file picked before the page finished loading fired its change event before React was listening.
  useEffect(() => {
    take(input.current?.files?.[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-border-input p-6 text-center",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus-ring",
          over && "border-accent bg-accent-subtle",
        )}
      >
        {state === "uploading" ? <Spinner className="size-6" label="Wird hochgeladen" /> : <Upload aria-hidden className="size-6 text-text-muted" />}
        <span className="font-semibold">{label}</span>
        <span className="text-xs font-normal text-text-muted">Datei hierher ziehen oder klicken · {formats}, max. {Math.round(maxBytes / 1024 / 1024)} MB</span>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={state === "uploading"}
          onChange={(e) => take(e.target.files?.[0])}
        />
      </label>
      {tooBig && <p role="alert" className="text-xs text-danger">Die Datei ist zu groß.</p>}
      {state === "done" && errors.length === 0 && (
        <p role="status" className="flex items-center gap-2 text-success"><FileSpreadsheet aria-hidden className="size-4" /> Import abgeschlossen, keine Fehler.</p>
      )}
      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-danger bg-danger-subtle p-3">
          <p className="font-semibold text-danger">{errors.length} Zeilen konnten nicht übernommen werden</p>
          <ul className="mt-2 flex flex-col gap-1 text-text">
            {errors.slice(0, 20).map((e) => (
              <li key={e.row}><span className="num font-semibold">Zeile {e.row}:</span> {e.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
