'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileChangesList, type FileChange } from './FileChangesList'
import { FileDiffViewer } from './FileDiffViewer'
import { apiFetch } from '@/app/lib/api-client'

interface FileDiff {
  path: string
  type: 'added' | 'modified' | 'deleted' | 'renamed'
  oldContent: string
  newContent: string
}

interface FileChangesSectionProps {
  sessionId: string
  branchName?: string
}

export function FileChangesSection({ sessionId, branchName }: FileChangesSectionProps) {
  const [files, setFiles] = useState<FileChange[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  // Fetch file list on mount
  useEffect(() => {
    if (!branchName) return

    async function fetchFiles() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiFetch(`/api/sessions/${sessionId}/files`)
        const data = await response.json()

        if (data.error) {
          setError(data.error)
          setFiles([])
        } else {
          setFiles(data.files || [])
        }
      } catch (err) {
        setError('Failed to load file changes')
        setFiles([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFiles()
  }, [sessionId, branchName])

  // Fetch diff when file is selected
  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedFile(path)
    setIsDiffLoading(true)
    setDiff(null)

    try {
      const response = await apiFetch(
        `/api/sessions/${sessionId}/files?path=${encodeURIComponent(path)}`
      )
      const data = await response.json()

      if (data.diff) {
        setDiff(data.diff)
      }
    } catch (err) {
      console.error('Failed to load diff:', err)
    } finally {
      setIsDiffLoading(false)
    }
  }, [sessionId])

  // Auto-select first file when list loads
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      handleSelectFile(files[0].path)
    }
  }, [files, selectedFile, handleSelectFile])

  if (!branchName) {
    return null
  }

  return (
    <div className="font-mono">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-purple-400 text-xs mb-2 uppercase tracking-widest hover:text-purple-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>File Changes</span>
          {files.length > 0 && (
            <>
              <span className="text-gray-700">|</span>
              <span className="text-gray-600">{files.length} files</span>
            </>
          )}
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <div className="text-purple-400 text-xs animate-pulse">
                Loading...
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="text-center py-4 text-gray-500 text-xs">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && files.length === 0 && (
            <div className="text-center py-4 text-gray-600 text-xs">
              No file changes detected
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && files.length > 0 && (
            <div className="flex gap-3 h-[350px] overflow-hidden">
              {/* File list - fixed width */}
              <div className="w-[220px] shrink-0 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <FileChangesList
                    files={files}
                    selectedFile={selectedFile}
                    onSelectFile={handleSelectFile}
                  />
                </div>
              </div>

              {/* Diff viewer - takes remaining space */}
              <div className="flex-1 min-w-0 overflow-hidden">
                {isDiffLoading && (
                  <div className="h-full flex items-center justify-center bg-black/30 rounded border border-purple-900/30">
                    <div className="text-purple-400 text-xs animate-pulse">
                      Loading diff...
                    </div>
                  </div>
                )}

                {!isDiffLoading && diff && (
                  <FileDiffViewer
                    oldContent={diff.oldContent}
                    newContent={diff.newContent}
                    fileName={diff.path}
                    changeType={diff.type}
                  />
                )}

                {!isDiffLoading && !diff && selectedFile && (
                  <div className="h-full flex items-center justify-center bg-black/30 rounded border border-purple-900/30">
                    <div className="text-gray-500 text-xs">
                      Select a file to view diff
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FileChangesSection
