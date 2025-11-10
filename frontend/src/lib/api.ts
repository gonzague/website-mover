/**
 * API client for communicating with the Go backend
 */

import type { ConnectionConfig, ProbeResult } from '@/types/probe'
import type { ScanRequest, ScanResult, PlanResult } from '@/types/scanner'
import type { TransferRequest } from '@/types/transfer'

// Use relative URLs for production, or explicit URL for development
const API_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8080' : '';

export interface HealthResponse {
  status: string;
  version: string;
}

export class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async probe(config: ConnectionConfig): Promise<ProbeResult> {
    const response = await fetch(`${this.baseUrl}/api/probe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Probe failed: ${response.statusText}`);
    }
    return response.json();
  }

  async scan(request: ScanRequest): Promise<ScanResult> {
    const response = await fetch(`${this.baseUrl}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Scan failed: ${response.statusText}`);
    }
    return response.json();
  }

  async plan(scanResult: ScanResult, sourceProbe: ProbeResult, destProbe: ProbeResult, sourceConfig: ConnectionConfig, destConfig: ConnectionConfig): Promise<PlanResult> {
    const response = await fetch(`${this.baseUrl}/api/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scan_result: scanResult,
        source_probe: sourceProbe,
        dest_probe: destProbe,
        source_config: sourceConfig,
        dest_config: destConfig,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Plan generation failed: ${response.statusText}`);
    }
    return response.json();
  }
}

// Export a singleton instance
export const apiClient = new APIClient();
