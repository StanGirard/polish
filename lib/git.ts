import simpleGit, { SimpleGit } from 'simple-git'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'

function getGit(cwd: string): SimpleGit {
  return simpleGit(cwd)
}

export async function clone(
  repoUrl: string,
  targetPath: string,
  token?: string
): Promise<void> {
  // Ensure target directory exists
  await mkdir(targetPath, { recursive: true })

  // Insert token into URL if provided
  let authUrl = repoUrl
  if (token && repoUrl.startsWith('https://github.com/')) {
    authUrl = repoUrl.replace('https://github.com/', `https://${token}@github.com/`)
  }

  const git = simpleGit()
  await git.clone(authUrl, targetPath, ['--depth', '1'])
}

export async function createBranch(projectPath: string, branchName: string): Promise<void> {
  const git = getGit(projectPath)
  await git.checkoutLocalBranch(branchName)
}

export async function commit(projectPath: string, message: string): Promise<string> {
  const git = getGit(projectPath)

  // Stage all changes
  await git.add('.')

  // Commit
  const result = await git.commit(message)

  return result.commit || ''
}

export async function rollback(projectPath: string): Promise<void> {
  const git = getGit(projectPath)

  // Discard all changes
  await git.checkout(['.'])

  // Clean untracked files
  await git.clean('fd')
}

export async function push(projectPath: string, branch: string, token?: string): Promise<void> {
  const git = getGit(projectPath)

  // Get the remote URL
  const remotes = await git.getRemotes(true)
  const origin = remotes.find((r) => r.name === 'origin')

  if (origin && token && origin.refs.push.includes('github.com')) {
    // Update remote URL with token for authentication
    const authUrl = origin.refs.push.replace(
      'https://github.com/',
      `https://${token}@github.com/`
    )
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
  // Parse repo from URL: https://github.com/owner/repo
  const match = repo.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) {
    throw new Error(`Invalid GitHub repo URL: ${repo}`)
  }

  const [, owner, repoName] = match

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
