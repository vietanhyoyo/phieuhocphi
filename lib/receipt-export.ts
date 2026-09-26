import { toCanvas } from "html-to-image";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read receipt image"));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read receipt image"));
    reader.readAsDataURL(blob);
  });
}

async function embedImage(image: HTMLImageElement) {
  await image.decode();
  const response = await fetch(image.currentSrc || image.src, { cache: "force-cache", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not load receipt image: ${response.status}`);
  return blobToDataUrl(await response.blob());
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode receipt image"));
    image.src = dataUrl;
  });
}

function clipRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.clip();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode receipt PNG")), "image/png");
  });
}

/** Render the actual receipt so preview and PNG always share one layout. */
export async function createReceiptPng(element: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const elementRect = element.getBoundingClientRect();
  const images = Array.from(element.querySelectorAll("img"));
  const imageLayers = await Promise.all(images.map(async (image) => {
    const rect = image.getBoundingClientRect();
    const style = window.getComputedStyle(image);
    const dataUrl = await embedImage(image);
    return {
      image: await loadImage(dataUrl),
      x: rect.left - elementRect.left,
      y: rect.top - elementRect.top,
      width: rect.width,
      height: rect.height,
      radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      objectFit: style.objectFit,
    };
  }));

  const canvas = await toCanvas(element, {
    pixelRatio: 3,
    backgroundColor: "#ffffff",
    preferredFontFormat: "woff2",
    style: { margin: "0", boxShadow: "none" },
  });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw receipt images");

  // Safari can omit <img> elements while rasterizing html-to-image's SVG.
  // Composite them directly onto the final canvas for reliable output.
  const scaleX = canvas.width / elementRect.width;
  const scaleY = canvas.height / elementRect.height;
  for (const layer of imageLayers) {
    const x = layer.x * scaleX;
    const y = layer.y * scaleY;
    const width = layer.width * scaleX;
    const height = layer.height * scaleY;
    const fitScale = layer.objectFit === "cover"
      ? Math.max(width / layer.image.naturalWidth, height / layer.image.naturalHeight)
      : Math.min(width / layer.image.naturalWidth, height / layer.image.naturalHeight);
    const drawWidth = layer.image.naturalWidth * fitScale;
    const drawHeight = layer.image.naturalHeight * fitScale;

    context.save();
    clipRoundedRect(context, x, y, width, height, layer.radius * (scaleX + scaleY) / 2);
    context.drawImage(layer.image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    context.restore();
  }

  return canvasToBlob(canvas);
}

export type ReceiptExportMethod = "shared" | "opened" | "downloaded";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function openPng(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  if (tab) return true;

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return false;
}

/** Save/share an already-rendered PNG while still in the button's user gesture. */
export function exportReceiptPng(
  blob: Blob,
  fileName: string,
  onShareError?: () => void,
): ReceiptExportMethod {
  if (isIOS() && typeof File === "function" && typeof navigator.share === "function") {
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        // Do not await: iOS Safari may leave this promise pending after saving to Photos.
        void navigator.share({ files: [file], title: "Phiếu học phí" }).catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          onShareError?.();
        });
        return "shared";
      } catch {
        // Fall through to opening the image if the share sheet cannot be started.
      }
    }
  }

  if (isIOS()) return openPng(blob, fileName) ? "opened" : "downloaded";

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
