export interface VisionExtractResult {
  name: string | null;
  cr_number: string | null;
  shares: string | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function mediaTypeFor(file: File): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

/** S3: one Claude vision call extracts stakeholder fields from a CR photo. */
export async function extractFromImage(file: File): Promise<VisionExtractResult> {
  const image_base64 = await fileToBase64(file);
  const res = await fetch('/api/backend/api/qareen/vision/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64, media_type: mediaTypeFor(file) }),
  });
  if (!res.ok) {
    throw new Error(`Vision extract failed: ${res.status}`);
  }
  return (await res.json()) as VisionExtractResult;
}
