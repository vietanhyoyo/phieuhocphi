import { toBlob } from "html-to-image";

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

/** Render the actual receipt so preview and PNG always share one layout. */
export async function createReceiptPng(element: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const images = Array.from(element.querySelectorAll("img"));
  const inlineImages = await Promise.all(images.map(async (image) => ({
    image,
    dataUrl: await embedImage(image),
    src: image.getAttribute("src"),
    srcSet: image.getAttribute("srcset"),
  })));

  try {
    inlineImages.forEach(({ image, dataUrl }) => {
      image.removeAttribute("srcset");
      image.src = dataUrl;
    });
    await Promise.all(inlineImages.map(({ image }) => image.decode()));

    const blob = await toBlob(element, {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      preferredFontFormat: "woff2",
      style: { margin: "0", boxShadow: "none" },
    });
    if (!blob) throw new Error("Could not create receipt PNG");
    return blob;
  } finally {
    inlineImages.forEach(({ image, src, srcSet }) => {
      if (src === null) image.removeAttribute("src");
      else image.setAttribute("src", src);
      if (srcSet === null) image.removeAttribute("srcset");
      else image.setAttribute("srcset", srcSet);
    });
  }
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
