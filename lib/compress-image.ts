/**
 * クライアント側で画像を圧縮し base64 Data URL を返す
 * 413 Payload Too Large を避けるため、API 送信前に使用
 */
import imageCompression from 'browser-image-compression'

const OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.8,
}

export async function compressImageToBase64(file: File): Promise<string> {
  const compressed = await imageCompression(file, OPTIONS)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(compressed)
  })
}
