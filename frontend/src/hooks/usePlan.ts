import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'
import type { ScanResult, PlanResult } from '@/types/scanner'

export interface UsePlanOptions {
  sourceConfig: ConnectionConfig
  destConfig: ConnectionConfig
  sourceProbe: ProbeResult
  destProbe: ProbeResult
}

export function usePlan({ sourceConfig, destConfig, sourceProbe, destProbe }: UsePlanOptions) {
  const [planning, setPlanning] = useState(false)
  const [planResult, setPlanResult] = useState<PlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generatePlan = useCallback(async (scanResult: ScanResult) => {
    setPlanning(true)
    setError(null)

    try {
      const plan = await apiClient.plan(
        scanResult,
        sourceProbe,
        destProbe,
        sourceConfig,
        destConfig
      )
      setPlanResult(plan)
      return plan
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Plan generation failed'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setPlanning(false)
    }
  }, [sourceConfig, destConfig, sourceProbe, destProbe])

  return {
    planning,
    planResult,
    error,
    generatePlan,
  }
}
