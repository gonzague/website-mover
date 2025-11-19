import { useState, useEffect } from 'react'
import { getActiveSessions, type Job } from '@/api/sessions'

/**
 * Hook to check for active jobs on mount
 * Returns active jobs and a function to refresh the list
 */
export function useActiveJobs() {
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActiveJobs = async () => {
    try {
      setLoading(true)
      setError(null)
      const jobs = await getActiveSessions()
      setActiveJobs(jobs || [])
    } catch (err) {
      console.error('Failed to fetch active jobs:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setActiveJobs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActiveJobs()
  }, [])

  return {
    activeJobs,
    loading,
    error,
    refresh: fetchActiveJobs,
  }
}

