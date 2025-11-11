import { useState, useRef, useCallback } from 'react'
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
  const abortControllerRef = useRef<AbortController | null>(null)

  const startScan = useCallback(async () => {
    // Prevent multiple concurrent scans
    if (abortControllerRef.current) {
      console.warn('Scan already in progress, ignoring duplicate request')
      return
    }

    console.log('Starting scan...')
    setScanning(true)
    setError(null)
    setProgress(null)
    setScanResult(null)

    // Create abort controller for this scan
    abortControllerRef.current = new AbortController()

    try {
      // Use SSE (Server-Sent Events) for real-time progress updates
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
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Scan failed to start: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Stream not available')
      }

      let buffer = ''
      let currentEvent = ''

      // Read the SSE stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          // SSE format parsing
          if (line.startsWith('event: ')) {
            // Event type: "complete", "error", or empty for progress
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            // Data payload
            const jsonData = line.slice(6)
            try {
              const data = JSON.parse(jsonData)

              if (currentEvent === 'complete') {
                // Final scan result received
                setScanResult(data)
                if (onComplete && data.success) {
                  onComplete(data)
                }
              } else if (currentEvent === 'error') {
                // Error occurred
                setError(data.error || 'Scan failed')
              } else {
                // Progress update (no event type = progress)
                setProgress(data)
              }

              currentEvent = '' // Reset after processing
            } catch (parseErr) {
              console.error('Failed to parse SSE data:', jsonData, parseErr)
            }
          } else if (line === '') {
            // Empty line marks end of event
            currentEvent = ''
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Scan cancelled')
        setError('Scan cancelled')
      } else {
        console.error('Scan error:', err)
        setError(err instanceof Error ? err.message : 'Scan failed')
      }
    } finally {
      console.log('Scan finished')
      setScanning(false)
      abortControllerRef.current = null
    }
  }, [sourceConfig, onComplete])

  const cancelScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return {
    scanning,
    scanResult,
    progress,
    error,
    startScan,
    cancelScan,
  }
}
