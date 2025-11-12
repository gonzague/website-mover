import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { ConnectionConfig, Protocol } from '@/types/probe'
import { getSavedConnections, saveConnection, deleteConnection, type SavedConnection } from '@/lib/storage'

interface ConnectionFormProps {
  title: string
  onTest: (config: ConnectionConfig) => Promise<void>
  loading?: boolean
}

export function ConnectionForm({ title, onTest, loading = false }: ConnectionFormProps) {
  const [config, setConfig] = useState<ConnectionConfig>({
    protocol: 'sftp',
    host: '',
    port: 22,
    username: '',
    password: '',
    root_path: '/',
  })

  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([])
  const [showSaved, setShowSaved] = useState(false)

  // Load saved connections on mount
  useEffect(() => {
    setSavedConnections(getSavedConnections())
  }, [])

  const handleProtocolChange = (protocol: Protocol) => {
    // Set default port based on protocol
    let defaultPort = 22
    switch (protocol) {
      case 'sftp':
      case 'scp':
        defaultPort = 22
        break
      case 'ftp':
        defaultPort = 21
        break
      case 'ftps':
        defaultPort = 990
        break
    }
    setConfig({ ...config, protocol, port: defaultPort })
  }

  const handleLoadConnection = (savedConn: SavedConnection) => {
    setConfig(savedConn.config)
    setShowSaved(false)
  }

  const handleDeleteConnection = (id: string) => {
    deleteConnection(id)
    setSavedConnections(getSavedConnections())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onTest(config)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Saved Connections Section */}
      {savedConnections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Saved Connections</Label>
            <Badge variant="outline" className="text-xs">
              {savedConnections.length}
            </Badge>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between text-slate-200 hover:text-white border-slate-600 hover:border-slate-500 hover:bg-slate-700"
              onClick={() => setShowSaved(!showSaved)}
            >
              <span>{showSaved ? 'Hide' : 'Show'} saved connections</span>
              <span>{showSaved ? '▲' : '▼'}</span>
            </Button>

            {showSaved && (
              <div className="border border-slate-600 rounded-md divide-y divide-slate-600 max-h-64 overflow-y-auto bg-slate-800/50">
                {savedConnections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-3 hover:bg-slate-700/70 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate text-slate-100">{conn.name}</div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        {conn.config.protocol.toUpperCase()} • {conn.config.host}:{conn.config.port}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Last used: {new Date(conn.lastUsed).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                        onClick={() => handleLoadConnection(conn)}
                      >
                        Load
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                        onClick={() => handleDeleteConnection(conn.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="protocol">Protocol</Label>
        <Select
          id="protocol"
          value={config.protocol}
          onChange={(e) => handleProtocolChange(e.target.value as Protocol)}
          disabled={loading}
        >
          <option value="sftp">SFTP</option>
          <option value="ftp">FTP</option>
          <option value="ftps">FTPS</option>
          <option value="scp">SCP</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="host">Host</Label>
        <Input
          id="host"
          type="text"
          placeholder="example.com"
          value={config.host}
          onChange={(e) => setConfig({ ...config, host: e.target.value })}
          disabled={loading}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            placeholder="22"
            value={config.port}
            onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 22 })}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="user"
            value={config.username}
            onChange={(e) => setConfig({ ...config, username: e.target.value })}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={config.password}
          onChange={(e) => setConfig({ ...config, password: e.target.value })}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="root_path">Root Path</Label>
        <Input
          id="root_path"
          type="text"
          placeholder="/public_html"
          value={config.root_path}
          onChange={(e) => setConfig({ ...config, root_path: e.target.value })}
          disabled={loading}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700"
        disabled={loading}
      >
        {loading ? 'Testing Connection...' : 'Test Connection'}
      </Button>
    </form>
  )
}
