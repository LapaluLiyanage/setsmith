import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createElement, type ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ExportData } from '../lib/exportData'
import { SetlistPdf } from './SetlistPdf'

// Loaded on demand (see ExportPanel) so the PDF engine isn't in the main bundle.
export async function renderSetlistPdf(data: ExportData): Promise<Blob> {
  const urls = [...new Set(data.sessions.flatMap((s) => s.rows.map((r) => r.url)).filter((u): u is string => !!u))]
  const qrCodes = Object.fromEntries(
    await Promise.all(urls.map(async (url) => [url, await QRCode.toDataURL(url, { margin: 0, width: 160 })] as const)),
  )
  // SetlistPdf renders a <Document>, which is what pdf() needs; its props type just can't see through the wrapper.
  const doc = createElement(SetlistPdf, { data, qrCodes }) as unknown as ReactElement<DocumentProps>
  return pdf(doc).toBlob()
}
