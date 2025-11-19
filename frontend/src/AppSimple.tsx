import { useState } from 'react';
import './App.css';
import RemotesScreen from './components/simple/RemotesScreen';
import MigrationScreen from './components/simple/MigrationScreen';
import HistoryScreen from './components/simple/HistoryScreen';

type Screen = 'remotes' | 'migration' | 'history';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('remotes');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Website Mover - Rclone Edition
          </h1>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentScreen('remotes')}
              className={`py-3 px-4 border-b-2 font-medium text-sm ${
                currentScreen === 'remotes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Remotes
            </button>
            <button
              onClick={() => setCurrentScreen('migration')}
              className={`py-3 px-4 border-b-2 font-medium text-sm ${
                currentScreen === 'migration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Migration
            </button>
            <button
              onClick={() => setCurrentScreen('history')}
              className={`py-3 px-4 border-b-2 font-medium text-sm ${
                currentScreen === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              History
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentScreen === 'remotes' && <RemotesScreen />}
        {currentScreen === 'migration' && <MigrationScreen />}
        {currentScreen === 'history' && <HistoryScreen />}
      </main>
    </div>
  );
}

export default App;

