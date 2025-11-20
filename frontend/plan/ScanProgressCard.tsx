import { Card, CardContent } from '@/components/ui/card'
import type { ScanProgress } from '@/hooks/useScan'

interface ScanProgressCardProps {
  progress: ScanProgress | null
}

export function ScanProgressCard({ progress }: ScanProgressCardProps) {
  return (
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
                  <span className="text-white font-semibold">
                    {(progress.files_scanned || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Directories: </span>
                  <span className="text-white font-semibold">
                    {(progress.dirs_scanned || 0).toLocaleString()}
                  </span>
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
  )
}
