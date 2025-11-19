import { useState, useEffect, useRef } from 'react';
import { listRemotes, startMigration, streamMigrationOutput } from '../../api/rclone';
import type { Remote, MigrationOptions } from '../../api/rclone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../../hooks/use-toast';
import { FileBrowserDialog } from './FileBrowserDialog';
import { FolderOpen } from 'lucide-react';

export default function MigrationScreen() {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(true);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // File Browser State
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserMode, setBrowserMode] = useState<'source' | 'dest' | null>(null);

  // Migration options
  const [options, setOptions] = useState<MigrationOptions>({
    source_remote: '',
    source_path: '/',
    dest_remote: '',
    dest_path: '/',
    excludes: [
      'wp-content/cache/**',
      'wp-content/uploads/cache/**',
      '.well-known/acme-challenge/**',
      'backup*.zip',
      '*.log',
    ],
    transfers: 8,
    checkers: 8,
    bandwidth_limit: '',
    dry_run: false,
    delete_extraneous: false,
  });

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [jobId, setJobId] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [liveStats, setLiveStats] = useState<{
    total_bytes: number;
    total_files: number;
    transfer_speed: string;
  } | null>(null);

  useEffect(() => {
    loadRemotes();
  }, []);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const loadRemotes = async () => {
    setLoading(true);
    try {
      const data = await listRemotes();
      setRemotes(data);
    } catch (error) {
      console.error('Failed to load remotes:', error);
      toast({
        title: "Error",
        description: "Failed to load remotes",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartMigration = async () => {
    if (!options.source_remote || !options.dest_remote) {
      toast({
        title: "Validation Error",
        description: "Please select source and destination remotes",
        type: "error"
      });
      return;
    }

    setExecuting(true);
    setOutput([]);
    setLiveStats(null);
    setStatus('starting');

    try {
      const job = await startMigration(options);
      setJobId(job.job_id);
      setCommand(job.command);
      setStatus(job.status);

      toast({
        title: "Migration Started",
        description: "Migration job has been initiated",
        type: "success"
      });

      // Stream output
      streamMigrationOutput(
        job.job_id,
        (line) => {
          setOutput((prev) => {
            const newOutput = [...prev, line];
            // Keep only last 500 lines to prevent browser crash
            if (newOutput.length > 500) {
              return newOutput.slice(-500);
            }
            return newOutput;
          });
        },
        (stats) => {
          setLiveStats(stats);
        },
        (finalStatus) => {
          setStatus(finalStatus);
          setExecuting(false);
          toast({
            title: "Migration Completed",
            description: `Status: ${finalStatus}`,
            type: finalStatus === 'completed' ? 'success' : 'error'
          });
        },
        (error) => {
          console.error('Stream error:', error);
          setStatus('error');
          setExecuting(false);
          toast({
            title: "Stream Error",
            description: "Connection to migration stream lost",
            type: "error"
          });
        }
      );
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to start migration: ${error}`,
        type: "error"
      });
      setExecuting(false);
    }
  };

  const openBrowser = (mode: 'source' | 'dest') => {
    const remote = mode === 'source' ? options.source_remote : options.dest_remote;
    if (!remote) {
      toast({
        title: "Select Remote",
        description: "Please select a remote first",
        type: "warning"
      });
      return;
    }
    setBrowserMode(mode);
    setBrowserOpen(true);
  };

  const handleBrowserSelect = (path: string) => {
    if (browserMode === 'source') {
      setOptions({ ...options, source_path: path });
    } else {
      setOptions({ ...options, dest_path: path });
    }
  };

  const addExclude = () => {
    setOptions({
      ...options,
      excludes: [...options.excludes, ''],
    });
  };

  const updateExclude = (index: number, value: string) => {
    const newExcludes = [...options.excludes];
    newExcludes[index] = value;
    setOptions({ ...options, excludes: newExcludes });
  };

  const removeExclude = (index: number) => {
    setOptions({
      ...options,
      excludes: options.excludes.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (remotes.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">
            You need at least 2 remotes configured to start a migration.
          </p>
          <p className="text-gray-600 mt-2">
            Go to the Remotes tab to add them.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Start Migration</h2>
        <p className="text-gray-600">Configure and execute rclone migration</p>
      </div>

      {/* Configuration Form */}
      {!executing && !jobId && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Configuration</CardTitle>
            <CardDescription>Set up source, destination, and options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Source</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source_remote">Remote</Label>
                  <Select
                    value={options.source_remote}
                    onValueChange={(value) => setOptions({ ...options, source_remote: value })}
                  >
                    <SelectTrigger id="source_remote">
                      <SelectValue placeholder="Select remote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {remotes.map((r) => (
                        <SelectItem key={r.name} value={r.name}>
                          {r.name} ({r.host})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_path">Path</Label>
                  <div className="flex gap-2">
                    <Input
                      id="source_path"
                      value={options.source_path}
                      onChange={(e) => setOptions({ ...options, source_path: e.target.value })}
                      placeholder="/"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openBrowser('source')}
                      title="Browse"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Destination */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Destination</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dest_remote">Remote</Label>
                  <Select
                    value={options.dest_remote}
                    onValueChange={(value) => setOptions({ ...options, dest_remote: value })}
                  >
                    <SelectTrigger id="dest_remote">
                      <SelectValue placeholder="Select remote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {remotes.map((r) => (
                        <SelectItem key={r.name} value={r.name}>
                          {r.name} ({r.host})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dest_path">Path</Label>
                  <div className="flex gap-2">
                    <Input
                      id="dest_path"
                      value={options.dest_path}
                      onChange={(e) => setOptions({ ...options, dest_path: e.target.value })}
                      placeholder="/"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openBrowser('dest')}
                      title="Browse"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Options */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Options</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transfers">Transfers</Label>
                  <Input
                    id="transfers"
                    type="number"
                    value={options.transfers}
                    onChange={(e) => setOptions({ ...options, transfers: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkers">Checkers</Label>
                  <Input
                    id="checkers"
                    type="number"
                    value={options.checkers}
                    onChange={(e) => setOptions({ ...options, checkers: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bandwidth">Bandwidth Limit</Label>
                  <Input
                    id="bandwidth"
                    value={options.bandwidth_limit}
                    onChange={(e) => setOptions({ ...options, bandwidth_limit: e.target.value })}
                    placeholder="e.g., 10M"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dry_run"
                    checked={options.dry_run}
                    onCheckedChange={(checked) => setOptions({ ...options, dry_run: checked as boolean })}
                  />
                  <Label htmlFor="dry_run">Dry run (don't actually transfer files)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="delete_extraneous"
                    checked={options.delete_extraneous}
                    onCheckedChange={(checked) => setOptions({ ...options, delete_extraneous: checked as boolean })}
                  />
                  <Label htmlFor="delete_extraneous">Delete extraneous files (use sync instead of copy)</Label>
                </div>
              </div>
            </div>

            {/* Excludes */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Exclude Patterns</h3>
                <Button type="button" variant="outline" size="sm" onClick={addExclude}>
                  Add Pattern
                </Button>
              </div>
              <div className="space-y-2">
                {options.excludes.map((exclude, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={exclude}
                      onChange={(e) => updateExclude(index, e.target.value)}
                      placeholder="e.g., *.log or cache/**"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeExclude(index)}
                    >
                      <span className="sr-only">Remove</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleStartMigration} className="w-full" size="lg">
              Start Migration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Execution Output */}
      {(executing || jobId) && (
        <Card>
          <CardHeader>
            <CardTitle>Migration in Progress</CardTitle>
            <CardDescription>
              Job ID: {jobId} | Status: {status}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Command */}
            <div className="mb-4">
              <Label>Command</Label>
              <div className="bg-gray-100 p-3 rounded font-mono text-sm overflow-x-auto mt-1">
                {command}
              </div>
            </div>

            {/* Live Stats */}
            {liveStats && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Live Statistics</h4>
                <div className="grid grid-cols-3 gap-4 bg-muted p-4 rounded-md">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Transferred</div>
                    <div className="text-2xl font-bold">
                      {formatBytes(liveStats.total_bytes)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Files</div>
                    <div className="text-2xl font-bold">
                      {liveStats.total_files}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Speed</div>
                    <div className="text-2xl font-bold text-green-500">
                      {liveStats.transfer_speed}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Output */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Output</Label>
                {output.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {output.length} lines {output.length >= 500 && '(showing last 500)'}
                  </span>
                )}
              </div>
              <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
                {output.length === 0 ? (
                  <div className="text-gray-500">Waiting for output...</div>
                ) : (
                  <>
                    {output.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                    <div ref={outputEndRef} />
                  </>
                )}
              </div>
            </div>

            {!executing && (
              <Button
                onClick={() => {
                  setJobId('');
                  setOutput([]);
                  setCommand('');
                  setStatus('');
                  setLiveStats(null);
                }}
                className="w-full mt-4"
              >
                Start New Migration
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <FileBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        remoteName={browserMode === 'source' ? options.source_remote : options.dest_remote}
        initialPath={browserMode === 'source' ? options.source_path : options.dest_path}
        onSelect={handleBrowserSelect}
        title={browserMode === 'source' ? "Select Source Folder" : "Select Destination Folder"}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
