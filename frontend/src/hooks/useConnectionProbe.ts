import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { saveConnection } from '@/lib/storage'
import { createFailedProbeResult } from '@/lib/probe-utils'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'

export function useConnectionProbe() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProbeResult | null>(null)
  const [config, setConfig] = useState<ConnectionConfig | null>(null)

  const testConnection = useCallback(async (connectionConfig: ConnectionConfig) => {
    setLoading(true)
    setConfig(connectionConfig)

    try {
      const probeResult = await apiClient.probe(connectionConfig)
      setResult(probeResult)

      // Save connection after successful test
      if (probeResult.success) {
        saveConnection(connectionConfig)
      }

      return probeResult
    } catch (error) {
      const failedResult = createFailedProbeResult(connectionConfig.protocol, error)
      setResult(failedResult)
      return failedResult
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setConfig(null)
    setLoading(false)
  }, [])

  return {
    loading,
    result,
    config,
    testConnection,
    reset,
  }
}
