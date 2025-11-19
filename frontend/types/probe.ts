export type Protocol = 'sftp' | 'ftp' | 'ftps' | 'scp' | 'http' | 'https'

export interface ConnectionConfig {
  protocol: Protocol
  host: string
  port: number
  username: string
  password: string
  ssh_key?: string
  root_path: string
}

export interface Capabilities {
  sftp_version?: string
  shell_available: boolean
  compression_types?: string[]
  mlsd_supported: boolean
  fxp_allowed: boolean
  ftp_features?: string[]
  can_read: boolean
  can_write: boolean
  can_list: boolean
}

export interface Performance {
  latency: number
  latency_ms: number
  upload_speed: number
  download_speed: number
  connection_time: number
  connection_time_ms: number
}

export interface FileStats {
  total_files: number
  total_size: number
  largest_file: number
  file_types: Record<string, number>
}

export interface ProbeResult {
  success: boolean
  error_message?: string
  protocol: Protocol
  capabilities: Capabilities
  performance: Performance
  file_stats?: FileStats
  badges: string[]
}
