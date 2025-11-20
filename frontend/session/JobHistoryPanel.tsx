import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { History, CheckCircle, XCircle, Clock, Loader2, Server, ArrowRight, Trash2, Eye } from 'lucide-react'
import { getAllSessions, clearCompletedSessions, type Job } from '@/api/sessions'
import { formatDistanceToNow, format } from 'date-fns'

interface JobHistoryPanelProps {
  open: boolean
  onClose: () => void
}

export function JobHistoryPanel({ open, onClose }: JobHistoryPanelProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (open) {
      loadJobs()
    }
  }, [open])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const allJobs = await getAllSessions()
      // Sort by created_at desc
      setJobs(allJobs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))
    } catch (error) {
      console.error('Failed to load job history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClearCompleted = async () => {
    if (!confirm('Clear all completed/failed jobs?')) return
    
    setClearing(true)
    try {
      const result = await clearCompletedSessions()
      console.log(`Cleared ${result.deleted} completed jobs`)
      await loadJobs()
    } catch (error) {
      console.error('Failed to clear completed jobs:', error)
    } finally {
      setClearing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-orange-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600'
      case 'failed':
        return 'bg-red-600'
      case 'running':
        return 'bg-blue-600'
      case 'pending':
        return 'bg-yellow-600'
      case 'cancelled':
        return 'bg-orange-600'
      default:
        return 'bg-gray-600'
    }
  }

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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-6 h-6 text-blue-400" />
              <span>Job History</span>
              <Badge variant="outline" className="ml-2">
                {jobs.length} jobs
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-900/20"
              onClick={handleClearCompleted}
              disabled={clearing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {clearing ? 'Clearing...' : 'Clear Completed'}
            </Button>
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            View all migration operations from the past 24 hours
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <History className="w-12 h-12 mb-3 opacity-50" />
            <p>No job history yet</p>
            <p className="text-sm">Start a migration to see it here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Jobs List */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedJob?.id === job.id
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-slate-700 bg-slate-750 hover:bg-slate-700'
                    }`}
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className="font-semibold text-sm">
                          {getJobTypeLabel(job.type)}
                        </span>
                      </div>
                      <Badge className={`${getStatusColor(job.status)} text-white text-xs`}>
                        {job.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </div>
                      {job.source_config && (
                        <div className="font-mono truncate">
                          {job.source_config.host}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Job Details */}
            <div className="border border-slate-700 rounded-lg p-4 bg-slate-750">
              {selectedJob ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        {getStatusIcon(selectedJob.status)}
                        {getJobTypeLabel(selectedJob.type)}
                      </h3>
                      <Badge className={`${getStatusColor(selectedJob.status)} text-white`}>
                        {selectedJob.status}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-400">Job ID:</span>
                        <div className="font-mono text-xs bg-slate-900 p-2 rounded mt-1 break-all">
                          {selectedJob.id}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">Created:</span>
                        <div className="text-slate-200">
                          {format(new Date(selectedJob.created_at), 'PPpp')}
                        </div>
                      </div>

                      {selectedJob.completed_at && (
                        <div>
                          <span className="text-slate-400">Completed:</span>
                          <div className="text-slate-200">
                            {format(new Date(selectedJob.completed_at), 'PPpp')}
                          </div>
                        </div>
                      )}

                      {selectedJob.source_config && (
                        <div>
                          <span className="text-slate-400 block mb-1">Source Server:</span>
                          <div className="flex items-center gap-2 font-mono text-xs bg-slate-900 p-2 rounded">
                            <Server className="w-4 h-4 text-slate-400" />
                            {selectedJob.source_config.username}@{selectedJob.source_config.host}:{selectedJob.source_config.port}
                          </div>
                          {selectedJob.source_config.root_path && (
                            <div className="text-xs text-slate-400 mt-1">
                              Path: {selectedJob.source_config.root_path}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedJob.dest_config && (
                        <div>
                          <span className="text-slate-400 block mb-1">Destination Server:</span>
                          <div className="flex items-center gap-2 font-mono text-xs bg-slate-900 p-2 rounded">
                            <Server className="w-4 h-4 text-slate-400" />
                            {selectedJob.dest_config.username}@{selectedJob.dest_config.host}:{selectedJob.dest_config.port}
                          </div>
                        </div>
                      )}

                      {selectedJob.scan_result && (
                        <div>
                          <span className="text-slate-400 block mb-1">Scan Results:</span>
                          <div className="bg-slate-900 p-3 rounded space-y-1 text-xs">
                            <div>Files: {selectedJob.scan_result.statistics?.total_files || 0}</div>
                            <div>Size: {selectedJob.scan_result.statistics?.total_size_human || 'N/A'}</div>
                            {selectedJob.scan_result.cms_detection?.detected && (
                              <div>CMS: {selectedJob.scan_result.cms_detection.type}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedJob.transfer_result && (
                        <div>
                          <span className="text-slate-400 block mb-1">Transfer Results:</span>
                          <div className="bg-slate-900 p-3 rounded space-y-1 text-xs">
                            <div>Files Transferred: {selectedJob.transfer_result.files_transferred || 0}</div>
                            <div>Bytes Transferred: {formatBytes(selectedJob.transfer_result.bytes_transferred || 0)}</div>
                            <div>Average Speed: {(selectedJob.transfer_result.average_speed || 0).toFixed(2)} MB/s</div>
                            {selectedJob.transfer_result.errors_count > 0 && (
                              <div className="text-red-400">Errors: {selectedJob.transfer_result.errors_count}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedJob.error_message && (
                        <div>
                          <span className="text-slate-400 block mb-1">Error:</span>
                          <div className="text-xs text-red-400 bg-red-900/20 p-3 rounded">
                            {selectedJob.error_message}
                          </div>
                        </div>
                      )}

                      {selectedJob.progress && typeof selectedJob.progress === 'object' && (
                        <div>
                          <span className="text-slate-400 block mb-1">Progress:</span>
                          <pre className="text-xs bg-slate-900 p-3 rounded overflow-auto">
                            {JSON.stringify(selectedJob.progress, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Eye className="w-12 h-12 mb-3 opacity-50" />
                  <p>Select a job to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

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

