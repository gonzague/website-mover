import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatBytes } from '@/lib/formatting'
import type { FileStatistics } from '@/types/scanner'

interface StatisticsCardProps {
  statistics: FileStatistics
}

export function StatisticsCard({ statistics }: StatisticsCardProps) {
  return (
    <Card className="mb-6 bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">📊 Scan Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700/50 rounded p-4">
            <p className="text-slate-400 text-sm">Total Files</p>
            <p className="text-2xl font-bold text-white">
              {statistics.total_files.toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-4">
            <p className="text-slate-400 text-sm">Total Size</p>
            <p className="text-2xl font-bold text-white">
              {formatBytes(statistics.total_size)}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-4">
            <p className="text-slate-400 text-sm">Directories</p>
            <p className="text-2xl font-bold text-white">
              {statistics.total_dirs.toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-4">
            <p className="text-slate-400 text-sm">Directory Depth</p>
            <p className="text-2xl font-bold text-white">
              {statistics.directory_depth}
            </p>
          </div>
        </div>

        {statistics.largest_files && statistics.largest_files.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-2">Largest Files:</p>
            <div className="space-y-2">
              {statistics.largest_files.slice(0, 5).map((file, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-slate-700/30 rounded p-2 text-sm"
                >
                  <span className="text-slate-300 truncate flex-1">{file.name}</span>
                  <span className="text-slate-400 ml-4">{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
