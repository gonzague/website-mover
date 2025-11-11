import type { CMSType } from '@/types/scanner'

/**
 * Formats a duration in seconds into a human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

/**
 * Formats bytes into a human-readable size string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

/**
 * Returns an emoji icon for a given CMS type
 */
export function getCMSIcon(type: CMSType): string {
  const icons: Record<CMSType, string> = {
    wordpress: '🔷',
    prestashop: '🛒',
    drupal: '💧',
    joomla: '⭐',
    magento: '🛍️',
    unknown: '❓',
  }
  return icons[type] || '📦'
}

/**
 * Returns a color class for a given transfer method
 */
export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    fxp: 'bg-purple-600',
    rsync_ssh: 'bg-blue-600',
    sftp_stream: 'bg-green-600',
    lftp: 'bg-yellow-600',
    tar_stream: 'bg-orange-600',
  }
  return colors[method] || 'bg-gray-600'
}
