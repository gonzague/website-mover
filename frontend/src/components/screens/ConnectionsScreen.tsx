import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/connection/ConnectionForm'
import { ProbeResults } from '@/components/connection/ProbeResults'
import { apiClient } from '@/lib/api'
import { saveConnection } from '@/lib/storage'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'

interface ConnectionsScreenProps {
  onNext?: (source: { config: ConnectionConfig; probe: ProbeResult }, dest: { config: ConnectionConfig; probe: ProbeResult }) => void
}

export function ConnectionsScreen({ onNext }: ConnectionsScreenProps = {}) {
  const [sourceResult, setSourceResult] = useState<ProbeResult | null>(null)
  const [destResult, setDestResult] = useState<ProbeResult | null>(null)
  const [sourceConfig, setSourceConfig] = useState<ConnectionConfig | null>(null)
  const [destConfig, setDestConfig] = useState<ConnectionConfig | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [destLoading, setDestLoading] = useState(false)

  const handleSourceTest = async (config: ConnectionConfig) => {
    setSourceLoading(true)
    setSourceConfig(config)
    try {
      const result = await apiClient.probe(config)
      setSourceResult(result)

      // Save connection after successful test
      if (result.success) {
        saveConnection(config)
      }
    } catch (error) {
      setSourceResult({
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        protocol: config.protocol,
        capabilities: {
          shell_available: false,
          mlsd_supported: false,
          fxp_allowed: false,
          can_read: false,
          can_write: false,
          can_list: false,
        },
        performance: {
          latency: 0,
          latency_ms: 0,
          upload_speed: 0,
          download_speed: 0,
          connection_time: 0,
          connection_time_ms: 0,
        },
        badges: [],
      })
    } finally {
      setSourceLoading(false)
    }
  }

  const handleDestTest = async (config: ConnectionConfig) => {
    setDestLoading(true)
    setDestConfig(config)
    try {
      const result = await apiClient.probe(config)
      setDestResult(result)

      // Save connection after successful test
      if (result.success) {
        saveConnection(config)
      }
    } catch (error) {
      setDestResult({
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        protocol: config.protocol,
        capabilities: {
          shell_available: false,
          mlsd_supported: false,
          fxp_allowed: false,
          can_read: false,
          can_write: false,
          can_list: false,
        },
        performance: {
          latency: 0,
          latency_ms: 0,
          upload_speed: 0,
          download_speed: 0,
          connection_time: 0,
          connection_time_ms: 0,
        },
        badges: [],
      })
    } finally {
      setDestLoading(false)
    }
  }

  const canProceed = () => {
    return sourceResult?.success && destResult?.success && sourceConfig && destConfig
  }

  const handleNext = () => {
    if (canProceed() && onNext && sourceConfig && destConfig && sourceResult && destResult) {
      onNext(
        { config: sourceConfig, probe: sourceResult },
        { config: destConfig, probe: destResult }
      )
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Server Connections
          </h1>
          <p className="text-center text-slate-300">
            Configure and test your source and destination servers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Server */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <span className="text-2xl">📤</span> Source Server
              </CardTitle>
              <CardDescription className="text-slate-400">
                The server where your website currently resides
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConnectionForm
                title="Source"
                onTest={handleSourceTest}
                loading={sourceLoading}
              />
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Test Results</h4>
                <ProbeResults result={sourceResult} />
              </div>
            </CardContent>
          </Card>

          {/* Destination Server */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <span className="text-2xl">📥</span> Destination Server
              </CardTitle>
              <CardDescription className="text-slate-400">
                The server where you want to move your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConnectionForm
                title="Destination"
                onTest={handleDestTest}
                loading={destLoading}
              />
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Test Results</h4>
                <ProbeResults result={destResult} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Button */}
        {canProceed() && onNext && (
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 text-lg"
            >
              Continue to File Scan →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
