import { useState, useEffect } from 'react';
import { listRemotes, addRemote, deleteRemote, testRemote } from '../../api/rclone';
import type { Remote, TestResult } from '../../api/rclone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function RemotesScreen() {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Form state
  const [formData, setFormData] = useState<Remote>({
    name: '',
    type: 'sftp',
    host: '',
    user: '',
    password: '',
    port: 22,
    key_file: '',
  });

  useEffect(() => {
    loadRemotes();
  }, []);

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

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addRemote(formData);
      await loadRemotes();
      setShowAddForm(false);
      setFormData({
        name: '',
        type: 'sftp',
        host: '',
        user: '',
        password: '',
        port: 22,
        key_file: '',
      });
    } catch (error) {
      alert(`Failed to add remote: ${error}`);
    }
  };

  const handleDeleteRemote = async (name: string) => {
    if (!confirm(`Delete remote "${name}"?`)) return;
    
    try {
      await deleteRemote(name);
      await loadRemotes();
    } catch (error) {
      alert(`Failed to delete remote: ${error}`);
    }
  };

  const handleTestRemote = async (remote: Remote) => {
    setTestResults(prev => ({ ...prev, [remote.name]: { success: false, message: 'Testing...' } }));
    
    try {
      const result = await testRemote(remote.name, '/');
      setTestResults(prev => ({ ...prev, [remote.name]: result }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [remote.name]: { success: false, message: 'Test failed', error: String(error) }
      }));
    }
  };

  if (loading) {
    return <div>Loading remotes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Remote Connections</h2>
          <p className="text-gray-600">Configure SFTP/FTP remotes for source and destination</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : 'Add Remote'}
        </Button>
      </div>

      {/* Add Remote Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Remote</CardTitle>
            <CardDescription>Configure a new SFTP or FTP connection</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRemote} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Remote Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., source-server"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="sftp">SFTP</option>
                    <option value="ftp">FTP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user">Username</Label>
                  <Input
                    id="user"
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty if using SSH key</p>
                </div>
              </div>

              <div>
                <Label htmlFor="key_file">SSH Key File (optional)</Label>
                <Input
                  id="key_file"
                  value={formData.key_file}
                  onChange={(e) => setFormData({ ...formData, key_file: e.target.value })}
                  placeholder="/path/to/private/key"
                />
              </div>

              <Button type="submit" className="w-full">
                Save Remote
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Remotes List */}
      <div className="grid gap-4">
        {remotes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No remotes configured. Add one to get started!
            </CardContent>
          </Card>
        ) : (
          remotes.map((remote) => (
            <Card key={remote.name}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{remote.name}</CardTitle>
                    <CardDescription>
                      {remote.type.toUpperCase()} - {remote.user}@{remote.host}:{remote.port}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestRemote(remote)}
                    >
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRemote(remote.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {testResults[remote.name] && (
                <CardContent>
                  <div className={`p-3 rounded ${
                    testResults[remote.name].success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`font-medium ${
                      testResults[remote.name].success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {testResults[remote.name].message}
                    </p>
                    {testResults[remote.name].files && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p className="font-medium">Sample files:</p>
                        <ul className="list-disc list-inside">
                          {testResults[remote.name].files!.slice(0, 5).map((file, i) => (
                            <li key={i}>{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {testResults[remote.name].error && (
                      <p className="mt-2 text-sm text-red-600">
                        {testResults[remote.name].error}
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

