import './App.css';
import RemotesScreen from './components/simple/RemotesScreen';
import MigrationScreen from './components/simple/MigrationScreen';
import HistoryScreen from './components/simple/HistoryScreen';
import { Toaster } from './components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Website Mover - Rclone Edition
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4">
        <Tabs defaultValue="remotes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="remotes">Remotes</TabsTrigger>
            <TabsTrigger value="migration">Migration</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="remotes">
            <RemotesScreen />
          </TabsContent>
          <TabsContent value="migration">
            <MigrationScreen />
          </TabsContent>
          <TabsContent value="history">
            <HistoryScreen />
          </TabsContent>
        </Tabs>
      </main>

      <Toaster />
    </div>
  );
}

export default App;
