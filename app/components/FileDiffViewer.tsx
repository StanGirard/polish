'use client'

import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

interface FileDiffViewerProps {
  oldContent: string
  newContent: string
  fileName: string
  changeType: 'added' | 'modified' | 'deleted' | 'renamed'
}

const cyberpunkStyles = {
  variables: {
    dark: {
      diffViewerBackground: '#000000',
      diffViewerColor: '#e5e7eb',
      addedBackground: 'rgba(0, 255, 0, 0.08)',
      addedColor: '#4ade80',
      removedBackground: 'rgba(255, 0, 0, 0.08)',
      removedColor: '#f87171',
      wordAddedBackground: 'rgba(0, 255, 0, 0.25)',
      wordRemovedBackground: 'rgba(255, 0, 0, 0.25)',
      addedGutterBackground: 'rgba(0, 255, 0, 0.05)',
      removedGutterBackground: 'rgba(255, 0, 0, 0.05)',
      gutterBackground: '#0a0a0a',
      gutterBackgroundDark: '#050505',
      highlightBackground: 'rgba(0, 255, 255, 0.1)',
      highlightGutterBackground: 'rgba(0, 255, 255, 0.05)',
      codeFoldGutterBackground: '#0a0a0a',
      codeFoldBackground: '#0a0a0a',
      emptyLineBackground: '#0a0a0a',
      gutterColor: '#4a5568',
      addedGutterColor: '#22c55e',
      removedGutterColor: '#ef4444',
      codeFoldContentColor: '#4a5568',
      diffViewerTitleBackground: '#0a0a0a',
      diffViewerTitleColor: '#9ca3af',
      diffViewerTitleBorderColor: 'rgba(147, 51, 234, 0.3)',
    },
  },
  diffContainer: {
    overflowX: 'auto' as const,
    display: 'block',
  },
  line: {
    padding: '2px 8px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '1.4',
    whiteSpace: 'pre' as const,
  },
  wordDiff: {
    padding: '1px 2px',
  },
  gutter: {
    padding: '0 6px',
    minWidth: '32px',
    fontSize: '10px',
  },
  contentText: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
  },
  content: {
    width: 'auto',
    minWidth: '100%',
  },
}

function getChangeLabel(type: FileDiffViewerProps['changeType']) {
  switch (type) {
    case 'added':
      return { text: 'NEW', color: 'text-green-400' }
    case 'modified':
      return { text: 'MOD', color: 'text-yellow-400' }
    case 'deleted':
      return { text: 'DEL', color: 'text-red-400' }
    case 'renamed':
      return { text: 'REN', color: 'text-cyan-400' }
  }
}

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

export function FileDiffViewer({
  oldContent,
  newContent,
  fileName,
  changeType
}: FileDiffViewerProps) {
  const { text: changeLabel, color: labelColor } = getChangeLabel(changeType)
  const shortName = getFileName(fileName)

  // Check if content is binary or too large
  const isBinary = oldContent.includes('\0') || newContent.includes('\0')
  const maxSize = 1024 * 1024 // 1MB
  const isTooLarge = oldContent.length > maxSize || newContent.length > maxSize

  if (isBinary) {
    return (
      <div className="h-full flex flex-col">
        <DiffHeader fileName={shortName} fullPath={fileName} changeLabel={changeLabel} labelColor={labelColor} />
        <div className="flex-1 flex items-center justify-center bg-black/50 rounded-b border border-t-0 border-gray-800">
          <div className="text-gray-500 text-xs">Binary file</div>
        </div>
      </div>
    )
  }

  if (isTooLarge) {
    return (
      <div className="h-full flex flex-col">
        <DiffHeader fileName={shortName} fullPath={fileName} changeLabel={changeLabel} labelColor={labelColor} />
        <div className="flex-1 flex items-center justify-center bg-black/50 rounded-b border border-t-0 border-gray-800">
          <div className="text-gray-500 text-xs">File too large</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <DiffHeader fileName={shortName} fullPath={fileName} changeLabel={changeLabel} labelColor={labelColor} />
      <div className="flex-1 overflow-auto rounded-b border border-t-0 border-purple-900/30 bg-black">
        <div className="min-w-0">
          <ReactDiffViewer
            oldValue={oldContent}
            newValue={newContent}
            splitView={true}
            useDarkTheme={true}
            styles={cyberpunkStyles}
            compareMethod={DiffMethod.WORDS}
            hideLineNumbers={false}
            showDiffOnly={true}
            extraLinesSurroundingDiff={3}
          />
        </div>
      </div>
    </div>
  )
}

function DiffHeader({
  fileName,
  fullPath,
  changeLabel,
  labelColor
}: {
  fileName: string
  fullPath: string
  changeLabel: string
  labelColor: string
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-purple-900/20 border border-purple-900/30 rounded-t gap-2">
      <span className="font-mono text-xs text-purple-300 truncate" title={fullPath}>
        {fileName}
      </span>
      <span className={`text-[10px] tracking-wider shrink-0 ${labelColor}`}>{changeLabel}</span>
    </div>
  )
}

export default FileDiffViewer
