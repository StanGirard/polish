'use client'

import { useEffect, useState } from 'react'

interface SystemMonitorProps {
  running: boolean
  phase: 'idle' | 'implement' | 'polish'
  eventsCount: number
  commitsCount: number
}

export function SystemMonitor({ running, phase, eventsCount, commitsCount }: SystemMonitorProps) {
  const [uptime, setUptime] = useState(0)
  const [memUsage, setMemUsage] = useState(0)

  useEffect(() => {
    if (!running) {
      setUptime(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      setUptime(Date.now() - startTime)
      // Simulate memory usage variation
      setMemUsage(65 + Math.random() * 15)
    }, 100)

    return () => clearInterval(interval)
  }, [running])

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  const getStatusColor = () => {
    if (phase === 'implement') return 'text-magenta-400'
    if (phase === 'polish') return 'text-cyan-400'
    return 'text-gray-600'
  }

  const getStatusText = () => {
    if (phase === 'implement') return 'IMPLEMENTING'
    if (phase === 'polish') return 'POLISHING'
    return 'IDLE'
  }

  return (
    <div className="fixed top-4 right-4 font-mono text-[10px] bg-black/90 border border-green-900/50 rounded p-3 space-y-2 backdrop-blur-sm z-20 min-w-[220px] shadow-lg">
      <div className="flex items-center justify-between border-b border-green-900/30 pb-2">
        <span className="text-green-500 tracking-widest uppercase font-bold">System Monitor</span>
        <span className={`${running ? 'text-green-400 blink' : 'text-gray-700'}`} title={running ? 'Active' : 'Idle'}>●</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 tracking-wider">STATUS</span>
          <span className={`${getStatusColor()} font-bold tracking-widest`}>
            {getStatusText()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 tracking-wider">UPTIME</span>
          <span className="text-green-400 font-bold tracking-widest">
            {formatUptime(uptime)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 tracking-wider">EVENTS</span>
          <span className="text-blue-400 font-bold">
            {eventsCount.toString().padStart(4, '0')}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 tracking-wider">COMMITS</span>
          <span className="text-yellow-400 font-bold">
            {commitsCount.toString().padStart(4, '0')}
          </span>
        </div>

        {running && (
          <>
            <div className="pt-2 border-t border-green-900/30">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-600 tracking-wider">CPU</span>
                <span className="text-cyan-400 font-bold">
                  {(45 + Math.random() * 20).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 bg-gray-900 rounded overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300 monitor-bar"
                  style={{ width: `${45 + Math.random() * 20}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-600 tracking-wider">MEMORY</span>
                <span className="text-green-400 font-bold">
                  {memUsage.toFixed(0)}%
                </span>
              </div>
              <div className="h-1 bg-gray-900 rounded overflow-hidden">
                <div
                  className="h-full bg-green-400 transition-all duration-300 monitor-bar"
                  style={{ width: `${memUsage}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pt-2 border-t border-green-900/30 text-[8px] text-gray-700 tracking-widest">
        PID: {Math.floor(Math.random() * 90000 + 10000)} | v0.1.0
      </div>
    </div>
  )
}

export default SystemMonitor
