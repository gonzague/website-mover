import { useState, useEffect, useRef } from 'react';
import { listRemotes, startMigration, streamMigrationOutput } from '../../api/rclone';
import type { Remote, MigrationOptions } from '../../api/rclone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function MigrationScreen() {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(true);
  const outputEndRef = useRef<HTMLDivElement>(null);
  
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
    } finally {
      setLoading(false);
    }
  };

  const handleStartMigration = async () => {
    if (!options.source_remote || !options.dest_remote) {
      alert('Please select source and destination remotes');
      return;
    }

    setExecuting(true);
    setOutput([]);
    setStatus('starting');

    try {
      const job = await startMigration(options);
      setJobId(job.job_id);
      setCommand(job.command);
      setStatus(job.status);

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
        (finalStatus) => {
          setStatus(finalStatus);
          setExecuting(false);
        },
        (error) => {
          console.error('Stream error:', error);
          setStatus('error');
          setExecuting(false);
        }
      );
    } catch (error) {
      alert(`Failed to start migration: ${error}`);
      setExecuting(false);
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
                <div>
                  <Label htmlFor="source_remote">Remote</Label>
                  <select
                    id="source_remote"
                    value={options.source_remote}
                    onChange={(e) => setOptions({ ...options, source_remote: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select remote...</option>
                    {remotes.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} ({r.host})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="source_path">Path</Label>
                  <Input
                    id="source_path"
                    value={options.source_path}
                    onChange={(e) => setOptions({ ...options, source_path: e.target.value })}
                    placeholder="/"
                  />
                </div>
              </div>
            </div>

            {/* Destination */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Destination</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dest_remote">Remote</Label>
                  <select
                    id="dest_remote"
                    value={options.dest_remote}
                    onChange={(e) => setOptions({ ...options, dest_remote: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select remote...</option>
                    {remotes.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} ({r.host})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="dest_path">Path</Label>
                  <Input
                    id="dest_path"
                    value={options.dest_path}
                    onChange={(e) => setOptions({ ...options, dest_path: e.target.value })}
                    placeholder="/"
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Options</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="transfers">Transfers</Label>
                  <Input
                    id="transfers"
                    type="number"
                    value={options.transfers}
                    onChange={(e) => setOptions({ ...options, transfers: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="checkers">Checkers</Label>
                  <Input
                    id="checkers"
                    type="number"
                    value={options.checkers}
                    onChange={(e) => setOptions({ ...options, checkers: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="bandwidth">Bandwidth Limit</Label>
                  <Input
                    id="bandwidth"
                    value={options.bandwidth_limit}
                    onChange={(e) => setOptions({ ...options, bandwidth_limit: e.target.value })}
                    placeholder="e.g., 10M"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.dry_run}
                    onChange={(e) => setOptions({ ...options, dry_run: e.target.checked })}
                    className="mr-2"
                  />
                  <span>Dry run (don't actually transfer files)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.delete_extraneous}
                    onChange={(e) => setOptions({ ...options, delete_extraneous: e.target.checked })}
                    className="mr-2"
                  />
                  <span>Delete extraneous files (use sync instead of copy)</span>
                </label>
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
                      size="sm"
                      onClick={() => removeExclude(index)}
                    >
                      Remove
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
              <div className="bg-gray-100 p-3 rounded font-mono text-sm overflow-x-auto">
                {command}
              </div>
            </div>

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
                }}
                className="w-full mt-4"
              >
                Start New Migration
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

