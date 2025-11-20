import { useState, useEffect } from 'react';
import { listHistory, getHistory, clearHistory } from '../../api/rclone';
import type { MigrationHistory } from '../../api/rclone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from '../../hooks/use-toast';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { EmptyState } from '../onboarding/EmptyState';
import { History } from 'lucide-react';

export default function HistoryScreen() {
  const [history, setHistory] = useState<MigrationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<MigrationHistory | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await listHistory();
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast({
        title: "Error",
        description: "Failed to load history",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedHistory(null);
      return;
    }

    setSelectedId(id);
    try {
      const details = await getHistory(id);
      setSelectedHistory(details);
    } catch (error) {
      console.error('Failed to load history details:', error);
      toast({
        title: "Error",
        description: "Failed to load details",
        type: "error"
      });
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      await loadHistory();
      toast({
        title: "Success",
        description: "History cleared successfully",
        type: "success"
      });
    } catch (error) {
      console.error('Failed to clear history:', error);
      toast({
        title: "Error",
        description: `Failed to clear history: ${error}`,
        type: "error"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div>Loading history...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Migration History</h2>
          <p className="text-gray-600">View past migrations and their results</p>
        </div>
        {history.length > 0 && (
          <Button
            variant="destructive"
            onClick={() => setShowClearConfirm(true)}
          >
            Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Migration History"
          description="Once you complete your first migration, it will appear here with detailed statistics and logs."
          helpText={
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900">What you'll see here:</p>
              <ul className="list-disc list-inside text-blue-800 space-y-1 ml-2">
                <li>Complete migration logs</li>
                <li>Transfer statistics (size, files, speed)</li>
                <li>The exact rclone command used</li>
                <li>Start/end times and duration</li>
              </ul>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{item.id}</CardTitle>
                      <Badge
                        variant={item.status === 'completed' ? 'default' : 'destructive'}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Source:</span> {item.options.source_remote}:{item.options.source_path}
                        </div>
                        <div>
                          <span className="font-medium">Destination:</span> {item.options.dest_remote}:{item.options.dest_path}
                        </div>
                        <div>
                          <span className="font-medium">Started:</span> {formatDate(item.start_time)}
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span> {item.duration}
                        </div>
                      </div>
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(item.id)}
                  >
                    {selectedId === item.id ? 'Hide Details' : 'View Details'}
                  </Button>
                </div>
              </CardHeader>

              {selectedId === item.id && selectedHistory && (
                <CardContent className="space-y-4 border-t pt-4">
                  {/* Stats */}
                  {(selectedHistory.total_bytes !== undefined || selectedHistory.total_files !== undefined) && (
                    <div>
                      <h4 className="font-semibold mb-2">Statistics</h4>
                      <div className="grid grid-cols-3 gap-4 bg-muted p-4 rounded-md">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Total Size</div>
                          <div className="text-lg font-bold">
                            {selectedHistory.total_bytes ? formatBytes(selectedHistory.total_bytes) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Files</div>
                          <div className="text-lg font-bold">
                            {selectedHistory.total_files !== undefined ? selectedHistory.total_files : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Speed</div>
                          <div className="text-lg font-bold">
                            {selectedHistory.transfer_speed || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Command */}
                  <div>
                    <h4 className="font-semibold mb-2">Command</h4>
                    <div className="bg-gray-100 p-3 rounded font-mono text-sm overflow-x-auto">
                      {selectedHistory.command}
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <h4 className="font-semibold mb-2">Options</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Transfers:</span> {selectedHistory.options.transfers}
                      </div>
                      <div>
                        <span className="font-medium">Checkers:</span> {selectedHistory.options.checkers}
                      </div>
                      <div>
                        <span className="font-medium">Dry Run:</span> {selectedHistory.options.dry_run ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Delete Extraneous:</span> {selectedHistory.options.delete_extraneous ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>

                  {/* Excludes */}
                  {selectedHistory.options.excludes.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Exclude Patterns</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {selectedHistory.options.excludes.map((pattern, i) => (
                            <li key={i} className="font-mono">{pattern}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Output Log */}
                  {selectedHistory.output && selectedHistory.output.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Output Log</h4>
                      <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-64 overflow-y-auto">
                        {selectedHistory.output.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear History"
        description="Are you sure you want to clear all migration history? This action cannot be undone."
        onConfirm={handleClearHistory}
        confirmText="Clear History"
        variant="destructive"
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
