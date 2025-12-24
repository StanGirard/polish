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
    <div className="font-mono text-sm">
      <div className="text-gray-400 mb-2">Commits ({commits.length})</div>
      <div className="space-y-1 pl-2 border-l border-gray-700">
        {displayCommits.map((commit, i) => (
          <div key={commit.hash} className="flex items-center gap-2">
            <span className="text-gray-600">
              {i === displayCommits.length - 1 && !hasMore ? '\u2514\u2500' : '\u251C\u2500'}
            </span>
            <span className="text-blue-400">{commit.hash.slice(0, 7)}</span>
            <span className="text-gray-300 truncate flex-1 max-w-xs">
              {commit.message}
            </span>
            <span className={`${commit.scoreDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {commit.scoreDelta >= 0 ? '+' : ''}{commit.scoreDelta.toFixed(1)} pts
            </span>
          </div>
        ))}
        {hasMore && (
          <div className="flex items-center gap-2 text-gray-600">
            <span>\u2514\u2500</span>
            <span>... {commits.length - maxDisplay} more</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommitTimeline
