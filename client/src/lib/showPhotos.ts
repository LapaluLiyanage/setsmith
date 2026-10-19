import { supabase } from './supabase'
import type { ShowPhoto } from './types'

const BUCKET = 'show-photos'
export const MAX_SHOW_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_EDGE = 1600
const URL_TTL_SEC = 60 * 60

/** A show has ended once its date is before today (local time). A show with no valid date never counts as ended. */
export function isShowEnded(dateIso: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dateIso < today
}

/** Size to scale a width x height image down to so its longest side is at most `max` (never scales up). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not process that image')
  return blob
}

/** Resizes and uploads one photo to the show's folder in the private bucket. */
export async function uploadShowPhoto(bandId: string, showId: string, file: File): Promise<ShowPhoto> {
  if (!supabase) throw new Error('Not connected to Supabase')
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`)
  if (file.size > MAX_SHOW_PHOTO_BYTES) throw new Error(`${file.name} is over 8 MB`)
  const id = crypto.randomUUID().slice(0, 8)
  const path = `${bandId}/${showId}/${id}.jpg`
  const body = await shrink(file)
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' })
  if (error) throw error
  return { id, path, addedAt: new Date().toISOString() }
}

/** Short-lived links for photos in the private bucket, keyed by storage path. */
export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || paths.length === 0) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SEC)
  return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])))
}

export function deleteShowPhotoFile(path: string) {
  if (supabase) supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}
