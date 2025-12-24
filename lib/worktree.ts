import simpleGit from 'simple-git'
import { mkdir, rm, symlink, access } from 'fs/promises'
import { join } from 'path'
import { getCurrentBranch } from './git'

const WORKTREE_DIR = '/tmp/polish-worktrees'

export interface WorktreeConfig {
  originalPath: string
  worktreePath: string
  branchName: string
  baseBranch: string
  sessionId: string
}

/**
 * Génère un ID unique pour la session Polish
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Crée un worktree git pour isoler les changements Polish
 */
export async function createWorktree(
  projectPath: string,
  sourceBranch?: string
): Promise<WorktreeConfig> {
  const git = simpleGit(projectPath)
  const sessionId = generateSessionId()
  const branchName = `polish/session-${sessionId}`
  const worktreePath = join(WORKTREE_DIR, sessionId)
  const baseBranch = sourceBranch || await getCurrentBranch(projectPath)

  // Créer le répertoire parent si nécessaire
  await mkdir(WORKTREE_DIR, { recursive: true })

  // Créer le worktree avec une nouvelle branche
  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch])

  // Symlink node_modules depuis le projet original
  const srcModules = join(projectPath, 'node_modules')
  const dstModules = join(worktreePath, 'node_modules')
  try {
    await access(srcModules)
    await symlink(srcModules, dstModules, 'dir')
  } catch {
    // Pas de node_modules dans le projet original - l'agent pourra faire npm install
  }

  return {
    originalPath: projectPath,
    worktreePath,
    branchName,
    baseBranch,
    sessionId
  }
}

/**
 * Nettoie le worktree après une session Polish
 */
export async function cleanupWorktree(
  config: WorktreeConfig,
  keepBranch: boolean = true
): Promise<void> {
  const git = simpleGit(config.originalPath)

  // Supprimer le worktree
  try {
    await git.raw(['worktree', 'remove', config.worktreePath, '--force'])
  } catch {
    // Si worktree remove échoue, supprimer manuellement
    try {
      await rm(config.worktreePath, { recursive: true, force: true })
      await git.raw(['worktree', 'prune'])
    } catch {
      // Ignorer les erreurs de cleanup
    }
  }

  // Supprimer la branche si demandé
  if (!keepBranch) {
    try {
      await git.branch(['-D', config.branchName])
    } catch {
      // La branche n'existe peut-être pas ou a déjà été supprimée
    }
  }
}

/**
 * Vérifie les prérequis avant de créer un worktree
 */
export async function checkPreflight(
  projectPath: string
): Promise<{ ok: boolean; error?: string; baseBranch: string }> {
  const git = simpleGit(projectPath)

  // Vérifier que c'est un repo git
  const isRepo = await git.checkIsRepo()
  if (!isRepo) {
    return { ok: false, error: 'Not a git repository', baseBranch: '' }
  }

  // Récupérer la branche actuelle
  const baseBranch = await getCurrentBranch(projectPath)

  return { ok: true, baseBranch }
}
