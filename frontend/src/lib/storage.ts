/**
 * Local storage utilities for persisting connection configurations
 */

import type { ConnectionConfig } from '@/types/probe'

const STORAGE_KEY_PREFIX = 'website-mover:'
const CONNECTIONS_KEY = `${STORAGE_KEY_PREFIX}connections`
const RECENT_CONNECTIONS_KEY = `${STORAGE_KEY_PREFIX}recent`

export interface SavedConnection {
  id: string
  name: string
  config: ConnectionConfig
  lastUsed: string
  createdAt: string
}

/**
 * Save a connection configuration
 */
export function saveConnection(config: ConnectionConfig, name?: string): SavedConnection {
  const connections = getSavedConnections()

  const id = generateId(config)
  const now = new Date().toISOString()

  // Check if this connection already exists
  const existingIndex = connections.findIndex(c => c.id === id)

  const savedConnection: SavedConnection = {
    id,
    name: name || `${config.username}@${config.host}`,
    config,
    lastUsed: now,
    createdAt: existingIndex >= 0 ? connections[existingIndex].createdAt : now,
  }

  if (existingIndex >= 0) {
    // Update existing
    connections[existingIndex] = savedConnection
  } else {
    // Add new
    connections.push(savedConnection)
  }

  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections))

  // Update recent list
  updateRecentConnections(id)

  return savedConnection
}

/**
 * Get all saved connections
 */
export function getSavedConnections(): SavedConnection[] {
  try {
    const data = localStorage.getItem(CONNECTIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load saved connections:', error)
    return []
  }
}

/**
 * Get recently used connection IDs (sorted by last used)
 */
export function getRecentConnectionIds(): string[] {
  try {
    const data = localStorage.getItem(RECENT_CONNECTIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load recent connections:', error)
    return []
  }
}

/**
 * Get recent connections (sorted by last used)
 */
export function getRecentConnections(limit = 5): SavedConnection[] {
  const recentIds = getRecentConnectionIds()
  const allConnections = getSavedConnections()

  return recentIds
    .slice(0, limit)
    .map(id => allConnections.find(c => c.id === id))
    .filter(Boolean) as SavedConnection[]
}

/**
 * Delete a saved connection
 */
export function deleteConnection(id: string): void {
  const connections = getSavedConnections()
  const filtered = connections.filter(c => c.id !== id)

  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(filtered))

  // Remove from recent
  const recentIds = getRecentConnectionIds()
  const filteredRecent = recentIds.filter(rid => rid !== id)
  localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(filteredRecent))
}

/**
 * Update recent connections list
 */
function updateRecentConnections(id: string): void {
  const recentIds = getRecentConnectionIds()

  // Remove if already in list
  const filtered = recentIds.filter(rid => rid !== id)

  // Add to front
  filtered.unshift(id)

  // Keep max 10 recent
  const limited = filtered.slice(0, 10)

  localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(limited))
}

/**
 * Generate a unique ID for a connection based on host, port, and username
 */
function generateId(config: ConnectionConfig): string {
  return `${config.protocol}-${config.host}-${config.port}-${config.username}`.toLowerCase()
}

/**
 * Clear all saved connections (for privacy)
 */
export function clearAllConnections(): void {
  localStorage.removeItem(CONNECTIONS_KEY)
  localStorage.removeItem(RECENT_CONNECTIONS_KEY)
}

// Session state persistence
const SESSION_STATE_KEY = `${STORAGE_KEY_PREFIX}session`

export interface SessionState {
  currentScreen: string
  sourceServer: any | null
  destServer: any | null
  scanResult: any | null
  planResult: any | null
  transferConfig: any | null
  timestamp: string
}

/**
 * Save the current session state
 */
export function saveSessionState(state: Omit<SessionState, 'timestamp'>): void {
  try {
    const sessionState: SessionState = {
      ...state,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(sessionState))
  } catch (error) {
    console.error('Failed to save session state:', error)
  }
}

/**
 * Load the session state (returns null if expired or not found)
 */
export function loadSessionState(): SessionState | null {
  try {
    const data = localStorage.getItem(SESSION_STATE_KEY)
    if (!data) return null

    const state: SessionState = JSON.parse(data)
    
    // Check if state is less than 24 hours old
    const timestamp = new Date(state.timestamp)
    const now = new Date()
    const hoursSinceLastSave = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceLastSave > 24) {
      // State is too old, clear it
      clearSessionState()
      return null
    }
    
    return state
  } catch (error) {
    console.error('Failed to load session state:', error)
    return null
  }
}

/**
 * Clear the session state
 */
export function clearSessionState(): void {
  localStorage.removeItem(SESSION_STATE_KEY)
}
