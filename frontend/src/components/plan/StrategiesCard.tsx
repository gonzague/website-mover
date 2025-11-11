import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getMethodColor, formatDuration } from '@/lib/formatting'
import type { TransferStrategy } from '@/types/scanner'

interface StrategiesCardProps {
  strategies: TransferStrategy[]
  recommendedStrategy?: TransferStrategy
}

export function StrategiesCard({ strategies, recommendedStrategy }: StrategiesCardProps) {
  return (
    <Card className="mb-6 bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">🚀 Transfer Strategies</CardTitle>
        <CardDescription className="text-slate-400">
          Optimal methods ranked by performance and compatibility
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {strategies.map((strategy, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 ${
                strategy.method === recommendedStrategy?.method
                  ? 'border-green-500 bg-green-900/10'
                  : 'border-slate-700 bg-slate-700/20'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge className={`${getMethodColor(strategy.method)} text-white`}>
                    {strategy.method.toUpperCase().replace('_', ' ')}
                  </Badge>
                  {strategy.method === recommendedStrategy?.method && (
                    <Badge className="bg-green-600 text-white">✓ Recommended</Badge>
                  )}
                  <div className="text-sm">
                    <span className="text-slate-400">Score: </span>
                    <span className="text-white font-semibold">
                      {Math.round(strategy.score)}/100
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-400">ETA: </span>
                    <span className="text-white font-semibold">
                      ~{formatDuration(strategy.estimated_time)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-3">{strategy.command_explanation}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-green-400 font-semibold mb-1">✓ Pros:</p>
                  <ul className="space-y-1">
                    {strategy.pros.map((pro, i) => (
                      <li key={i} className="text-slate-400">
                        • {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-yellow-400 font-semibold mb-1">⚠ Cons:</p>
                  <ul className="space-y-1">
                    {strategy.cons.map((con, i) => (
                      <li key={i} className="text-slate-400">
                        • {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {strategy.requirements.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-slate-400 text-sm">
                    <span className="font-semibold">Requirements: </span>
                    {strategy.requirements.join(', ')}
                  </p>
                </div>
              )}

              <div className="mt-3 bg-slate-900/50 rounded p-2">
                <code className="text-xs text-green-400">{strategy.command}</code>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
