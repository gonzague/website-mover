import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, X, CheckCircle, AlertCircle, Clock, HardDrive, Files } from 'lucide-react';
import type { PlanResult } from '@/types/scanner';
import type { ConnectionConfig } from '@/types/probe';

interface TransferExecutionScreenProps {
  plan: PlanResult;
  sourceConfig: ConnectionConfig;
  destConfig: ConnectionConfig;
  onComplete: () => void;
  onBack: () => void;
}

interface TransferProgress {
  status: string;
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

interface TransferResult {
  success: boolean;
  error_message?: string;
  files_transferred: number;
  bytes_transferred: number;
  duration: number;
  average_speed: number;
  errors_count: number;
  skipped_files?: string[];
  failed_files?: string[];
  verification_result?: {
    success: boolean;
    source_files: number;
    dest_files: number;
    source_size: number;
    dest_size: number;
    missing_files: number;
    message: string;
  };
}

export function TransferExecutionScreen({
  plan,
  sourceConfig,
  destConfig,
  onComplete,
  onBack
}: TransferExecutionScreenProps) {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startTransfer = () => {
    setIsTransferring(true);
    setError(null);
    setProgress(null);
    setResult(null);

    // Prepare transfer request
    const transferRequest = {
      source_config: sourceConfig,
      dest_config: destConfig,
      method: plan.recommended_method,
      exclusions: plan.exclusions || [],
      bandwidth_limit: null,
      enable_resume: false,
      verify_after_transfer: true,
      skip_large_files: null,
      dry_run: false,
    };

    const API_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8080' : '';

    // Use fetch to POST the request and handle streaming
    fetch(`${API_BASE_URL}/api/transfer/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transferRequest),
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Transfer failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setIsTransferring(false);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const parsed = JSON.parse(data);

              if (currentEvent === 'complete') {
                setResult(parsed);
                setIsTransferring(false);
              } else if (currentEvent === 'error') {
                setError(parsed.error || 'Transfer failed');
                setIsTransferring(false);
              } else {
                // Regular progress update
                setProgress(parsed);
              }
              currentEvent = '';
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    }).catch((err) => {
      setError(err.message);
      setIsTransferring(false);
    });
  };

  useEffect(() => {
    // Auto-start transfer when component mounts
    startTransfer();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'transferring':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'failed':
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5" />;
      case 'transferring':
        return <Play className="h-5 w-5" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transfer Execution</h2>
          <p className="text-muted-foreground">
            Transferring files from {sourceConfig.host} to {destConfig.host}
          </p>
        </div>
        <Button variant="outline" onClick={onBack} disabled={isTransferring}>
          Back to Plan
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {progress && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Badge className={getStatusColor(progress.status)}>
                  {getStatusIcon(progress.status)}
                  <span className="ml-2 capitalize">{progress.status}</span>
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                {/* Pause/Resume/Cancel buttons can be added here */}
              </div>
            </div>
            <CardDescription>
              Method: {plan.recommended_method}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Overall Progress</span>
                <span className="text-muted-foreground">
                  {progress.percent_complete.toFixed(1)}%
                </span>
              </div>
              <Progress value={progress.percent_complete} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(progress.bytes_transferred)} / {formatBytes(progress.total_bytes)}
                </span>
                <span>
                  {progress.files_transferred} / {progress.total_files} files
                </span>
              </div>
            </div>

            {/* Current File */}
            {progress.current_file && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Current File</div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {progress.current_file}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HardDrive className="h-3 w-3" />
                  Speed
                </div>
                <div className="text-lg font-semibold">
                  {progress.speed.toFixed(2)} MB/s
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  ETA
                </div>
                <div className="text-lg font-semibold">
                  {progress.eta > 0 ? formatDuration(progress.eta) : '-'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Elapsed
                </div>
                <div className="text-lg font-semibold">
                  {formatDuration(progress.elapsed_seconds)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Files className="h-3 w-3" />
                  Files
                </div>
                <div className="text-lg font-semibold">
                  {progress.files_transferred} / {progress.total_files}
                </div>
              </div>
            </div>

            {/* Errors */}
            {progress.errors_count > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">{progress.errors_count} errors occurred</div>
                  {progress.last_error && (
                    <div className="text-xs mt-1">{progress.last_error}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result Summary */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Transfer Completed Successfully
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Transfer Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.error_message && (
              <Alert variant="destructive">
                <AlertDescription>{result.error_message}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Files Transferred</div>
                <div className="text-2xl font-semibold">{result.files_transferred}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Data Transferred</div>
                <div className="text-2xl font-semibold">{formatBytes(result.bytes_transferred)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Average Speed</div>
                <div className="text-2xl font-semibold">{result.average_speed.toFixed(2)} MB/s</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-2xl font-semibold">{formatDuration(Math.floor(result.duration / 1000000000))}</div>
              </div>
            </div>

            {result.verification_result && (
              <div className="space-y-2 pt-4 border-t">
                <div className="font-semibold">Verification Result</div>
                <div className={`text-sm ${result.verification_result.success ? 'text-green-600' : 'text-red-600'}`}>
                  {result.verification_result.message}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Source: {result.verification_result.source_files} files ({formatBytes(result.verification_result.source_size)})</div>
                  <div>Destination: {result.verification_result.dest_files} files ({formatBytes(result.verification_result.dest_size)})</div>
                </div>
              </div>
            )}

            {result.skipped_files && result.skipped_files.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <div className="font-semibold">Skipped Files ({result.skipped_files.length})</div>
                <div className="max-h-32 overflow-y-auto text-xs font-mono space-y-1">
                  {result.skipped_files.map((file, idx) => (
                    <div key={idx} className="text-muted-foreground">{file}</div>
                  ))}
                </div>
              </div>
            )}

            {result.failed_files && result.failed_files.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <div className="font-semibold text-red-600">Failed Files ({result.failed_files.length})</div>
                <div className="max-h-32 overflow-y-auto text-xs font-mono space-y-1">
                  {result.failed_files.map((file, idx) => (
                    <div key={idx} className="text-red-600">{file}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={onComplete} className="flex-1">
                {result.success ? 'Finish' : 'Return to Plan'}
              </Button>
              {!result.success && (
                <Button variant="outline" onClick={startTransfer}>
                  Retry Transfer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initial State */}
      {!progress && !result && !error && !isTransferring && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">Preparing transfer...</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
