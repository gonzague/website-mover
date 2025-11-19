import type { ConnectionConfig } from './probe';
import type { ExclusionPattern } from './scanner';

export type TransferMethod = 'sftp_stream' | 'rsync_ssh' | 'lftp' | 'tar_stream' | 'fxp';

export interface TransferRequest {
  source_config: ConnectionConfig;
  dest_config: ConnectionConfig;
  method: TransferMethod;
  exclusions: ExclusionPattern[];
  bandwidth_limit?: number; // MB/s
  enable_resume: boolean;
  verify_after_transfer: boolean;
  skip_large_files?: number; // MB
  dry_run: boolean;
}

export interface TransferProgress {
  status: string; // initializing, transferring, paused, completed, failed
  files_transferred: number;
  total_files: number;
  bytes_transferred: number;
  total_bytes: number;
  current_file: string;
  speed: number; // MB/s
  eta: number; // seconds
  percent_complete: number;
  errors_count: number;
  last_error?: string;
  start_time: string;
  elapsed_seconds: number;
}

export interface VerificationResult {
  success: boolean;
  source_files: number;
  dest_files: number;
  source_size: number;
  dest_size: number;
  missing_files: number;
  message: string;
}

export interface TransferResult {
  success: boolean;
  error_message?: string;
  files_transferred: number;
  bytes_transferred: number;
  duration: number; // nanoseconds
  average_speed: number; // MB/s
  errors_count: number;
  skipped_files?: string[];
  failed_files?: string[];
  verification_result?: VerificationResult;
}
