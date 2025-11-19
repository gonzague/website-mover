const API_BASE = 'http://localhost:8080/api';

export interface Remote {
  name: string;
  type: string;
  host: string;
  user: string;
  password?: string;
  port: number;
  key_file?: string;
}

export interface MigrationOptions {
  source_remote: string;
  source_path: string;
  dest_remote: string;
  dest_path: string;
  excludes: string[];
  transfers: number;
  checkers: number;
  bandwidth_limit?: string;
  dry_run: boolean;
  delete_extraneous: boolean;
}

export interface MigrationJob {
  job_id: string;
  command: string;
  status: string;
}

export interface MigrationHistory {
  id: string;
  options: MigrationOptions;
  command: string;
  start_time: string;
  end_time: string;
  duration: string;
  status: string;
  output?: string[];
  total_bytes?: number;
  total_files?: number;
  transfer_speed?: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  files?: string[];
  error?: string;
}

// Remotes API
export async function listRemotes(): Promise<Remote[]> {
  const response = await fetch(`${API_BASE}/remotes`);
  const data = await response.json();
  return data.remotes || [];
}

export async function addRemote(remote: Remote): Promise<void> {
  const response = await fetch(`${API_BASE}/remotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(remote),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function deleteRemote(name: string): Promise<void> {
  const response = await fetch(`${API_BASE}/remotes/${name}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function testRemote(remoteName: string, path: string): Promise<TestResult> {
  const response = await fetch(`${API_BASE}/remotes/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      remote_name: remoteName,
      path: path,
    }),
  });

  return await response.json();
}

export interface FileItem {
  name: string;
  is_dir: boolean;
  size: number;
}

export async function listPath(remoteName: string, path: string): Promise<FileItem[]> {
  const params = new URLSearchParams({ path });
  const response = await fetch(`${API_BASE}/remotes/${remoteName}/list?${params}`);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  return data.items || [];
}

// Migrations API
export async function startMigration(options: MigrationOptions): Promise<MigrationJob> {
  const response = await fetch(`${API_BASE}/migrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function listMigrations(): Promise<{
  active: MigrationJob[];
  history: MigrationHistory[];
}> {
  const response = await fetch(`${API_BASE}/migrations`);
  return await response.json();
}

export async function listHistory(): Promise<MigrationHistory[]> {
  const response = await fetch(`${API_BASE}/history`);
  const data = await response.json();
  return data.history || [];
}

export async function clearHistory(): Promise<void> {
  const response = await fetch(`${API_BASE}/history`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function getHistory(id: string): Promise<MigrationHistory> {
  const response = await fetch(`${API_BASE}/history/${id}`);
  return await response.json();
}

export interface LiveStats {
  total_bytes: number;
  total_files: number;
  transfer_speed: string;
}

// Stream migration output
export function streamMigrationOutput(
  jobId: string,
  onLine: (line: string) => void,
  onStats: (stats: LiveStats) => void,
  onComplete: (status: string) => void,
  onError: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/migrations/${jobId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'output') {
        onLine(data.line);
      } else if (data.type === 'stats') {
        onStats(data.stats);
      } else if (data.type === 'complete') {
        onComplete(data.status);
        eventSource.close();
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
    onError(new Error('Stream connection failed'));
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

