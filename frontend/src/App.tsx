import { useState } from 'react'
import { ConnectionsScreen } from '@/components/screens/ConnectionsScreen'
import { PlanScreen } from '@/components/screens/PlanScreen'
import { TransferConfigScreen, type TransferConfig } from '@/components/screens/TransferConfigScreen'
import { TransferExecutionScreen } from '@/components/screens/TransferExecutionScreen'
import type { ConnectionConfig, ProbeResult } from '@/types/probe'
import type { ScanResult, PlanResult } from '@/types/scanner'

type Screen = 'connections' | 'plan' | 'transfer-config' | 'transfer-execution'

interface ServerData {
  config: ConnectionConfig
  probe: ProbeResult
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('connections')
  const [sourceServer, setSourceServer] = useState<ServerData | null>(null)
  const [destServer, setDestServer] = useState<ServerData | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [planResult, setPlanResult] = useState<PlanResult | null>(null)
  const [transferConfig, setTransferConfig] = useState<TransferConfig | null>(null)

  const handleConnectionsNext = (source: ServerData, dest: ServerData) => {
    setSourceServer(source)
    setDestServer(dest)
    setCurrentScreen('plan')
  }

  const handlePlanNext = (scan: ScanResult, plan: PlanResult) => {
    setScanResult(scan)
    setPlanResult(plan)
    setCurrentScreen('transfer-config')
  }

  const handleBackToConnections = () => {
    setCurrentScreen('connections')
  }

  const handleBackToPlan = () => {
    setCurrentScreen('plan')
  }

  const handleBackToConfig = () => {
    setCurrentScreen('transfer-config')
  }

  const handleStartTransfer = (config: TransferConfig) => {
    setTransferConfig(config)
    setCurrentScreen('transfer-execution')
  }

  const handleTransferComplete = () => {
    // Reset and go back to connections
    setCurrentScreen('connections')
  }

  return (
    <>
      {currentScreen === 'connections' && (
        <ConnectionsScreen onNext={handleConnectionsNext} />
      )}
      {currentScreen === 'plan' && sourceServer && destServer && (
        <PlanScreen
          source={sourceServer}
          dest={destServer}
          onBack={handleBackToConnections}
          onNext={handlePlanNext}
        />
      )}
      {currentScreen === 'transfer-config' && sourceServer && destServer && scanResult && planResult && (
        <TransferConfigScreen
          plan={planResult}
          scanResult={scanResult}
          source={sourceServer}
          dest={destServer}
          onBack={handleBackToPlan}
          onStartTransfer={handleStartTransfer}
        />
      )}
      {currentScreen === 'transfer-execution' && sourceServer && destServer && planResult && transferConfig && (
        <TransferExecutionScreen
          plan={planResult}
          sourceConfig={sourceServer.config}
          destConfig={destServer.config}
          onComplete={handleTransferComplete}
          onBack={handleBackToConfig}
        />
      )}
    </>
  )
}

export default App
