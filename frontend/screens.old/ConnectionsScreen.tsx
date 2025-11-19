import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/connection/ConnectionForm'
import { ProbeResults } from '@/components/connection/ProbeResults'
import { JobHistoryPanel } from '@/components/session/JobHistoryPanel'
import { useConnectionProbe } from '@/hooks/useConnectionProbe'
import { History } from 'lucide-react'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'

interface ConnectionsScreenProps {
  onNext?: (
    source: { config: ConnectionConfig; probe: ProbeResult },
    dest: { config: ConnectionConfig; probe: ProbeResult }
  ) => void
}

export function ConnectionsScreen({ onNext }: ConnectionsScreenProps = {}) {
  // Use custom hooks for both source and dest connections
  const source = useConnectionProbe()
  const dest = useConnectionProbe()
  const [showHistory, setShowHistory] = useState(false)

  const canProceed = () => {
    return (
      source.result?.success &&
      dest.result?.success &&
      source.config !== null &&
      dest.config !== null
    )
  }

  const handleNext = () => {
    if (canProceed() && source.config && dest.config && source.result && dest.result && onNext) {
      onNext(
        { config: source.config, probe: source.result },
        { config: dest.config, probe: dest.result }
      )
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <JobHistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Website Mover
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
          </div>
          <p className="text-slate-300">
            Connect to your source and destination servers to begin migration
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Source Connection */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">📤 Source Server</CardTitle>
              <CardDescription className="text-slate-400">
                Where your website currently lives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionForm
                onTest={source.testConnection}
                loading={source.loading}
                initialProtocol="sftp"
              />
              {source.result && <ProbeResults result={source.result} className="mt-4" />}
            </CardContent>
          </Card>

          {/* Destination Connection */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">📥 Destination Server</CardTitle>
              <CardDescription className="text-slate-400">
                Where you want to move your website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionForm
                onTest={dest.testConnection}
                loading={dest.loading}
                initialProtocol="sftp"
              />
              {dest.result && <ProbeResults result={dest.result} className="mt-4" />}
            </CardContent>
          </Card>
        </div>

        {/* Next Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-8 py-3 text-lg"
          >
            {canProceed()
              ? 'Next: Scan & Plan →'
              : 'Test both connections to continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
