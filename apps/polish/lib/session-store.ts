import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import type { PolishEvent, PlanStep, PlanMessage, PlanningApproach } from './types'

// ============================================================================
// Types
// ============================================================================

export type SessionStatus = 'pending' | 'planning' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'cancelled'

export type FeedbackRating = 'satisfied' | 'unsatisfied'

export interface SessionFeedback {
  rating: FeedbackRating
  comment?: string
  createdAt: Date
}

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
  feedback?: SessionFeedback
  retryCount: number // Nombre de fois que cette session a été relancée
  // Planning phase
  enablePlanning?: boolean // Whether planning is enabled for this session
  approvedPlan?: PlanStep[] // The approved plan (if any)
  availableApproaches?: PlanningApproach[] // Available approaches from planning
  selectedApproachId?: string // Which approach was selected
  // Provider
  providerId?: string // AI provider used for this session
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
  duration INTEGER,
  feedback_rating TEXT,
  feedback_comment TEXT,
  feedback_created_at TEXT,
  retry_count INTEGER DEFAULT 0,
  enable_planning INTEGER DEFAULT 0,
  approved_plan TEXT,
  provider_id TEXT
);

CREATE TABLE IF NOT EXISTS session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plan_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT,
  api_key TEXT NOT NULL,
  model TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON session_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_plan_messages_session ON plan_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_providers_default ON providers(is_default);
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
`

let db: Database.Database | null = null

/** Get the database instance (creates if needed, runs migrations) */
export function getDb(): Database.Database {
  if (!db) {
    const dir = dirname(DB_PATH)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)

    // Run migrations for existing databases
    runMigrations(db)
  }
  return db
}

function runMigrations(db: Database.Database): void {
  // Check if feedback columns exist
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[]
  const columnNames = columns.map(c => c.name)

  if (!columnNames.includes('feedback_rating')) {
    db.exec('ALTER TABLE sessions ADD COLUMN feedback_rating TEXT')
  }
  if (!columnNames.includes('feedback_comment')) {
    db.exec('ALTER TABLE sessions ADD COLUMN feedback_comment TEXT')
  }
  if (!columnNames.includes('feedback_created_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN feedback_created_at TEXT')
  }
  if (!columnNames.includes('retry_count')) {
    db.exec('ALTER TABLE sessions ADD COLUMN retry_count INTEGER DEFAULT 0')
  }
  // Planning phase columns
  if (!columnNames.includes('enable_planning')) {
    db.exec('ALTER TABLE sessions ADD COLUMN enable_planning INTEGER DEFAULT 0')
  }
  if (!columnNames.includes('approved_plan')) {
    db.exec('ALTER TABLE sessions ADD COLUMN approved_plan TEXT')
  }
  // Provider column
  if (!columnNames.includes('provider_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN provider_id TEXT')
  }
  // Multiple approaches columns
  if (!columnNames.includes('available_approaches')) {
    db.exec('ALTER TABLE sessions ADD COLUMN available_approaches TEXT')
  }
  if (!columnNames.includes('selected_approach_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN selected_approach_id TEXT')
  }

  // Check if plan_messages table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plan_messages'").all()
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS plan_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_plan_messages_session ON plan_messages(session_id);
    `)
  }

  // Check if providers table exists
  const providerTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='providers'").all()
  if (providerTable.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        base_url TEXT,
        api_key TEXT NOT NULL,
        model TEXT,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_providers_default ON providers(is_default);
      CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
    `)
  } else {
    // Migration: Add model column to existing providers table
    const providerColumns = db.prepare("PRAGMA table_info(providers)").all() as { name: string }[]
    const providerColumnNames = providerColumns.map(c => c.name)
    if (!providerColumnNames.includes('model')) {
      db.exec('ALTER TABLE providers ADD COLUMN model TEXT')
    }
  }
}

// ============================================================================
// Session CRUD
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSession(config: {
  mission?: string
  projectPath: string
  enablePlanning?: boolean
  providerId?: string
}): Session {
  const db = getDb()
  const id = generateId()
  const now = new Date()

  const session: Session = {
    id,
    status: config.enablePlanning ? 'planning' : 'pending',
    mission: config.mission,
    projectPath: config.projectPath,
    startedAt: now,
    commits: 0,
    retryCount: 0,
    enablePlanning: config.enablePlanning,
    providerId: config.providerId
  }

  db.prepare(`
    INSERT INTO sessions (id, status, mission, project_path, started_at, commits, retry_count, enable_planning, provider_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, session.status, session.mission || null, session.projectPath, now.toISOString(), 0, 0, config.enablePlanning ? 1 : 0, config.providerId || null)

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
  if (updates.feedback !== undefined) {
    fields.push('feedback_rating = ?')
    values.push(updates.feedback.rating)
    fields.push('feedback_comment = ?')
    values.push(updates.feedback.comment || null)
    fields.push('feedback_created_at = ?')
    values.push(updates.feedback.createdAt.toISOString())
  }
  if (updates.retryCount !== undefined) {
    fields.push('retry_count = ?')
    values.push(updates.retryCount)
  }
  if (updates.enablePlanning !== undefined) {
    fields.push('enable_planning = ?')
    values.push(updates.enablePlanning ? 1 : 0)
  }
  if (updates.approvedPlan !== undefined) {
    fields.push('approved_plan = ?')
    values.push(JSON.stringify(updates.approvedPlan))
  }
  if (updates.availableApproaches !== undefined) {
    fields.push('available_approaches = ?')
    values.push(JSON.stringify(updates.availableApproaches))
  }
  if (updates.selectedApproachId !== undefined) {
    fields.push('selected_approach_id = ?')
    values.push(updates.selectedApproachId)
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
  const timestampStr = now.toISOString()

  db.prepare(`
    INSERT INTO session_events (session_id, type, data, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, event.type, JSON.stringify(event.data), timestampStr)

  // Include timestamp in the event for subscribers
  const eventWithTimestamp = {
    ...event,
    timestamp: timestampStr
  }

  // Notify subscribers
  const callbacks = eventCallbacks.get(sessionId)
  if (callbacks) {
    callbacks.forEach(callback => {
      try {
        callback(eventWithTimestamp as PolishEvent & { timestamp: string })
      } catch (err) {
        console.error(`[Session Store] Callback error for session ${sessionId}, event ${event.type}:`, err)
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
// Plan Messages
// ============================================================================

export function addPlanMessage(sessionId: string, message: PlanMessage): void {
  const db = getDb()

  db.prepare(`
    INSERT INTO plan_messages (session_id, message_id, role, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, message.id, message.role, message.content, message.timestamp)

  // Also emit as event for SSE
  addEvent(sessionId, {
    type: 'plan_message',
    data: { message }
  })
}

export function getPlanMessages(sessionId: string): PlanMessage[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM plan_messages
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(sessionId) as Record<string, unknown>[]

  return rows.map(row => ({
    id: row.message_id as string,
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
    timestamp: row.timestamp as string
  }))
}

export function clearPlanMessages(sessionId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM plan_messages WHERE session_id = ?').run(sessionId)
}

// ============================================================================
// Helpers
// ============================================================================

function rowToSession(row: Record<string, unknown>): Session {
  let approvedPlan: PlanStep[] | undefined
  if (row.approved_plan) {
    try {
      approvedPlan = JSON.parse(row.approved_plan as string)
    } catch {
      approvedPlan = undefined
    }
  }

  let availableApproaches: PlanningApproach[] | undefined
  if (row.available_approaches) {
    try {
      availableApproaches = JSON.parse(row.available_approaches as string)
    } catch {
      availableApproaches = undefined
    }
  }

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
    duration: row.duration as number | undefined,
    feedback: row.feedback_rating ? {
      rating: row.feedback_rating as FeedbackRating,
      comment: row.feedback_comment as string | undefined,
      createdAt: new Date(row.feedback_created_at as string)
    } : undefined,
    retryCount: (row.retry_count as number) ?? 0,
    enablePlanning: Boolean(row.enable_planning),
    approvedPlan,
    availableApproaches,
    selectedApproachId: row.selected_approach_id as string | undefined,
    providerId: row.provider_id as string | undefined
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
