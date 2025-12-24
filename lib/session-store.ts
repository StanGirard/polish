import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import type { PolishEvent } from './types'

// ============================================================================
// Types
// ============================================================================

export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Session {
  id: string
  status: SessionStatus
  mission?: string
  projectPath: string
  branchName?: string
  startedAt: Date
  completedAt?: Date
  initialScore?: number
  finalScore?: number
  commits: number
  duration?: number
}

export interface SessionEvent {
  id: number
  sessionId: string
  type: string
  data: string
  timestamp: Date
}

// ============================================================================
// Database Setup
// ============================================================================

const DB_PATH = join(process.cwd(), '.polish', 'sessions.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  mission TEXT,
  project_path TEXT NOT NULL,
  branch_name TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  initial_score REAL,
  final_score REAL,
  commits INTEGER DEFAULT 0,
  duration INTEGER
);

CREATE TABLE IF NOT EXISTS session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON session_events(timestamp);
`

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    const dir = dirname(DB_PATH)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)
  }
  return db
}

// ============================================================================
// Session CRUD
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSession(config: { mission?: string; projectPath: string }): Session {
  const db = getDb()
  const id = generateId()
  const now = new Date()

  const session: Session = {
    id,
    status: 'pending',
    mission: config.mission,
    projectPath: config.projectPath,
    startedAt: now,
    commits: 0
  }

  db.prepare(`
    INSERT INTO sessions (id, status, mission, project_path, started_at, commits)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, session.status, session.mission || null, session.projectPath, now.toISOString(), 0)

  return session
}

export function getSession(id: string): Session | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined

  if (!row) return undefined

  return rowToSession(row)
}

export function getAllSessions(): Session[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToSession)
}

export function updateSession(id: string, updates: Partial<Session>): void {
  const db = getDb()

  const fields: string[] = []
  const values: unknown[] = []

  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
  }
  if (updates.branchName !== undefined) {
    fields.push('branch_name = ?')
    values.push(updates.branchName)
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?')
    values.push(updates.completedAt.toISOString())
  }
  if (updates.initialScore !== undefined) {
    fields.push('initial_score = ?')
    values.push(updates.initialScore)
  }
  if (updates.finalScore !== undefined) {
    fields.push('final_score = ?')
    values.push(updates.finalScore)
  }
  if (updates.commits !== undefined) {
    fields.push('commits = ?')
    values.push(updates.commits)
  }
  if (updates.duration !== undefined) {
    fields.push('duration = ?')
    values.push(updates.duration)
  }

  if (fields.length === 0) return

  values.push(id)
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteSession(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

// ============================================================================
// Events
// ============================================================================

export function addEvent(sessionId: string, event: PolishEvent): void {
  const db = getDb()
  const now = new Date()

  db.prepare(`
    INSERT INTO session_events (session_id, type, data, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, event.type, JSON.stringify(event.data), now.toISOString())

  // Notify subscribers
  const callbacks = eventCallbacks.get(sessionId)
  if (callbacks) {
    callbacks.forEach(callback => {
      try {
        callback(event)
      } catch {
        // Ignore callback errors
      }
    })
  }
}

export function getEvents(sessionId: string, limit = 100, afterId?: number): SessionEvent[] {
  const db = getDb()

  let query = 'SELECT * FROM session_events WHERE session_id = ?'
  const params: unknown[] = [sessionId]

  if (afterId !== undefined) {
    query += ' AND id > ?'
    params.push(afterId)
  }

  query += ' ORDER BY id ASC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[]
  return rows.map(rowToEvent)
}

export function getLatestEvents(sessionId: string, limit = 50): SessionEvent[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM session_events
    WHERE session_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(sessionId, limit) as Record<string, unknown>[]

  return rows.map(rowToEvent).reverse()
}

// ============================================================================
// Subscriptions (in-memory for SSE)
// ============================================================================

const eventCallbacks = new Map<string, Set<(event: PolishEvent) => void>>()

export function subscribeToSession(
  sessionId: string,
  callback: (event: PolishEvent) => void
): () => void {
  if (!eventCallbacks.has(sessionId)) {
    eventCallbacks.set(sessionId, new Set())
  }

  eventCallbacks.get(sessionId)!.add(callback)

  // Return unsubscribe function
  return () => {
    const callbacks = eventCallbacks.get(sessionId)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        eventCallbacks.delete(sessionId)
      }
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    status: row.status as SessionStatus,
    mission: row.mission as string | undefined,
    projectPath: row.project_path as string,
    branchName: row.branch_name as string | undefined,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    initialScore: row.initial_score as number | undefined,
    finalScore: row.final_score as number | undefined,
    commits: row.commits as number,
    duration: row.duration as number | undefined
  }
}

function rowToEvent(row: Record<string, unknown>): SessionEvent {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    type: row.type as string,
    data: row.data as string,
    timestamp: new Date(row.timestamp as string)
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
