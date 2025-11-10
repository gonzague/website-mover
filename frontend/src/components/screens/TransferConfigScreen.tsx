import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { PlanResult, TransferStrategy, ExclusionPattern } from '@/types/scanner'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'

interface TransferConfigScreenProps {
  plan: PlanResult
  scanResult: any
  source: { config: ConnectionConfig; probe: ProbeResult }
  dest: { config: ConnectionConfig; probe: ProbeResult }
  onBack: () => void
  onStartTransfer: (config: TransferConfig) => void
}

export interface TransferConfig {
  selectedStrategy: TransferStrategy
  exclusions: ExclusionPattern[]
  bandwidthLimit?: number // MB/s
  enableResume: boolean
  verifyAfterTransfer: boolean
  skipLargeFiles?: number // Skip files larger than X MB
  dryRun: boolean
}

export function TransferConfigScreen({
  plan,
  scanResult,
  source,
  dest,
  onBack,
  onStartTransfer,
}: TransferConfigScreenProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<TransferStrategy>(
    plan.recommended_strategy || plan.strategies[0]
  )
  const [exclusions, setExclusions] = useState<ExclusionPattern[]>(
    scanResult.exclusions || []
  )
  const [bandwidthLimit, setBandwidthLimit] = useState<number | undefined>(undefined)
  const [enableResume, setEnableResume] = useState(true)
  const [verifyAfterTransfer, setVerifyAfterTransfer] = useState(true)
  const [skipLargeFiles, setSkipLargeFiles] = useState<number | undefined>(undefined)
  const [dryRun, setDryRun] = useState(false)
  const [newExclusionPattern, setNewExclusionPattern] = useState('')

  const handleAddExclusion = () => {
    if (newExclusionPattern.trim()) {
      setExclusions([
        ...exclusions,
        {
          pattern: newExclusionPattern.trim(),
          type: 'glob',
          reason: 'User defined',
          is_automatic: false,
          enabled: true,
        },
      ])
      setNewExclusionPattern('')
    }
  }

  const handleToggleExclusion = (index: number) => {
    const updated = [...exclusions]
    updated[index].enabled = !updated[index].enabled
    setExclusions(updated)
  }

  const handleRemoveExclusion = (index: number) => {
    setExclusions(exclusions.filter((_, i) => i !== index))
  }

  const handleStartTransfer = () => {
    onStartTransfer({
      selectedStrategy,
      exclusions,
      bandwidthLimit,
      enableResume,
      verifyAfterTransfer,
      skipLargeFiles,
      dryRun,
    })
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={onBack}
            variant="outline"
            className="mb-4"
          >
            ← Back to Plan
          </Button>
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Transfer Configuration
          </h1>
          <p className="text-center text-slate-300">
            Review and customize your transfer settings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Strategy Selection */}
          <div className="space-y-6">
            {/* Strategy Selection */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Transfer Strategy</CardTitle>
                <CardDescription className="text-slate-400">
                  Choose your preferred transfer method
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.strategies.map((strategy, index) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedStrategy === strategy
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                    }`}
                    onClick={() => setSelectedStrategy(strategy)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-semibold">
                          {strategy.method.replace('_', ' ').toUpperCase()}
                        </h4>
                        {plan.recommended_strategy?.method === strategy.method && (
                          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="text-blue-400">
                        Score: {strategy.score.toFixed(0)}
                      </Badge>
                    </div>

                    <p className="text-sm text-slate-400 mb-3">{strategy.description}</p>

                    {strategy.estimated_time > 0 && (
                      <div className="text-xs text-slate-500 mb-2">
                        Estimated time: {formatDuration(strategy.estimated_time)}
                      </div>
                    )}

                    {/* Pros */}
                    {strategy.pros && strategy.pros.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-green-400 mb-1">Pros:</div>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {strategy.pros.map((pro, i) => (
                            <li key={i}>✓ {pro}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cons */}
                    {strategy.cons && strategy.cons.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-orange-400 mb-1">Cons:</div>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {strategy.cons.map((con, i) => (
                            <li key={i}>⚠ {con}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Requirements */}
                    {strategy.requirements && strategy.requirements.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-blue-400 mb-1">Requirements:</div>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {strategy.requirements.map((req, i) => (
                            <li key={i}>• {req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Transfer Options */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Transfer Options</CardTitle>
                <CardDescription className="text-slate-400">
                  Configure transfer behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Bandwidth Limit */}
                <div className="space-y-2">
                  <Label htmlFor="bandwidth">Bandwidth Limit (MB/s)</Label>
                  <Input
                    id="bandwidth"
                    type="number"
                    placeholder="Unlimited"
                    value={bandwidthLimit || ''}
                    onChange={(e) => setBandwidthLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-500">Leave empty for no limit</p>
                </div>

                {/* Skip Large Files */}
                <div className="space-y-2">
                  <Label htmlFor="skipLarge">Skip Files Larger Than (MB)</Label>
                  <Input
                    id="skipLarge"
                    type="number"
                    placeholder="No limit"
                    value={skipLargeFiles || ''}
                    onChange={(e) => setSkipLargeFiles(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-500">Skip very large files (can transfer manually later)</p>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableResume}
                      onChange={(e) => setEnableResume(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">Enable Resume</div>
                      <div className="text-xs text-slate-400">Resume interrupted transfers</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verifyAfterTransfer}
                      onChange={(e) => setVerifyAfterTransfer(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">Verify After Transfer</div>
                      <div className="text-xs text-slate-400">Compare file counts and sizes after transfer</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">Dry Run (Test Mode)</div>
                      <div className="text-xs text-slate-400">Simulate transfer without actually copying files</div>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Exclusions */}
          <div className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">File Exclusions</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage which files to skip during transfer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add New Exclusion */}
                <div className="space-y-2">
                  <Label htmlFor="newExclusion">Add Exclusion Pattern</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newExclusion"
                      type="text"
                      placeholder="*.log, cache/*, temp"
                      value={newExclusionPattern}
                      onChange={(e) => setNewExclusionPattern(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddExclusion()}
                      className="bg-slate-700 border-slate-600 text-white flex-1"
                    />
                    <Button
                      onClick={handleAddExclusion}
                      variant="outline"
                      disabled={!newExclusionPattern.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Use glob patterns: *.log, cache/*, **/.git</p>
                </div>

                {/* Exclusion List */}
                <div className="border border-slate-700 rounded-md divide-y divide-slate-700 max-h-96 overflow-y-auto">
                  {exclusions.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      No exclusions configured
                    </div>
                  ) : (
                    exclusions.map((exclusion, index) => (
                      <div
                        key={index}
                        className={`p-3 flex items-center justify-between gap-3 ${
                          !exclusion.enabled ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={exclusion.enabled}
                            onChange={() => handleToggleExclusion(index)}
                            className="w-4 h-4 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm text-white truncate">
                              {exclusion.pattern}
                            </div>
                            <div className="text-xs text-slate-400">
                              {exclusion.reason}
                              {exclusion.is_automatic && (
                                <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {!exclusion.is_automatic && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 hover:text-red-300 flex-shrink-0"
                            onClick={() => handleRemoveExclusion(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-700/50 p-3 rounded">
                    <div className="text-xs text-slate-400">Active Exclusions</div>
                    <div className="text-lg font-semibold text-white">
                      {exclusions.filter((e) => e.enabled).length}
                    </div>
                  </div>
                  <div className="bg-slate-700/50 p-3 rounded">
                    <div className="text-xs text-slate-400">Total Patterns</div>
                    <div className="text-lg font-semibold text-white">{exclusions.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Strategy Summary */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Command Preview</CardTitle>
                <CardDescription className="text-slate-400">
                  Command that will be executed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-900 p-4 rounded-md border border-slate-700">
                  <code className="text-xs text-green-400 font-mono break-all whitespace-pre-wrap">
                    {selectedStrategy.command || 'Command will be generated...'}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <Button
            onClick={onBack}
            variant="outline"
            size="lg"
            className="px-8"
          >
            ← Back
          </Button>
          <Button
            onClick={handleStartTransfer}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 text-lg"
            size="lg"
          >
            {dryRun ? 'Start Dry Run' : 'Start Transfer'} →
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}
