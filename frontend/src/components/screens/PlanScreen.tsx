import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useScan } from '@/hooks/useScan'
import { usePlan } from '@/hooks/usePlan'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { ScanProgressCard } from '@/components/plan/ScanProgressCard'
import { CMSDetectionCard } from '@/components/plan/CMSDetectionCard'
import { StatisticsCard } from '@/components/plan/StatisticsCard'
import { StrategiesCard } from '@/components/plan/StrategiesCard'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'
import type { ScanResult, PlanResult } from '@/types/scanner'

interface PlanScreenProps {
  source: { config: ConnectionConfig; probe: ProbeResult }
  dest: { config: ConnectionConfig; probe: ProbeResult }
  onBack?: () => void
  onNext?: (scanResult: ScanResult, planResult: PlanResult) => void
}

export function PlanScreen({ source, dest, onBack, onNext }: PlanScreenProps) {
  const hasStartedScan = useRef(false)

  // Use custom hooks for scan and plan logic
  const {
    scanning,
    scanResult,
    progress,
    error: scanError,
    startScan,
    cancelScan,
  } = useScan({
    sourceConfig: source.config,
    onComplete: async (result) => {
      // Auto-generate plan after successful scan
      if (result.success) {
        await generatePlan(result)
      }
    },
  })

  const {
    planning,
    planResult,
    error: planError,
    generatePlan,
  } = usePlan({
    sourceConfig: source.config,
    destConfig: dest.config,
    sourceProbe: source.probe,
    destProbe: dest.probe,
  })

  // Auto-start scan when component mounts (only once)
  useEffect(() => {
    if (!hasStartedScan.current) {
      hasStartedScan.current = true
      startScan()
    }
    return () => {
      cancelScan()
    }
  }, [startScan, cancelScan])

  const error = scanError || planError

  const handleProceed = () => {
    if (scanResult && planResult && onNext) {
      onNext(scanResult, planResult)
    }
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
        {error && <ErrorCard error={error} />}

        {/* Scanning Status */}
        {scanning && <ScanProgressCard progress={progress} />}

        {/* CMS Detection */}
        {scanResult?.cms_detection && (
          <CMSDetectionCard cmsDetection={scanResult.cms_detection} />
        )}

        {/* Scan Statistics */}
        {scanResult?.statistics && <StatisticsCard statistics={scanResult.statistics} />}

        {/* Transfer Strategies */}
        {planResult?.strategies && (
          <StrategiesCard
            strategies={planResult.strategies}
            recommendedStrategy={planResult.recommended_strategy}
          />
        )}

        {/* Warnings */}
        {planResult?.warnings && planResult.warnings.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded">
            <p className="text-yellow-400 font-semibold mb-2">⚠ Warnings:</p>
            <ul className="space-y-1">
              {planResult.warnings.map((warning, idx) => (
                <li key={idx} className="text-yellow-300 text-sm">
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Planning Status */}
        {planning && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
            <p className="text-green-400 font-semibold">Generating migration plan...</p>
          </div>
        )}

        {/* Next Button */}
        {planResult && scanResult && !planning && !scanning && (
          <div className="flex justify-center mt-8">
            <Button
              onClick={handleProceed}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
            >
              Proceed to Transfer Configuration →
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
