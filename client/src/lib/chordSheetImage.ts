import { supabase } from './supabase'

const BUCKET = 'chord-sheets'
export const MAX_CHORD_IMAGE_BYTES = 8 * 1024 * 1024

function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

/** Uploads a chord sheet photo under the band's folder and returns its public URL. */
export async function uploadChordSheetImage(bandId: string, songId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Not connected to Supabase')
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${bandId}/${songId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best-effort cleanup when a photo is replaced or removed; failures are silently ignored. */
export function deleteChordSheetImage(url: string) {
  const path = pathFromPublicUrl(url)
  if (supabase && path) supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}
