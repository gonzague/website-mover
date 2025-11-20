import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp, BookOpen, Zap, Shield, Settings } from 'lucide-react';

export function QuickStartGuide() {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Quick Start Guide</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>Essential steps to get started</CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Common Use Cases */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Common Use Cases
            </h4>
            <div className="space-y-2 text-sm">
              <div className="bg-white rounded p-3 border border-blue-100">
                <strong className="text-blue-700">WordPress Migration (SFTP):</strong>
                <p className="text-gray-600 mt-1">
                  Use the pre-configured exclude patterns for cache and log files. Don't forget to export/import your database separately!
                </p>
              </div>
              <div className="bg-white rounded p-3 border border-blue-100">
                <strong className="text-blue-700">Large Site Sync (Rsync):</strong>
                <p className="text-gray-600 mt-1">
                  Use Rsync for efficient delta sync - only transfers changed file portions. Perfect for repeated migrations or large sites (5GB+).
                </p>
              </div>
              <div className="bg-white rounded p-3 border border-blue-100">
                <strong className="text-blue-700">Cloud Backup (S3):</strong>
                <p className="text-gray-600 mt-1">
                  Backup to AWS S3, DigitalOcean Spaces, or Backblaze B2 for off-site storage with versioning. Great for disaster recovery!
                </p>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              Best Practices
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Always run a <strong>Dry Run</strong> first to verify what will be transferred</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span><strong>Test both remotes</strong> before starting a migration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Review and customize <strong>exclude patterns</strong> for your CMS</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Choose the right backend: <strong>SFTP</strong> for standard, <strong>Rsync</strong> for large/repeated, <strong>S3</strong> for backups</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Keep the browser tab open during migration for real-time monitoring</span>
              </li>
            </ul>
          </div>

          {/* Configuration Tips */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-500" />
              Configuration Tips
            </h4>
            <div className="bg-white rounded p-3 border border-blue-100 space-y-2 text-sm">
              <div>
                <strong className="text-gray-700">Transfers (8-16):</strong>
                <span className="text-gray-600"> Number of parallel file transfers. Higher = faster, but more resource intensive.</span>
              </div>
              <div>
                <strong className="text-gray-700">Bandwidth Limit:</strong>
                <span className="text-gray-600"> Use "10M" for 10MB/s. Leave empty for unlimited speed.</span>
              </div>
              <div>
                <strong className="text-gray-700">Delete Extraneous:</strong>
                <span className="text-gray-600"> Makes destination identical to source by deleting extra files. Use with caution!</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

