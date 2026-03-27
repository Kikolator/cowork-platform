export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Crop a region from an image file using Canvas drawImage source coordinates.
 * Returns a new File containing the cropped region at full resolution.
 */
export async function cropImage(file: File, area: CropArea): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    const canvas = document.createElement("canvas");
    canvas.width = area.width;
    canvas.height = area.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(
      img,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      area.width,
      area.height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/webp", 0.95),
    );
    if (!blob) throw new Error("Failed to crop image");
    const ext = blob.type === "image/png" ? "png" : "webp";
    return new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), {
      type: blob.type,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Resize and compress a raster image to fit within maxWidth×maxHeight
 * and maxBytes. Uses Canvas API with WebP output for best compression.
 * Progressively lowers quality until the file fits.
 */
export async function processImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  maxBytes: number,
): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let { naturalWidth: w, naturalHeight: h } = img;

    // Scale down to fit within max dimensions (preserve aspect ratio)
    if (w > maxWidth || h > maxHeight) {
      const scale = Math.min(maxWidth / w, maxHeight / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);

    // Try WebP at decreasing quality until under maxBytes
    const qualities = [0.9, 0.8, 0.7, 0.5, 0.3];
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob && blob.size <= maxBytes) {
        return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
          type: "image/webp",
        });
      }
    }

    // Final fallback: already at lowest quality, use whatever we got
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.2),
    );
    if (!blob) throw new Error("Failed to compress image");
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
