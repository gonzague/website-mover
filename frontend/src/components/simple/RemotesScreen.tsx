import { useState, useEffect } from 'react';
import { listRemotes, addRemote, deleteRemote, testRemote } from '../../api/rclone';
import type { Remote, TestResult } from '../../api/rclone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../../hooks/use-toast';
import { ConfirmationDialog } from '../ui/confirmation-dialog';

export default function RemotesScreen() {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testPaths, setTestPaths] = useState<Record<string, string>>({});

  // Confirmation Dialog State
  const [remoteToDelete, setRemoteToDelete] = useState<string | null>(null);

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
      toast({
        title: "Error",
        description: "Failed to load remotes",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRemote = (remote: Remote) => {
    setFormData({
      name: remote.name,
      type: remote.type,
      host: remote.host,
      user: remote.user,
      password: '', // Don't fill password for security, user must re-enter if changing
      port: remote.port,
      key_file: remote.key_file || '',
    });
    setEditingRemote(remote.name);
    setShowAddForm(true);
  };

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addRemote(formData);
      await loadRemotes();
      setShowAddForm(false);
      setEditingRemote(null);
      setFormData({
        name: '',
        type: 'sftp',
        host: '',
        user: '',
        password: '',
        port: 22,
        key_file: '',
      });
      toast({
        title: "Success",
        description: `Remote ${editingRemote ? 'updated' : 'added'} successfully`,
        type: "success"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save remote: ${error}`,
        type: "error"
      });
    }
  };

  const handleCancelEdit = () => {
    setShowAddForm(false);
    setEditingRemote(null);
    setFormData({
      name: '',
      type: 'sftp',
      host: '',
      user: '',
      password: '',
      port: 22,
      key_file: '',
    });
  };

  const confirmDelete = (name: string) => {
    setRemoteToDelete(name);
  };

  const handleDeleteRemote = async () => {
    if (!remoteToDelete) return;

    try {
      await deleteRemote(remoteToDelete);
      await loadRemotes();
      toast({
        title: "Success",
        description: `Remote ${remoteToDelete} deleted`,
        type: "success"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete remote: ${error}`,
        type: "error"
      });
    } finally {
      setRemoteToDelete(null);
    }
  };

  const handleTestRemote = async (remoteName: string) => {
    setTestResults(prev => ({ ...prev, [remoteName]: { success: false, message: 'Testing...' } }));

    // Use user specified path or default to empty string (home directory)
    const path = testPaths[remoteName] !== undefined ? testPaths[remoteName] : '';

    try {
      const result = await testRemote(remoteName, path);
      setTestResults(prev => ({ ...prev, [remoteName]: result }));
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Connected to ${remoteName}`,
          type: "success"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          type: "error"
        });
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [remoteName]: { success: false, message: 'Test failed', error: String(error) }
      }));
      toast({
        title: "Error",
        description: `Test failed: ${error}`,
        type: "error"
      });
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
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)}>
            Add Remote
          </Button>
        )}
      </div>

      {/* Add/Edit Remote Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRemote ? 'Edit Remote' : 'Add New Remote'}</CardTitle>
            <CardDescription>Configure SFTP or FTP connection</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRemote} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Remote Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., source-server"
                    required
                    disabled={!!editingRemote} // Cannot change name when editing (it's the ID)
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sftp">SFTP</SelectItem>
                      <SelectItem value="ftp">FTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="user">Username</Label>
                  <Input
                    id="user"
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingRemote ? "(Leave empty to keep existing)" : ""}
                  />
                  {editingRemote && <p className="text-xs text-gray-500 mt-1">Only enter to change password</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="key_file">SSH Key File (optional)</Label>
                <Input
                  id="key_file"
                  value={formData.key_file}
                  onChange={(e) => setFormData({ ...formData, key_file: e.target.value })}
                  placeholder="/path/to/private/key"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingRemote ? 'Update Remote' : 'Save Remote'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Remotes List */}
      <div className="grid gap-4">
        {remotes.length === 0 && !showAddForm ? (
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
                    <div className="flex items-center gap-2 mr-2">
                      <Input
                        className="w-32 h-8 text-sm"
                        placeholder="Path (default: home)"
                        value={testPaths[remote.name] || ''}
                        onChange={(e) => setTestPaths({ ...testPaths, [remote.name]: e.target.value })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestRemote(remote.name)}
                      >
                        Test
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRemote(remote)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmDelete(remote.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {testResults[remote.name] && (
                <CardContent>
                  <div className={`p-3 rounded ${testResults[remote.name].success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                    }`}>
                    <p className={`font-medium ${testResults[remote.name].success ? 'text-green-800' : 'text-red-800'
                      }`}>
                      {testResults[remote.name].message}
                    </p>
                    {testResults[remote.name].files && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p className="font-medium">Sample files (from {testPaths[remote.name] || 'home'}):</p>
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

      <ConfirmationDialog
        open={!!remoteToDelete}
        onOpenChange={(open) => !open && setRemoteToDelete(null)}
        title="Delete Remote"
        description={`Are you sure you want to delete "${remoteToDelete}"? This action cannot be undone.`}
        onConfirm={handleDeleteRemote}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
