import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCMSIcon } from '@/lib/formatting'
import type { CMSDetection } from '@/types/scanner'

interface CMSDetectionCardProps {
  cmsDetection: CMSDetection
}

export function CMSDetectionCard({ cmsDetection }: CMSDetectionCardProps) {
  if (!cmsDetection.detected) return null

  return (
    <Card className="mb-6 bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-3">
          <span className="text-3xl">{getCMSIcon(cmsDetection.type)}</span>
          CMS Detected:{' '}
          {cmsDetection.type.charAt(0).toUpperCase() + cmsDetection.type.slice(1)}
          {cmsDetection.version && (
            <Badge variant="success">v{cmsDetection.version}</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-slate-400">
          Confidence: {(cmsDetection.confidence * 100).toFixed(0)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-2">Indicators Found:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(cmsDetection.indicators))
                .slice(0, 10)
                .map((indicator, idx) => (
                  <Badge key={idx} className="bg-slate-700">
                    {indicator}
                  </Badge>
                ))}
              {cmsDetection.indicators.length > 10 && (
                <Badge className="bg-slate-600">
                  +{cmsDetection.indicators.length - 10} more
                </Badge>
              )}
            </div>
          </div>
          {cmsDetection.database_config && (
            <div>
              <p className="text-sm text-slate-400 mb-2">Database Configuration:</p>
              <div className="bg-slate-700/50 rounded p-3 text-sm space-y-1">
                <p className="text-slate-300">
                  Host: {cmsDetection.database_config.host}
                </p>
                <p className="text-slate-300">
                  Database: {cmsDetection.database_config.database}
                </p>
                <p className="text-slate-300">
                  User: {cmsDetection.database_config.username}
                </p>
                {cmsDetection.database_config.prefix && (
                  <p className="text-slate-300">
                    Prefix: {cmsDetection.database_config.prefix}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
