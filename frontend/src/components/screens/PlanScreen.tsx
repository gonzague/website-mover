import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'
import type { ScanResult, PlanResult, CMSType, TransferStrategy } from '@/types/scanner'

interface ScanProgress {
  status: string
  current_path: string
  files_scanned: number
  dirs_scanned: number
  total_size: number
  message?: string
  percent_complete: number
}

interface PlanScreenProps {
  source: { config: ConnectionConfig; probe: ProbeResult }
  dest: { config: ConnectionConfig; probe: ProbeResult }
  onBack?: () => void
  onNext?: (scanResult: ScanResult, planResult: PlanResult) => void
}

export function PlanScreen({ source, dest, onBack, onNext }: PlanScreenProps) {
  const [scanning, setScanning] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [planResult, setPlanResult] = useState<PlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Auto-start scan when component mounts
    handleScan()

    // Cleanup EventSource on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    setProgress(null)
    setScanResult(null)

    try {
      // Use SSE for progress updates
      const url = new URL('/api/scan/stream', 'http://127.0.0.1:8080')

      // We need to POST the request body, so we'll use fetch with EventSource simulation
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_config: source.config,
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
          } else if (line.startsWith('event: complete')) {
            // Next line will have the complete result
            continue
          } else if (line.startsWith('event: error')) {
            continue
          }
        }
      }

      // The scan completed, now fetch the final result
      const finalResult = await apiClient.scan({
        server_config: source.config,
        max_files: 10000,
        follow_symlinks: false,
        detect_cms: true,
        include_hidden: false,
      })

      setScanResult(finalResult)

      // Auto-generate plan after successful scan
      if (finalResult.success) {
        await handleGeneratePlan(finalResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleGeneratePlan = async (scan: ScanResult) => {
    setPlanning(true)
    setError(null)

    try {
      const plan = await apiClient.plan(scan, source.probe, dest.probe, source.config, dest.config)
      setPlanResult(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan generation failed')
    } finally {
      setPlanning(false)
    }
  }

  const getCMSIcon = (type: CMSType) => {
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

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      fxp: 'bg-purple-600',
      rsync_ssh: 'bg-blue-600',
      sftp_stream: 'bg-green-600',
      lftp: 'bg-yellow-600',
      tar_stream: 'bg-orange-600',
    }
    return colors[method] || 'bg-gray-600'
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {onBack && (
            <Button onClick={onBack} className="mb-4 bg-slate-700 hover:bg-slate-600">
              ← Back to Connections
            </Button>
          )}
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Migration Plan
          </h1>
          <p className="text-center text-slate-300">
            Analyzing source server and generating optimal transfer strategy
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 bg-red-900/20 border-red-700">
            <CardContent className="pt-6">
              <p className="text-red-400 font-semibold">Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Scanning Status */}
        {scanning && (
          <Card className="mb-6 bg-blue-900/20 border-blue-700">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <div className="flex-1">
                    <p className="text-blue-400 font-semibold">Scanning source server...</p>
                    {progress?.message && (
                      <p className="text-slate-400 text-sm">{progress.message}</p>
                    )}
                  </div>
                </div>

                {progress && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Files: </span>
                        <span className="text-white font-semibold">{(progress.files_scanned || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Directories: </span>
                        <span className="text-white font-semibold">{(progress.dirs_scanned || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Size: </span>
                        <span className="text-white font-semibold">
                          {((progress.total_size || 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                    {progress.current_path && (
                      <div className="text-xs text-slate-500 truncate">
                        Current: {progress.current_path}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CMS Detection */}
        {scanResult?.cms_detection?.detected && (
          <Card className="mb-6 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-3">
                <span className="text-3xl">{getCMSIcon(scanResult.cms_detection.type)}</span>
                CMS Detected: {scanResult.cms_detection.type.charAt(0).toUpperCase() + scanResult.cms_detection.type.slice(1)}
                {scanResult.cms_detection.version && (
                  <Badge variant="success">v{scanResult.cms_detection.version}</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400">
                Confidence: {(scanResult.cms_detection.confidence * 100).toFixed(0)}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-2">Indicators Found:</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(scanResult.cms_detection.indicators)).slice(0, 10).map((indicator, idx) => (
                      <Badge key={idx} className="bg-slate-700">{indicator}</Badge>
                    ))}
                    {scanResult.cms_detection.indicators.length > 10 && (
                      <Badge className="bg-slate-600">+{scanResult.cms_detection.indicators.length - 10} more</Badge>
                    )}
                  </div>
                </div>
                {scanResult.cms_detection.database_config && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Database Configuration:</p>
                    <div className="bg-slate-700/50 rounded p-3 text-sm space-y-1">
                      <p className="text-slate-300">Host: {scanResult.cms_detection.database_config.host}</p>
                      <p className="text-slate-300">Database: {scanResult.cms_detection.database_config.database}</p>
                      <p className="text-slate-300">User: {scanResult.cms_detection.database_config.username}</p>
                      {scanResult.cms_detection.database_config.prefix && (
                        <p className="text-slate-300">Prefix: {scanResult.cms_detection.database_config.prefix}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Statistics */}
        {scanResult?.statistics && (
          <Card className="mb-6 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">📊 File Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Total Files</p>
                  <p className="text-2xl font-bold text-white">{scanResult.statistics.total_files.toLocaleString()}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Total Size</p>
                  <p className="text-2xl font-bold text-white">{scanResult.statistics.total_size_human}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Directories</p>
                  <p className="text-2xl font-bold text-white">{scanResult.statistics.total_dirs.toLocaleString()}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Max Depth</p>
                  <p className="text-2xl font-bold text-white">{scanResult.statistics.directory_depth}</p>
                </div>
              </div>

              {/* Transferable Size Info */}
              {scanResult.statistics.excluded_count > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-yellow-400 font-semibold mb-2">
                        {scanResult.statistics.excluded_count} files will be excluded ({formatBytes(scanResult.statistics.excluded_size)})
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Actual Transfer Size: </span>
                          <span className="text-white font-bold">
                            {formatBytes(scanResult.statistics.total_size - scanResult.statistics.excluded_size)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Excluded: </span>
                          <span className="text-yellow-400 font-semibold">
                            {((scanResult.statistics.excluded_size / scanResult.statistics.total_size) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* File Types */}
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-3">File Types Distribution:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(scanResult.statistics.files_by_type)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([ext, count]) => (
                      <Badge key={ext} className="bg-slate-700">
                        {ext}: {count}
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Largest Files */}
              {scanResult.statistics.largest_files.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-3">Largest Files:</p>
                  <div className="space-y-2">
                    {scanResult.statistics.largest_files.slice(0, 5).map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-700/30 rounded p-2">
                        <span className="text-slate-300 text-sm truncate flex-1">{file.path}</span>
                        <Badge className="ml-2 bg-slate-600">{(file.size / 1024 / 1024).toFixed(2)} MB</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exclusions */}
              {scanResult.statistics.excluded_count > 0 && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ {scanResult.statistics.excluded_count} files will be excluded ({(scanResult.statistics.excluded_size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transfer Strategies */}
        {planResult?.strategies && planResult.strategies.length > 0 && (
          <Card className="mb-6 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">🚀 Transfer Strategies</CardTitle>
              <CardDescription className="text-slate-400">
                Ranked by suitability for your migration scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {planResult.strategies.map((strategy, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${
                      strategy.is_recommended
                        ? 'border-green-500 bg-green-900/10'
                        : 'border-slate-600 bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge className={`${getMethodColor(strategy.method)} text-white`}>
                          {strategy.method.toUpperCase().replace('_', ' ')}
                        </Badge>
                        {strategy.is_recommended && (
                          <Badge className="bg-green-600 text-white">✓ Recommended</Badge>
                        )}
                        <span className="text-lg font-semibold text-white">
                          Score: {strategy.score.toFixed(0)}/100
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Estimated Time</p>
                        <p className="text-xl font-bold text-white">{strategy.estimated_time_str}</p>
                      </div>
                    </div>

                    <p className="text-slate-300 mb-3">{strategy.command_explanation}</p>

                    <div className="grid md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-green-400 font-semibold mb-2">Pros:</p>
                        <ul className="space-y-1">
                          {strategy.pros.map((pro, i) => (
                            <li key={i} className="text-sm text-slate-300">✓ {pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm text-red-400 font-semibold mb-2">Cons:</p>
                        <ul className="space-y-1">
                          {strategy.cons.map((con, i) => (
                            <li key={i} className="text-sm text-slate-300">✗ {con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-slate-400 mb-2">Requirements:</p>
                      <div className="flex flex-wrap gap-2">
                        {strategy.requirements.map((req, i) => (
                          <Badge key={i} className="bg-slate-600">{req}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900/50 rounded p-3 font-mono text-sm text-slate-300 overflow-x-auto">
                      {strategy.command}
                    </div>

                    <div className="flex gap-4 mt-3 text-xs">
                      <span className={strategy.can_resume ? 'text-green-400' : 'text-slate-500'}>
                        {strategy.can_resume ? '✓' : '✗'} Resume Support
                      </span>
                      <span className={strategy.supports_progress ? 'text-green-400' : 'text-slate-500'}>
                        {strategy.supports_progress ? '✓' : '✗'} Progress Tracking
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warnings */}
        {planResult?.warnings && planResult.warnings.length > 0 && (
          <Card className="mb-6 bg-yellow-900/20 border-yellow-700">
            <CardHeader>
              <CardTitle className="text-yellow-400">⚠️ Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {planResult.warnings.map((warning, idx) => (
                  <li key={idx} className="text-yellow-300">{warning}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Summary and Next Steps */}
        {planResult?.recommended_strategy && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">📋 Summary & Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-700/30 rounded p-4">
                    <p className="text-slate-400 text-sm mb-2">Recommended Method</p>
                    <p className="text-xl font-bold text-white">
                      {planResult.recommended_strategy.method.toUpperCase().replace('_', ' ')}
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded p-4">
                    <p className="text-slate-400 text-sm mb-2">Total Estimated Time</p>
                    <p className="text-xl font-bold text-white">
                      {formatDuration(planResult.estimated_total_time / 1000000000)}
                    </p>
                  </div>
                </div>

                {planResult.requires_database && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded p-4">
                    <p className="text-blue-400 font-semibold mb-2">📊 Database Migration Required</p>
                    <p className="text-slate-300 text-sm">
                      After file transfer, you'll need to export and import the database.
                      Database credentials have been detected and will be available in the next step.
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                    onClick={() => onNext && scanResult && planResult && onNext(scanResult, planResult)}
                    disabled={!scanResult || !planResult || !onNext}
                  >
                    Configure Transfer →
                  </Button>
                  <Button
                    onClick={handleScan}
                    disabled={scanning}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    🔄 Re-scan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
