// Shrinks a photo in the browser before upload (phone photos are 3–8 MB; a report needs ~150 KB).
export async function shrinkPhoto(file: File, maxSide = 1280, quality = 0.75): Promise<{ base64: string; type: "image/jpeg" }> {
  if (!file.type.startsWith("image/")) throw new Error("Bitte ein Foto wählen.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Das Foto konnte nicht verarbeitet werden.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(bin), type: "image/jpeg" };
}
