// API client for session/job management

const API_BASE = 'http://localhost:8080/api'

export interface Job {
  id: string
  type: 'scan' | 'plan' | 'transfer'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  created_at: string
  updated_at: string
  completed_at?: string
  source_config: any
  dest_config?: any
  scan_result?: any
  plan_result?: any
  transfer_result?: any
  progress?: any
  error_message?: string
}

export async function getActiveSessions(): Promise<Job[]> {
  const response = await fetch(`${API_BASE}/sessions/active`)
  if (!response.ok) {
    throw new Error('Failed to fetch active sessions')
  }
  return response.json()
}

export async function getAllSessions(): Promise<Job[]> {
  const response = await fetch(`${API_BASE}/sessions`)
  if (!response.ok) {
    throw new Error('Failed to fetch sessions')
  }
  return response.json()
}

export async function getSession(id: string): Promise<Job> {
  const response = await fetch(`${API_BASE}/sessions/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch session ${id}`)
  }
  return response.json()
}

export async function cancelSession(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Failed to cancel session ${id}`)
  }
}

export async function clearCompletedSessions(): Promise<{ deleted: number }> {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to clear completed sessions')
  }
  return response.json()
}

