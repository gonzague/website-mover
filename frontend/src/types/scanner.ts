// Scanner and planning types matching the Go backend

export interface FileEntry {
  path: string
  name: string
  size: number
  is_dir: boolean
  mod_time: string
  permissions: string
  mime_type?: string
  extension?: string
  is_symlink: boolean
  link_target?: string
  should_exclude: boolean
  exclude_reason?: string
}

export interface FileStatistics {
  total_files: number
  total_dirs: number
  total_size: number
  total_size_human: string
  largest_files: FileEntry[]
  files_by_type: Record<string, number>
  files_by_type_size: Record<string, number>
  directory_depth: number
  symlinks_count: number
  excluded_count: number
  excluded_size: number
}

export type CMSType = 'wordpress' | 'prestashop' | 'drupal' | 'joomla' | 'magento' | 'unknown'

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  prefix?: string
}

export interface CMSDetection {
  detected: boolean
  type: CMSType
  version?: string
  root_path: string
  config_file?: string
  database_config?: DatabaseConfig
  confidence: number
  indicators: string[]
}

export interface ExclusionPattern {
  pattern: string
  type: string
  reason: string
  is_automatic: boolean
  enabled: boolean
}

export interface ScanResult {
  success: boolean
  error_message?: string
  start_time: string
  end_time: string
  duration: number
  statistics: FileStatistics
  cms_detection?: CMSDetection
  files?: FileEntry[]
  exclusions: ExclusionPattern[]
  server_config: any
}

export type TransferMethod = 'fxp' | 'rsync_ssh' | 'sftp_stream' | 'lftp' | 'scp' | 'rclone' | 'tar_stream'

export interface TransferStrategy {
  method: TransferMethod
  score: number
  estimated_time: number
  estimated_time_str: string
  command: string
  command_explanation: string
  pros: string[]
  cons: string[]
  requirements: string[]
  is_recommended: boolean
  can_resume: boolean
  supports_progress: boolean
}

export interface PlanResult {
  success: boolean
  error_message?: string
  scan_result?: ScanResult
  source_probe?: any
  dest_probe?: any
  strategies: TransferStrategy[]
  recommended_strategy?: TransferStrategy
  warnings: string[]
  requires_database: boolean
  estimated_total_time: number
}

export interface ScanRequest {
  server_config: any
  max_depth?: number
  max_files?: number
  follow_symlinks: boolean
  detect_cms: boolean
  custom_exclusions?: string[]
  include_hidden: boolean
}
