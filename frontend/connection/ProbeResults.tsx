import { Badge } from '@/components/ui/badge'
import type { ProbeResult } from '@/types/probe'

interface ProbeResultsProps {
  result: ProbeResult | null
}

export function ProbeResults({ result }: ProbeResultsProps) {
  if (!result) {
    return (
      <div className="text-center text-slate-400 py-8">
        <p>No test results yet</p>
        <p className="text-sm mt-2">Click "Test Connection" to probe the server</p>
      </div>
    )
  }

  if (!result.success) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
        <h4 className="text-red-400 font-semibold mb-2">Connection Failed</h4>
        <p className="text-red-300 text-sm">{result.error_message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {result.badges.map((badge, idx) => (
          <Badge key={idx} variant="success">
            {badge}
          </Badge>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Latency</p>
          <p className="text-lg font-semibold text-white">
            {result.performance.latency_ms.toFixed(1)} ms
          </p>
        </div>

        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Connection Time</p>
          <p className="text-lg font-semibold text-white">
            {result.performance.connection_time_ms.toFixed(0)} ms
          </p>
        </div>

        {result.performance.upload_speed > 0 && (
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Upload Speed</p>
            <p className="text-lg font-semibold text-white">
              {result.performance.upload_speed.toFixed(2)} MB/s
            </p>
          </div>
        )}

        {result.performance.download_speed > 0 && (
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Download Speed</p>
            <p className="text-lg font-semibold text-white">
              {result.performance.download_speed.toFixed(2)} MB/s
            </p>
          </div>
        )}
      </div>

      {/* Capabilities */}
      <div className="bg-slate-700/30 rounded-lg p-3">
        <p className="text-xs text-slate-400 mb-2">Capabilities</p>
        <div className="space-y-1 text-sm">
          {result.capabilities.shell_available && (
            <p className="text-green-400">✓ Shell access available</p>
          )}
          {result.capabilities.can_read && (
            <p className="text-green-400">✓ Read permissions</p>
          )}
          {result.capabilities.can_write && (
            <p className="text-green-400">✓ Write permissions</p>
          )}
          {result.capabilities.sftp_version && (
            <p className="text-slate-300">SFTP version: {result.capabilities.sftp_version}</p>
          )}
          {result.capabilities.compression_types && result.capabilities.compression_types.length > 0 && (
            <p className="text-slate-300">
              Compression: {result.capabilities.compression_types.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
