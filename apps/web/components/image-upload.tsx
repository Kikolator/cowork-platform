"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { processImage } from "@/lib/image-processing";
import { CropDialog, type CropConfig } from "@/components/crop-dialog";

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
  crop?: CropConfig;
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
  crop,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const acceptTypes = accept.split(",").map((t) => t.trim());
  const isVector = (type: string) =>
    type === "image/svg+xml" ||
    type === "image/svg" ||
    type === "image/x-icon" ||
    type === "image/vnd.microsoft.icon";

  async function handleFile(file: File) {
    setError(null);

    // Validate MIME type
    if (!acceptTypes.includes(file.type)) {
      setError(
        `Unsupported file type. Use ${accept.replace(/image\//g, "").replace(/,/g, ", ").toUpperCase()}.`,
      );
      return;
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    let fileToUpload = file;

    if (isVector(file.type)) {
      // Vectors can't be processed via Canvas — enforce size limit directly
      if (file.size > maxBytes) {
        setError(`File is too large. Maximum size is ${maxSizeMb}MB.`);
        return;
      }
    } else {
      // Raster images: auto-resize and compress to fit limits
      try {
        fileToUpload = await processImage(file, maxWidth, maxHeight, maxBytes);
      } catch {
        setError("Could not process image. Try a different file.");
        return;
      }
    }

    // Upload
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = fileToUpload.name.split(".").pop() ?? "webp";
      const path = `${spaceId}/${pathPrefix}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, fileToUpload, { upsert: false });

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
    if (!file) return;

    // If crop is enabled and file is a raster image, open crop dialog
    if (crop && !isVector(file.type)) {
      setPendingFile(file);
    } else {
      void handleFile(file);
    }

    // Reset input so re-selecting the same file triggers onChange
    if (inputRef.current) inputRef.current.value = "";
  }

  const defaultHint = `PNG, JPG, WebP or SVG. Images are auto-resized to ${maxWidth}\u00D7${maxHeight}px.`;

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

      {/* Crop dialog */}
      {crop && (
        <CropDialog
          open={!!pendingFile}
          file={pendingFile}
          config={crop}
          onConfirm={(croppedFile) => {
            setPendingFile(null);
            void handleFile(croppedFile);
          }}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  );
}
