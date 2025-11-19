import { useState, useEffect } from 'react';
import { listHistory, getHistory } from '../../api/rclone';
import type { MigrationHistory } from '../../api/rclone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export default function HistoryScreen() {
  const [history, setHistory] = useState<MigrationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<MigrationHistory | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    setSelectedId(id);
    try {
      const details = await getHistory(id);
      setSelectedHistory(details);
    } catch (error) {
      console.error('Failed to load history details:', error);
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
      <div>
        <h2 className="text-2xl font-bold">Migration History</h2>
        <p className="text-gray-600">View past migrations and their results</p>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No migration history yet. Complete a migration to see it here.
          </CardContent>
        </Card>
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
    </div>
  );
}

