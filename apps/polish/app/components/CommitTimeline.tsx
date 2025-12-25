'use client'

interface CommitInfo {
  hash: string
  message: string
  scoreDelta: number
  timestamp?: Date
}

interface CommitTimelineProps {
  commits: CommitInfo[]
  maxDisplay?: number
}

export function CommitTimeline({ commits, maxDisplay = 5 }: CommitTimelineProps) {
  if (commits.length === 0) {
    return (
      <div className="text-gray-600 font-mono text-sm">
        No commits yet
      </div>
    )
  }

  // Show most recent commits
  const displayCommits = commits.slice(-maxDisplay).reverse()
  const hasMore = commits.length > maxDisplay

  return (
    <div className="font-mono text-xs">
      <div className="text-yellow-400 mb-3 uppercase tracking-widest flex items-center gap-2">
        <span>◆</span> Commit History <span className="text-gray-700">|</span>
        <span className="text-gray-600">{commits.length} TOTAL</span>
      </div>
      <div className="space-y-2 pl-3 border-l-2 border-yellow-900/50">
        {displayCommits.map((commit, i) => (
          <div key={commit.hash} className="relative group">
            <div className="absolute -left-[13px] top-1.5 w-2 h-2 bg-yellow-600 rounded-full border-2 border-black group-hover:bg-yellow-400 transition-colors"></div>
            <div className="flex items-start gap-2 p-2 rounded bg-black/30 border border-gray-900 hover:border-yellow-900/50 transition-all">
              <div className="flex flex-col flex-1 gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 font-bold tracking-wider">#{commit.hash.slice(0, 7)}</span>
                  <span className="text-gray-700">•</span>
                  <span className="text-[10px] text-gray-700 tracking-widest">
                    0x{parseInt(commit.hash.slice(0, 6), 16).toString(16).toUpperCase().padStart(6, '0')}
                  </span>
                </div>
                <span className="text-gray-400 text-xs leading-tight">
                  {commit.message}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className={`font-bold ${commit.scoreDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {commit.scoreDelta >= 0 ? '▲' : '▼'} {Math.abs(commit.scoreDelta).toFixed(1)}
                </span>
                <span className="text-[9px] text-gray-700 tracking-widest">DELTA</span>
              </div>
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="flex items-center gap-2 text-gray-700 pl-2">
            <span>└─</span>
            <span className="text-xs">+{commits.length - maxDisplay} MORE COMMITS</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommitTimeline
