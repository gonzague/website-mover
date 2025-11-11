import type { ConnectionConfig, ProbeResult, Protocol } from '@/types/probe'

/**
 * Creates a failed probe result for error handling
 */
export function createFailedProbeResult(
  protocol: Protocol,
  error: unknown
): ProbeResult {
  return {
    success: false,
    error_message: error instanceof Error ? error.message : 'Unknown error',
    protocol,
    capabilities: {
      shell_available: false,
      mlsd_supported: false,
      fxp_allowed: false,
      can_read: false,
      can_write: false,
      can_list: false,
    },
    performance: {
      latency: 0,
      latency_ms: 0,
      upload_speed: 0,
      download_speed: 0,
      connection_time: 0,
      connection_time_ms: 0,
    },
    badges: [],
  }
}
