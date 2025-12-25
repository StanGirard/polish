import simpleGit, { SimpleGit } from 'simple-git'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'

function getGit(cwd: string): SimpleGit {
  return simpleGit(cwd)
}

/**
 * Parse GitHub owner/repo from various URL formats
 * Supports:
 * - SSH: git@github.com:owner/repo.git
 * - HTTPS: https://github.com/owner/repo
 * - HTTPS with .git: https://github.com/owner/repo.git
 */
function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  // HTTPS format: https://github.com/owner/repo or https://github.com/owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  return null
}

/**
 * Convert any GitHub URL format to HTTPS URL with optional auth token
 */
function toAuthenticatedHttpsUrl(url: string, token?: string): string {
  const parsed = parseGitHubRepo(url)
  if (!parsed) return url

  const { owner, repo } = parsed
  if (token) {
    return `https://${token}@github.com/${owner}/${repo}.git`
  }
  return `https://github.com/${owner}/${repo}.git`
}

// ============================================================================
// Status & Info
// ============================================================================

export interface GitStatus {
  modified: string[]
  added: string[]
  deleted: string[]
  renamed: string[]
  hasChanges: boolean
}

export async function getStatus(projectPath: string): Promise<GitStatus> {
  const git = getGit(projectPath)
  const status = await git.status()

  return {
    modified: status.modified,
    added: status.not_added,
    deleted: status.deleted,
    renamed: status.renamed.map(r => r.to),
    hasChanges: !status.isClean()
  }
}

export async function getCurrentBranch(projectPath: string): Promise<string> {
  const git = getGit(projectPath)
  const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
  return branch.trim()
}

export async function getLastCommitHash(projectPath: string): Promise<string> {
  const git = getGit(projectPath)
  const log = await git.log({ maxCount: 1 })
  return log.latest?.hash || ''
}

// ============================================================================
// Branch Operations
// ============================================================================

export async function createBranch(projectPath: string, branchName: string): Promise<void> {
  const git = getGit(projectPath)
  await git.checkoutLocalBranch(branchName)
}

export async function checkoutBranch(projectPath: string, branchName: string): Promise<void> {
  const git = getGit(projectPath)
  await git.checkout(branchName)
}

// ============================================================================
// Commit Operations
// ============================================================================

export async function commit(projectPath: string, message: string): Promise<string> {
  const git = getGit(projectPath)

  // Stage all changes
  await git.add('.')

  // Commit
  const result = await git.commit(message)

  return result.commit || ''
}

export async function commitWithMessage(
  projectPath: string,
  message: string,
  description?: string
): Promise<string> {
  const git = getGit(projectPath)

  // Stage all changes
  await git.add('.')

  // Build full message
  const fullMessage = description ? `${message}\n\n${description}` : message

  // Commit
  const result = await git.commit(fullMessage)

  return result.commit || ''
}

// ============================================================================
// Rollback Operations
// ============================================================================

export async function rollback(projectPath: string): Promise<void> {
  const git = getGit(projectPath)

  // Discard all changes in tracked files
  await git.checkout(['.'])

  // Clean untracked files
  await git.clean('fd')
}

export async function rollbackToCommit(projectPath: string, commitHash: string): Promise<void> {
  const git = getGit(projectPath)
  await git.reset(['--hard', commitHash])
}

export async function undoLastCommit(projectPath: string): Promise<void> {
  const git = getGit(projectPath)
  await git.reset(['--soft', 'HEAD~1'])
  await rollback(projectPath)
}

// ============================================================================
// Stash Operations (for isolation)
// ============================================================================

export async function stash(projectPath: string): Promise<boolean> {
  const git = getGit(projectPath)
  const status = await git.status()

  if (status.isClean()) {
    return false // Nothing to stash
  }

  await git.stash(['push', '-m', 'polish-temp-stash'])
  return true
}

export async function unstash(projectPath: string): Promise<void> {
  const git = getGit(projectPath)
  await git.stash(['pop'])
}

// ============================================================================
// Remote Operations
// ============================================================================

export async function clone(
  repoUrl: string,
  targetPath: string,
  token?: string
): Promise<void> {
  // Ensure target directory exists
  await mkdir(targetPath, { recursive: true })

  // Convert to HTTPS URL with token if provided (handles both SSH and HTTPS)
  const authUrl = token && repoUrl.includes('github.com')
    ? toAuthenticatedHttpsUrl(repoUrl, token)
    : repoUrl

  const git = simpleGit()
  await git.clone(authUrl, targetPath, ['--depth', '1'])
}

export async function push(projectPath: string, branch: string, token?: string): Promise<void> {
  const git = getGit(projectPath)

  // Get the remote URL
  const remotes = await git.getRemotes(true)
  const origin = remotes.find((r) => r.name === 'origin')

  if (origin && token && origin.refs.push.includes('github.com')) {
    // Convert to HTTPS URL with token for authentication (handles both SSH and HTTPS)
    const authUrl = toAuthenticatedHttpsUrl(origin.refs.push, token)
    await git.remote(['set-url', 'origin', authUrl])
  }

  await git.push('origin', branch, ['--set-upstream'])
}

export async function createPR(
  repo: string,
  branch: string,
  title: string,
  body: string,
  token: string
): Promise<string> {
  // Parse repo from URL (supports both SSH and HTTPS formats)
  const parsed = parseGitHubRepo(repo)
  if (!parsed) {
    throw new Error(`Invalid GitHub repo URL: ${repo}`)
  }

  const { owner, repo: repoName } = parsed

  const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      head: branch,
      base: 'main',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    // Try with 'master' if 'main' fails
    if (error.message?.includes('base')) {
      const retryResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/pulls`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            body,
            head: branch,
            base: 'master',
          }),
        }
      )

      if (!retryResponse.ok) {
        const retryError = await retryResponse.json()
        throw new Error(`Failed to create PR: ${retryError.message}`)
      }

      const retryData = await retryResponse.json()
      return retryData.html_url
    }
    throw new Error(`Failed to create PR: ${error.message}`)
  }

  const data = await response.json()
  return data.html_url
}

// ============================================================================
// Branch Commit Info
// ============================================================================

export interface BranchCommitInfo {
  hash: string
  message: string
  date: string
}

export async function getBranchCommits(
  projectPath: string,
  branchName: string,
  baseBranch: string = 'main'
): Promise<BranchCommitInfo[]> {
  const git = getGit(projectPath)

  try {
    // Get commits that are in branchName but not in baseBranch
    const log = await git.log([`${baseBranch}..${branchName}`])
    return log.all.map(commit => ({
      hash: commit.hash.slice(0, 7),
      message: commit.message,
      date: commit.date
    }))
  } catch {
    // If baseBranch doesn't exist, try with master
    try {
      const log = await git.log([`master..${branchName}`])
      return log.all.map(commit => ({
        hash: commit.hash.slice(0, 7),
        message: commit.message,
        date: commit.date
      }))
    } catch {
      // Fallback: get last 10 commits of the branch
      const log = await git.log([branchName, '-n', '10'])
      return log.all.map(commit => ({
        hash: commit.hash.slice(0, 7),
        message: commit.message,
        date: commit.date
      }))
    }
  }
}

export async function getRemoteUrl(projectPath: string): Promise<string | null> {
  const git = getGit(projectPath)
  const remotes = await git.getRemotes(true)
  const origin = remotes.find(r => r.name === 'origin')
  return origin?.refs.push || null
}

// ============================================================================
// Temp Directory Management
// ============================================================================

export async function cleanupTempDir(tempPath: string): Promise<void> {
  try {
    await rm(tempPath, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

export function createTempDir(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(7)
  return join('/tmp', `polish-${timestamp}-${randomSuffix}`)
}

// ============================================================================
// File Changes & Diff Operations
// ============================================================================

export interface FileChange {
  path: string
  type: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  oldPath?: string
}

export interface FileDiff {
  path: string
  type: 'added' | 'modified' | 'deleted' | 'renamed'
  oldContent: string
  newContent: string
}

/**
 * Get list of changed files between a branch and its base
 * @param includeUncommitted - If true, also include uncommitted changes in working directory
 */
export async function getBranchChangedFiles(
  projectPath: string,
  branchName: string,
  baseBranch: string = 'main',
  includeUncommitted: boolean = false
): Promise<{ files: FileChange[]; baseBranch: string }> {
  const git = getGit(projectPath)

  // Try to find the actual base branch
  let actualBaseBranch = baseBranch
  try {
    await git.raw(['rev-parse', '--verify', baseBranch])
  } catch {
    // Try master if main doesn't exist
    try {
      await git.raw(['rev-parse', '--verify', 'master'])
      actualBaseBranch = 'master'
    } catch {
      // No base branch found, return empty
      return { files: [], baseBranch: actualBaseBranch }
    }
  }

  const filesMap = new Map<string, FileChange>()

  // First, get committed changes between branches
  try {
    const numstatOutput = await git.raw([
      'diff',
      '--numstat',
      `${actualBaseBranch}...${branchName}`
    ])

    const nameStatusOutput = await git.raw([
      'diff',
      '--name-status',
      `${actualBaseBranch}...${branchName}`
    ])

    // Parse name-status output to get file types
    const fileTypes = new Map<string, { type: FileChange['type']; oldPath?: string }>()
    const nameStatusLines = nameStatusOutput.trim().split('\n').filter(Boolean)

    for (const line of nameStatusLines) {
      const parts = line.split('\t')
      const status = parts[0]

      if (status.startsWith('R')) {
        fileTypes.set(parts[2], { type: 'renamed', oldPath: parts[1] })
      } else if (status === 'A') {
        fileTypes.set(parts[1], { type: 'added' })
      } else if (status === 'D') {
        fileTypes.set(parts[1], { type: 'deleted' })
      } else if (status === 'M') {
        fileTypes.set(parts[1], { type: 'modified' })
      }
    }

    // Parse numstat output
    const numstatLines = numstatOutput.trim().split('\n').filter(Boolean)

    for (const line of numstatLines) {
      const [addStr, delStr, ...pathParts] = line.split('\t')
      const path = pathParts.join('\t')
      const additions = addStr === '-' ? 0 : parseInt(addStr, 10)
      const deletions = delStr === '-' ? 0 : parseInt(delStr, 10)
      const typeInfo = fileTypes.get(path) || { type: 'modified' as const }

      filesMap.set(path, {
        path,
        type: typeInfo.type,
        additions,
        deletions,
        oldPath: typeInfo.oldPath
      })
    }
  } catch {
    // Ignore errors for committed changes
  }

  // Also get uncommitted changes if requested (for running sessions)
  if (includeUncommitted) {
    try {
      // Get staged + unstaged changes compared to HEAD
      const uncommittedNumstat = await git.raw(['diff', '--numstat', 'HEAD'])
      const uncommittedStatus = await git.raw(['diff', '--name-status', 'HEAD'])

      // Also check for new untracked files
      const statusOutput = await git.raw(['status', '--porcelain'])

      // Parse uncommitted changes
      const uncommittedTypes = new Map<string, { type: FileChange['type']; oldPath?: string }>()
      const statusLines = uncommittedStatus.trim().split('\n').filter(Boolean)

      for (const line of statusLines) {
        const parts = line.split('\t')
        const status = parts[0]

        if (status.startsWith('R')) {
          uncommittedTypes.set(parts[2], { type: 'renamed', oldPath: parts[1] })
        } else if (status === 'A') {
          uncommittedTypes.set(parts[1], { type: 'added' })
        } else if (status === 'D') {
          uncommittedTypes.set(parts[1], { type: 'deleted' })
        } else if (status === 'M') {
          uncommittedTypes.set(parts[1], { type: 'modified' })
        }
      }

      // Parse numstat for uncommitted
      const uncommittedNumstatLines = uncommittedNumstat.trim().split('\n').filter(Boolean)

      for (const line of uncommittedNumstatLines) {
        const [addStr, delStr, ...pathParts] = line.split('\t')
        const path = pathParts.join('\t')
        const additions = addStr === '-' ? 0 : parseInt(addStr, 10)
        const deletions = delStr === '-' ? 0 : parseInt(delStr, 10)
        const typeInfo = uncommittedTypes.get(path) || { type: 'modified' as const }

        // Merge with existing or add new
        const existing = filesMap.get(path)
        if (existing) {
          existing.additions += additions
          existing.deletions += deletions
        } else {
          filesMap.set(path, {
            path,
            type: typeInfo.type,
            additions,
            deletions,
            oldPath: typeInfo.oldPath
          })
        }
      }

      // Add untracked files (new files not yet staged)
      const porcelainLines = statusOutput.trim().split('\n').filter(Boolean)
      for (const line of porcelainLines) {
        const status = line.substring(0, 2)
        const filePath = line.substring(3)

        if (status === '??' && !filesMap.has(filePath)) {
          // Untracked file - count lines
          try {
            const content = await git.raw(['show', `:${filePath}`]).catch(() => '')
            const lineCount = content ? content.split('\n').length : 0
            filesMap.set(filePath, {
              path: filePath,
              type: 'added',
              additions: lineCount,
              deletions: 0
            })
          } catch {
            filesMap.set(filePath, {
              path: filePath,
              type: 'added',
              additions: 0,
              deletions: 0
            })
          }
        }
      }
    } catch {
      // Ignore errors for uncommitted changes
    }
  }

  return { files: Array.from(filesMap.values()), baseBranch: actualBaseBranch }
}

/**
 * Get diff content for a specific file between branch and base
 * @param includeUncommitted - If true, read working directory for new content instead of branch
 */
export async function getFileDiff(
  projectPath: string,
  branchName: string,
  baseBranch: string,
  filePath: string,
  includeUncommitted: boolean = false
): Promise<FileDiff> {
  const git = getGit(projectPath)

  let oldContent = ''
  let newContent = ''
  let type: FileDiff['type'] = 'modified'

  // Try to get old content (from base branch)
  try {
    oldContent = await git.raw(['show', `${baseBranch}:${filePath}`])
  } catch {
    // File doesn't exist in base branch - it's a new file
    type = 'added'
  }

  // Try to get new content
  if (includeUncommitted) {
    // For running sessions, read from working directory to get uncommitted changes
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    try {
      newContent = await readFile(join(projectPath, filePath), 'utf-8')
    } catch {
      // File doesn't exist in working directory - check branch
      try {
        newContent = await git.raw(['show', `${branchName}:${filePath}`])
      } catch {
        type = 'deleted'
      }
    }
  } else {
    // For completed sessions, read from branch
    try {
      newContent = await git.raw(['show', `${branchName}:${filePath}`])
    } catch {
      type = 'deleted'
    }
  }

  // If both exist and content differs, it's modified
  if (oldContent && newContent && oldContent !== newContent) {
    type = 'modified'
  }

  return {
    path: filePath,
    type,
    oldContent,
    newContent
  }
}

/**
 * Check if a branch exists in the repository
 */
export async function branchExists(
  projectPath: string,
  branchName: string
): Promise<boolean> {
  const git = getGit(projectPath)
  try {
    await git.raw(['rev-parse', '--verify', branchName])
    return true
  } catch {
    return false
  }
}
