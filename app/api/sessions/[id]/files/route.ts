import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import {
  getBranchChangedFiles,
  getFileDiff,
  branchExists,
  type FileChange,
  type FileDiff
} from '@/lib/git'
import { existsSync } from 'fs'
import { join } from 'path'

type RouteParams = { params: Promise<{ id: string }> }

const WORKTREE_BASE = '/tmp/polish-worktrees'

/**
 * Determine the git repository path for a session
 * - Running sessions: use worktree path
 * - Completed sessions: use original project path (branch still exists there)
 */
async function getGitPath(session: {
  id: string
  status: string
  projectPath: string
  branchName?: string
}): Promise<{ path: string; error?: string }> {
  const worktreePath = join(WORKTREE_BASE, session.id)

  // For running sessions, prefer worktree if it exists
  if (session.status === 'running' && existsSync(worktreePath)) {
    return { path: worktreePath }
  }

  // For completed sessions or when worktree doesn't exist, use original project path
  // The branch should still exist in the original repo
  if (session.projectPath && existsSync(session.projectPath)) {
    // Verify the branch exists
    if (session.branchName) {
      const exists = await branchExists(session.projectPath, session.branchName)
      if (!exists) {
        return {
          path: session.projectPath,
          error: 'Branch has been deleted. File changes are no longer available.'
        }
      }
    }
    return { path: session.projectPath }
  }

  return { path: '', error: 'Repository not found' }
}

// GET /api/sessions/[id]/files - Get list of changed files or diff for a specific file
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const session = getSession(id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (!session.branchName) {
      return NextResponse.json(
        { error: 'Session has no branch' },
        { status: 400 }
      )
    }

    const { path: gitPath, error: pathError } = await getGitPath(session)

    if (pathError) {
      return NextResponse.json(
        { error: pathError, files: [], baseBranch: 'main' }
      )
    }

    if (!gitPath) {
      return NextResponse.json(
        { error: 'Could not determine repository path' },
        { status: 500 }
      )
    }

    // Include uncommitted changes for running sessions
    const includeUncommitted = session.status === 'running'

    // Check if a specific file path is requested for diff
    const filePath = request.nextUrl.searchParams.get('path')

    if (filePath) {
      // Return diff for specific file
      const { baseBranch } = await getBranchChangedFiles(
        gitPath,
        session.branchName,
        'main',
        includeUncommitted
      )

      // Get the diff content
      const diff = await getFileDiff(
        gitPath,
        session.branchName,
        baseBranch,
        filePath,
        includeUncommitted
      )

      return NextResponse.json({ diff })
    }

    // Return list of all changed files
    const { files, baseBranch } = await getBranchChangedFiles(
      gitPath,
      session.branchName,
      'main',
      includeUncommitted
    )

    return NextResponse.json({ files, baseBranch })
  } catch (error) {
    console.error('Failed to get file changes:', error)
    return NextResponse.json(
      { error: 'Failed to get file changes' },
      { status: 500 }
    )
  }
}
