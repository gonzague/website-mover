import { useState, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import type { ConnectionConfig } from '@/types/probe'
import type { ScanResult } from '@/types/scanner'

export interface ScanProgress {
  status: string
  current_path: string
  files_scanned: number
  dirs_scanned: number
  total_size: number
  message?: string
  percent_complete: number
}

export interface UseScanOptions {
  sourceConfig: ConnectionConfig
  onComplete?: (result: ScanResult) => void
}

export function useScan({ sourceConfig, onComplete }: UseScanOptions) {
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const startScan = useCallback(async () => {
    setScanning(true)
    setError(null)
    setProgress(null)
    setScanResult(null)

    try {
      // Use SSE for progress updates
      const url = new URL('/api/scan/stream', 'http://127.0.0.1:8080')

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_config: sourceConfig,
          max_files: 10000,
          follow_symlinks: false,
          detect_cms: true,
          include_hidden: false,
        }),
      })

      if (!response.ok) {
        throw new Error('Scan failed to start')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Stream not available')
      }

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            setProgress(data)
          }
        }
      }

      // Fetch the final result
      const finalResult = await apiClient.scan({
        server_config: sourceConfig,
        max_files: 10000,
        follow_symlinks: false,
        detect_cms: true,
        include_hidden: false,
      })

      setScanResult(finalResult)

      if (onComplete && finalResult.success) {
        onComplete(finalResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [sourceConfig, onComplete])

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
  }, [])

  return {
    scanning,
    scanResult,
    progress,
    error,
    startScan,
    cleanup,
  }
}
