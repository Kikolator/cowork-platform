"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

interface ImageUploadProps {
  currentUrl: string | null;
  spaceId: string;
  bucket: string;
  pathPrefix: string;
  onUploaded: (publicUrl: string) => void;
  onCleared?: () => void;
  label: string;
  accept?: string;
  maxSizeMb?: number;
  maxWidth?: number;
  maxHeight?: number;
  hint?: string;
  previewClassName?: string;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "png" : filename.slice(dot + 1).toLowerCase();
}

function loadImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function ImageUpload({
  currentUrl,
  spaceId,
  bucket,
  pathPrefix,
  onUploaded,
  onCleared,
  label,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = 2,
  maxWidth = 512,
  maxHeight = 512,
  hint,
  previewClassName = "h-16 w-auto",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptTypes = accept.split(",").map((t) => t.trim());
  const isSvg = (type: string) =>
    type === "image/svg+xml" || type === "image/svg";

  async function handleFile(file: File) {
    setError(null);

    // Validate MIME type
    if (!acceptTypes.includes(file.type)) {
      setError(
        `Unsupported file type. Use ${accept.replace(/image\//g, "").replace(/,/g, ", ").toUpperCase()}.`,
      );
      return;
    }

    // Validate file size
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File is too large. Maximum size is ${maxSizeMb}MB.`);
      return;
    }

    // Validate dimensions (skip for SVG — vector format)
    if (!isSvg(file.type)) {
      try {
        const { width, height } = await loadImageDimensions(file);
        if (width > maxWidth || height > maxHeight) {
          setError(
            `Image is too large. Maximum dimensions are ${maxWidth}\u00D7${maxHeight}px.`,
          );
          return;
        }
      } catch {
        setError("Could not read image dimensions.");
        return;
      }
    }

    // Upload
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = getExtension(file.name);
      const path = `${spaceId}/${pathPrefix}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      onUploaded(publicUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  const defaultHint = `PNG, JPG, WebP or SVG. Max ${maxSizeMb}MB, ${maxWidth}\u00D7${maxHeight}px.`;

  return (
    <div className="space-y-2">
      {/* Preview */}
      {currentUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={label}
            className={`rounded border object-contain ${previewClassName}`}
          />
          {onCleared && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onCleared()}
              aria-label={`Remove ${label}`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded border border-dashed text-muted-foreground ${previewClassName}`}
          style={{ minHeight: "4rem", minWidth: "4rem" }}
        >
          <Upload className="h-5 w-5" />
        </div>
      )}

      {/* Upload button */}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : currentUrl ? (
            `Replace ${label}`
          ) : (
            `Upload ${label}`
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onChange}
        />
      </div>

      {/* Hint text */}
      <p className="text-xs text-muted-foreground">{hint ?? defaultHint}</p>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
