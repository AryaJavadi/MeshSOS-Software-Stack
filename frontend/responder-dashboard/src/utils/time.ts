import { formatDistanceToNow } from 'date-fns'

export function relativeTime(isoString: string): string {
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true })
  } catch {
    return isoString
  }
}

export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    const h = d.getHours() % 12 || 12
    const m = d.getMinutes().toString().padStart(2, '0')
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
    return `${h}:${m} ${ampm}`
  } catch {
    return isoString
  }
}
