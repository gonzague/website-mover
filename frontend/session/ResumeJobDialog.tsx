import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, X, Clock, Server, ArrowRight } from 'lucide-react'
import type { Job } from '@/api/sessions'
import { formatDistanceToNow } from 'date-fns'

interface ResumeJobDialogProps {
  jobs: Job[]
  open: boolean
  onClose: () => void
  onResume: (job: Job) => void
  onCancel: (job: Job) => void
}

export function ResumeJobDialog({ jobs, open, onClose, onResume, onCancel }: ResumeJobDialogProps) {
  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'scan':
        return 'File Scan'
      case 'plan':
        return 'Migration Plan'
      case 'transfer':
        return 'File Transfer'
      default:
        return type
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-600'
      case 'pending':
        return 'bg-yellow-600'
      case 'paused':
        return 'bg-orange-600'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className="w-6 h-6 text-blue-400" />
            Resume Previous Operations
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            You have {jobs.length} operation{jobs.length > 1 ? 's' : ''} in progress. Would you like to resume or cancel?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="border border-slate-700 rounded-lg p-4 bg-slate-750 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge className={`${getStatusColor(job.status)} text-white`}>
                    {job.status}
                  </Badge>
                  <span className="font-semibold text-slate-100">
                    {getJobTypeLabel(job.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                {job.source_config && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Server className="w-4 h-4 text-slate-400" />
                    <span className="font-mono text-xs">
                      {job.source_config.username}@{job.source_config.host}
                    </span>
                    {job.dest_config && (
                      <>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                        <span className="font-mono text-xs">
                          {job.dest_config.username}@{job.dest_config.host}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {job.progress && typeof job.progress === 'object' && (
                  <div className="text-xs text-slate-400">
                    {(job.progress as any).status && (
                      <span>Status: {(job.progress as any).status}</span>
                    )}
                    {(job.progress as any).percent_complete !== undefined && (
                      <span className="ml-3">
                        Progress: {(job.progress as any).percent_complete.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}

                {job.error_message && (
                  <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                    {job.error_message}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    onResume(job)
                    onClose()
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                  onClick={() => {
                    onCancel(job)
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            className="border-slate-600 hover:bg-slate-700"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

