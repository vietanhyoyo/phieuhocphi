import { toBlob } from "html-to-image";

/** Render the actual receipt so preview and PNG always share one layout. */
export async function createReceiptPng(element: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img"), (image) => image.decode()));

  const blob = await toBlob(element, {
    pixelRatio: 3,
    backgroundColor: "#ffffff",
    preferredFontFormat: "woff2",
    style: { margin: "0", boxShadow: "none" },
  });
  if (!blob) throw new Error("Could not create receipt PNG");
  return blob;
}

export async function exportReceiptToPng(element: HTMLElement, fileName: string): Promise<void> {
  const blob = await createReceiptPng(element);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
