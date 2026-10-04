import type { Member } from './types'

// Pastel avatar fills from the design; text on them is always dark, so they work in both themes.
export const SINGER_COLORS = ['#b9d4f0', '#f3c4d6', '#bfe6c9', '#f5d9a8', '#d9c8f0', '#c8e8e4']

export interface SingerBadge {
  name: string
  initial: string
  color: string
}

/** Badges for the extra singers on a slot, skipping anyone who has since left the band or is the lead. */
export function coSingerBadges(members: Member[], item: { singerId: string | null; coSingerIds?: string[] }): SingerBadge[] {
  return (item.coSingerIds ?? [])
    .filter((id) => id !== item.singerId && members.some((m) => m.id === id))
    .map((id) => singerBadge(members, id))
}

export function singerBadge(members: Member[], singerId: string | null): SingerBadge {
  if (!singerId) return { name: 'No singer', initial: '?', color: 'var(--ln)' }
  const singers = members.filter((m) => m.isSinger)
  const index = singers.findIndex((m) => m.id === singerId)
  const member = members.find((m) => m.id === singerId)
  if (!member) return { name: 'No singer', initial: '?', color: 'var(--ln)' }
  return {
    name: member.name,
    initial: member.name.trim().charAt(0).toUpperCase() || '?',
    color: SINGER_COLORS[Math.max(0, index) % SINGER_COLORS.length],
  }
}
