'use client'

export interface FileChange {
  path: string
  type: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  oldPath?: string
}

interface FileChangesListProps {
  files: FileChange[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
}

function getFileIcon(type: FileChange['type']) {
  switch (type) {
    case 'added':
      return { icon: '+', color: 'text-green-400' }
    case 'modified':
      return { icon: '~', color: 'text-yellow-400' }
    case 'deleted':
      return { icon: '-', color: 'text-red-400' }
    case 'renamed':
      return { icon: '>', color: 'text-cyan-400' }
  }
}

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

function getDirectory(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/') + '/'
}

export function FileChangesList({ files, selectedFile, onSelectFile }: FileChangesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-gray-600 font-mono text-xs text-center py-4">
        No file changes
      </div>
    )
  }

  return (
    <div className="font-mono text-[11px] space-y-0.5 overflow-y-auto overflow-x-hidden pr-1">
      {files.map((file) => {
        const { icon, color } = getFileIcon(file.type)
        const isSelected = selectedFile === file.path
        const fileName = getFileName(file.path)
        const directory = getDirectory(file.path)

        return (
          <button
            key={file.path}
            onClick={() => onSelectFile(file.path)}
            title={file.path}
            className={`
              w-full text-left px-2 py-1.5 rounded border transition-all overflow-hidden
              ${isSelected
                ? 'bg-purple-900/30 border-purple-500/50'
                : 'bg-black/20 border-transparent hover:border-purple-900/30 hover:bg-purple-900/10'
              }
            `}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`${color} font-bold shrink-0`}>{icon}</span>
              <div className="flex-1 min-w-0 truncate">
                {directory && (
                  <span className="text-gray-600">{directory}</span>
                )}
                <span className={isSelected ? 'text-purple-300' : 'text-gray-300'}>
                  {fileName}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 text-[10px]">
                {file.additions > 0 && (
                  <span className="text-green-500">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-red-500">-{file.deletions}</span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default FileChangesList
