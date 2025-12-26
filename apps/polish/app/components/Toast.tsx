'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(7)
    const toast: Toast = { id, message, type, duration }

    setToasts(prev => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = {
    success: {
      bg: 'bg-green-900/90',
      border: 'border-green-400',
      text: 'text-green-400',
      icon: '✓'
    },
    error: {
      bg: 'bg-red-900/90',
      border: 'border-red-400',
      text: 'text-red-400',
      icon: '✗'
    },
    warning: {
      bg: 'bg-yellow-900/90',
      border: 'border-yellow-400',
      text: 'text-yellow-400',
      icon: '⚠'
    },
    info: {
      bg: 'bg-blue-900/90',
      border: 'border-blue-400',
      text: 'text-blue-400',
      icon: 'ℹ'
    }
  }

  const style = config[toast.type]

  return (
    <div
      className={`
        ${style.bg} ${style.border} ${style.text}
        border backdrop-blur-sm rounded px-4 py-3
        font-mono text-sm max-w-md
        pointer-events-auto cursor-pointer
        animate-in slide-in-from-right-full duration-300
        box-glow
      `}
      onClick={onClose}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{style.icon}</span>
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors ml-2"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default ToastProvider
