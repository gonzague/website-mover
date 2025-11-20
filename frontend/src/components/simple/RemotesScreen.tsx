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
import { EmptyState } from '../onboarding/EmptyState';
import { HelpTooltip } from '../onboarding/HelpTooltip';
import { Server } from 'lucide-react';

export default function RemotesScreen() {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testPaths, setTestPaths] = useState<Record<string, string>>({});

  // Confirmation Dialog State
  const [remoteToDelete, setRemoteToDelete] = useState<string | null>(null);

  // Update port when type changes
  const handleTypeChange = (newType: string) => {
    const defaultPorts: Record<string, number> = {
      sftp: 22,
      ftp: 21,
      rsync: 873,
      s3: 0, // S3 doesn't use port
    };
    
    setFormData({
      ...formData,
      type: newType,
      port: defaultPorts[newType] || 22,
    });
  };

  // Form state
  const [formData, setFormData] = useState<Remote>({
    name: '',
    type: 'sftp',
    host: '',
    user: '',
    password: '',
    port: 22,
    key_file: '',
    // S3 fields
    provider: 'AWS',
    access_key_id: '',
    secret_access_key: '',
    region: 'us-east-1',
    endpoint: '',
    acl: 'private',
    params: {},
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
    // Extract S3 fields from params if present
    const params = remote.params || {};
    
    setFormData({
      name: remote.name,
      type: remote.type,
      host: remote.host,
      user: remote.user,
      password: '', // Don't fill password for security, user must re-enter if changing
      port: remote.port,
      key_file: remote.key_file || '',
      // S3 fields - check both top-level and params
      provider: remote.provider || params.provider || 'AWS',
      access_key_id: remote.access_key_id || params.access_key_id || '',
      secret_access_key: '', // Don't fill for security
      region: remote.region || params.region || 'us-east-1',
      endpoint: remote.endpoint || params.endpoint || '',
      acl: remote.acl || params.acl || 'private',
      params: params,
    });
    setEditingRemote(remote.name);
    setShowAddForm(true);
  };

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Build params based on backend type
      const params: Record<string, string> = {};
      
      if (formData.type === 's3') {
        if (formData.provider) params.provider = formData.provider;
        if (formData.access_key_id) params.access_key_id = formData.access_key_id;
        if (formData.secret_access_key) params.secret_access_key = formData.secret_access_key;
        if (formData.region) params.region = formData.region;
        if (formData.endpoint) params.endpoint = formData.endpoint;
        if (formData.acl) params.acl = formData.acl;
      }
      
      const remoteData = {
        ...formData,
        params: Object.keys(params).length > 0 ? params : undefined,
      };
      
      await addRemote(remoteData);
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
        provider: 'AWS',
        access_key_id: '',
        secret_access_key: '',
        region: 'us-east-1',
        endpoint: '',
        acl: 'private',
        params: {},
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
      provider: 'AWS',
      access_key_id: '',
      secret_access_key: '',
      region: 'us-east-1',
      endpoint: '',
      acl: 'private',
      params: {},
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
                  <div className="flex items-center">
                    <Label htmlFor="name">Remote Name</Label>
                    <HelpTooltip
                      title="Remote Name"
                      content={
                        <div className="space-y-2">
                          <p>A unique identifier for this server connection. Use something descriptive like:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>source-server</li>
                            <li>old-hosting</li>
                            <li>production-site</li>
                          </ul>
                        </div>
                      }
                    />
                  </div>
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
                  <div className="flex items-center">
                    <Label htmlFor="type">Type</Label>
                    <HelpTooltip
                      title="Connection Type"
                      content={
                        <div className="space-y-2">
                          <p><strong>SFTP:</strong> Secure FTP over SSH (port 22). Most common and secure.</p>
                          <p><strong>FTP:</strong> Traditional file transfer protocol. Less secure but widely supported.</p>
                          <p><strong>Rsync:</strong> Efficient sync protocol. Only transfers changed portions of files. Requires rsync on both servers.</p>
                          <p><strong>S3:</strong> Amazon S3 or compatible cloud storage. Great for backups and static hosting.</p>
                          <p className="text-sm text-gray-600 pt-2">💡 Tip: Use SFTP for standard migrations, Rsync for large repeated syncs, S3 for backups.</p>
                        </div>
                      }
                    />
                  </div>
                  <Select
                    value={formData.type}
                    onValueChange={handleTypeChange}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sftp">SFTP</SelectItem>
                      <SelectItem value="ftp">FTP</SelectItem>
                      <SelectItem value="rsync">Rsync</SelectItem>
                      <SelectItem value="s3">Amazon S3 / Compatible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* S3-specific fields */}
              {formData.type === 's3' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="provider">Provider</Label>
                        <HelpTooltip
                          title="S3 Provider"
                          content={
                            <div className="space-y-2">
                              <p>The S3-compatible service you're using:</p>
                              <ul className="list-disc list-inside ml-2">
                                <li><strong>AWS:</strong> Amazon Web Services S3</li>
                                <li><strong>DigitalOcean:</strong> DigitalOcean Spaces</li>
                                <li><strong>Wasabi:</strong> Wasabi Hot Cloud Storage</li>
                                <li><strong>Backblaze:</strong> Backblaze B2 S3 Compatible</li>
                                <li><strong>Minio:</strong> Self-hosted S3-compatible</li>
                              </ul>
                            </div>
                          }
                        />
                      </div>
                      <Select
                        value={formData.provider}
                        onValueChange={(value) => setFormData({ ...formData, provider: value })}
                      >
                        <SelectTrigger id="provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AWS">AWS S3</SelectItem>
                          <SelectItem value="DigitalOcean">DigitalOcean Spaces</SelectItem>
                          <SelectItem value="Wasabi">Wasabi</SelectItem>
                          <SelectItem value="Backblaze">Backblaze B2</SelectItem>
                          <SelectItem value="Minio">Minio</SelectItem>
                          <SelectItem value="Other">Other S3-Compatible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="region">Region</Label>
                        <HelpTooltip
                          title="Region"
                          content={
                            <div className="space-y-2">
                              <p>The AWS region or data center location.</p>
                              <p className="text-sm">Examples: us-east-1, eu-west-1, ap-southeast-1</p>
                              <p className="text-sm text-gray-600">For non-AWS providers, check their documentation for region format.</p>
                            </div>
                          }
                        />
                      </div>
                      <Input
                        id="region"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        placeholder="us-east-1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="access_key_id">Access Key ID</Label>
                        <HelpTooltip
                          title="Access Key ID"
                          content={
                            <div className="space-y-2">
                              <p>Your S3 access key ID (public identifier).</p>
                              <p className="text-sm text-gray-600">Find this in your provider's IAM or API keys section.</p>
                            </div>
                          }
                        />
                      </div>
                      <Input
                        id="access_key_id"
                        value={formData.access_key_id}
                        onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="secret_access_key">Secret Access Key</Label>
                        <HelpTooltip
                          title="Secret Access Key"
                          content={
                            <div className="space-y-2">
                              <p>Your S3 secret access key (private key).</p>
                              <p className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
                                ⚠️ Keep this secret! It's like a password for your S3 buckets.
                              </p>
                            </div>
                          }
                        />
                      </div>
                      <Input
                        id="secret_access_key"
                        type="password"
                        value={formData.secret_access_key}
                        onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
                        placeholder={editingRemote ? "(Leave empty to keep existing)" : ""}
                        required={!editingRemote}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="endpoint">Endpoint (optional)</Label>
                        <HelpTooltip
                          title="Custom Endpoint"
                          content={
                            <div className="space-y-2">
                              <p>Custom S3 endpoint URL. Only needed for:</p>
                              <ul className="list-disc list-inside ml-2 text-sm">
                                <li>Non-AWS providers (DigitalOcean, Minio, etc.)</li>
                                <li>Self-hosted S3-compatible services</li>
                              </ul>
                              <p className="text-sm">Example: https://nyc3.digitaloceanspaces.com</p>
                              <p className="text-sm text-gray-600">Leave empty for standard AWS S3.</p>
                            </div>
                          }
                        />
                      </div>
                      <Input
                        id="endpoint"
                        value={formData.endpoint}
                        onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                        placeholder="https://s3.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="acl">ACL</Label>
                        <HelpTooltip
                          title="Access Control List"
                          content={
                            <div className="space-y-2">
                              <p>Default permissions for uploaded files:</p>
                              <ul className="list-disc list-inside ml-2 text-sm">
                                <li><strong>private:</strong> Only you can access (most secure)</li>
                                <li><strong>public-read:</strong> Anyone can read files</li>
                                <li><strong>authenticated-read:</strong> Authenticated users only</li>
                              </ul>
                              <p className="text-sm text-gray-600 pt-2">💡 Use "private" for backups and site files.</p>
                            </div>
                          }
                        />
                      </div>
                      <Select
                        value={formData.acl}
                        onValueChange={(value) => setFormData({ ...formData, acl: value })}
                      >
                        <SelectTrigger id="acl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="public-read">Public Read</SelectItem>
                          <SelectItem value="public-read-write">Public Read/Write</SelectItem>
                          <SelectItem value="authenticated-read">Authenticated Read</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* SFTP/FTP/Rsync fields */}
              {(formData.type === 'sftp' || formData.type === 'ftp' || formData.type === 'rsync') && (
                <>

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

              {formData.type === 'sftp' && (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="key_file">SSH Key File (optional)</Label>
                    <HelpTooltip
                      title="SSH Key Authentication"
                      content={
                        <div className="space-y-2">
                          <p>Use SSH key-based authentication instead of password. More secure and convenient.</p>
                          <p className="text-sm text-gray-600">Example paths:</p>
                          <ul className="list-disc list-inside ml-2 text-sm">
                            <li>~/.ssh/id_rsa</li>
                            <li>~/.ssh/id_ed25519</li>
                            <li>/path/to/custom/key</li>
                          </ul>
                          <p className="text-sm text-gray-600 pt-2">If specified, password will be ignored.</p>
                        </div>
                      }
                    />
                  </div>
                  <Input
                    id="key_file"
                    value={formData.key_file}
                    onChange={(e) => setFormData({ ...formData, key_file: e.target.value })}
                    placeholder="~/.ssh/id_rsa"
                  />
                </div>
              )}
              </>
              )}

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
          <EmptyState
            icon={Server}
            title="No Remotes Configured"
            description="You need to configure at least 2 remotes (source and destination) to start migrating files."
            action={{
              label: "Add Your First Remote",
              onClick: () => setShowAddForm(true)
            }}
            helpText={
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-blue-900">💡 What are remotes?</p>
                <p className="text-blue-800">
                  Remotes are your server connections (SFTP/FTP). You'll need:
                </p>
                <ul className="list-disc list-inside text-blue-800 space-y-1 ml-2">
                  <li><strong>Source:</strong> Where files are coming from</li>
                  <li><strong>Destination:</strong> Where files are going to</li>
                </ul>
              </div>
            }
          />
        ) : (
          remotes.map((remote) => (
            <Card key={remote.name}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{remote.name}</CardTitle>
                    <CardDescription>
                      {remote.type === 's3' ? (
                        <>
                          {remote.type.toUpperCase()} - {remote.params?.provider || remote.provider || 'AWS'} ({remote.params?.region || remote.region || 'us-east-1'})
                        </>
                      ) : (
                        <>
                          {remote.type.toUpperCase()} - {remote.user}@{remote.host}:{remote.port}
                        </>
                      )}
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
