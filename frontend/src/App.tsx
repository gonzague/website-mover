import { useState, useEffect } from 'react';
import './App.css';
import RemotesScreen from './components/simple/RemotesScreen';
import MigrationScreen from './components/simple/MigrationScreen';
import HistoryScreen from './components/simple/HistoryScreen';
import { Toaster } from './components/ui/toaster';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { WelcomeModal } from './components/onboarding/WelcomeModal';
import { StepIndicator } from './components/onboarding/StepIndicator';
import { Button } from './components/ui/button';
import { HelpCircle } from 'lucide-react';
import { listRemotes } from './api/rclone';

function App() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentTab, setCurrentTab] = useState('remotes');
  const [remotesCount, setRemotesCount] = useState(0);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('website-mover-onboarding-completed');
    if (!hasCompletedOnboarding) {
      setShowWelcome(true);
    }
  }, []);

  // Load remotes count for step indicator
  useEffect(() => {
    const loadRemotesCount = async () => {
      try {
        const remotes = await listRemotes();
        setRemotesCount(remotes.length);
      } catch (error) {
        console.error('Failed to load remotes count:', error);
      }
    };
    
    loadRemotesCount();
    // Refresh count when tab changes
    const interval = setInterval(loadRemotesCount, 2000);
    return () => clearInterval(interval);
  }, [currentTab]);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
  };

  const handleReopenWelcome = () => {
    setShowWelcome(true);
  };

  // Define workflow steps
  const steps = [
    {
      id: 'remotes',
      title: 'Configure Remotes',
      description: 'Add source & destination',
      completed: remotesCount >= 2,
      current: currentTab === 'remotes',
    },
    {
      id: 'migration',
      title: 'Start Migration',
      description: 'Configure & execute',
      completed: false, // Could track this in localStorage if needed
      current: currentTab === 'migration',
    },
    {
      id: 'history',
      title: 'View History',
      description: 'Check results & logs',
      completed: false,
      current: currentTab === 'history',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Website Mover - Rclone Edition
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopenWelcome}
              className="flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Help & Tour
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {/* Step Indicator */}
        <div className="mb-6">
          <StepIndicator steps={steps} onStepClick={(stepId) => setCurrentTab(stepId)} />
        </div>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="remotes">
              1. Remotes
              {remotesCount > 0 && (
                <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                  {remotesCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="migration" disabled={remotesCount < 2}>
              2. Migration
            </TabsTrigger>
            <TabsTrigger value="history">3. History</TabsTrigger>
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

      {/* Welcome Modal */}
      <WelcomeModal open={showWelcome} onComplete={handleWelcomeComplete} />

      <Toaster />
    </div>
  );
}

export default App;
