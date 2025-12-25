import { readFile, readdir, stat } from 'fs/promises'
import { join, extname } from 'path'

// ============================================================================
// Configuration
// ============================================================================

export interface CodeStyleConfig {
  maxFunctionLines?: number
  maxFileLines?: number
  includedExtensions?: string[]
  excludedPaths?: string[]
}

const DEFAULT_CONFIG: Required<CodeStyleConfig> = {
  maxFunctionLines: 50,
  maxFileLines: 500,
  includedExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  excludedPaths: ['node_modules', 'dist', 'build', '.next', 'coverage', '__tests__', '.git']
}

// ============================================================================
// Types
// ============================================================================

export interface FunctionInfo {
  name: string
  startLine: number
  endLine: number
  lines: number
}

export interface FileAnalysis {
  path: string
  totalLines: number
  functions: FunctionInfo[]
  longFunctions: FunctionInfo[]
  isTooLong: boolean
}

export interface CodeStyleReport {
  totalFiles: number
  totalFunctions: number
  filesAnalyzed: string[]
  longFiles: string[]
  longFunctionsCount: number
  averageFileLength: number
  averageFunctionLength: number
  maxFileLength: number
  maxFunctionLength: number
  score: number // 0-100, percentage of code following style rules
}

// ============================================================================
// File System Utils
// ============================================================================

async function getAllFiles(dir: string, config: Required<CodeStyleConfig>): Promise<string[]> {
  const files: string[] = []

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      const relativePath = fullPath.replace(dir + '/', '')

      // Skip excluded paths
      if (config.excludedPaths.some(excluded => relativePath.includes(excluded))) {
        continue
      }

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (config.includedExtensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  await walk(dir)
  return files
}

// ============================================================================
// Code Analysis
// ============================================================================

function findFunctions(content: string): FunctionInfo[] {
  const lines = content.split('\n')
  const functions: FunctionInfo[] = []
  const stack: { name: string; startLine: number; indent: number }[] = []

  // Patterns pour détecter les fonctions
  const functionPatterns = [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,  // function name()
    /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,  // const name = () =>
    /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/,  // const name = function
    /^\s*(\w+)\s*\([^)]*\)\s*{/,  // name() {
    /^\s*(?:async\s+)?(\w+)\([^)]*\)\s*:/  // TypeScript method signature
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const indent = line.search(/\S/)

    // Essayer de matcher une déclaration de fonction
    let functionName: string | null = null
    for (const pattern of functionPatterns) {
      const match = line.match(pattern)
      if (match) {
        functionName = match[1]
        break
      }
    }

    if (functionName) {
      // Nouvelle fonction détectée
      stack.push({ name: functionName, startLine: i + 1, indent })
    }

    // Détecter la fin d'une fonction (approximation basée sur les accolades et l'indentation)
    if (stack.length > 0) {
      const current = stack[stack.length - 1]

      // Si on trouve une accolade fermante au même niveau d'indentation (ou moins)
      if (line.trim() === '}' && indent <= current.indent) {
        const func = stack.pop()!
        functions.push({
          name: func.name,
          startLine: func.startLine,
          endLine: i + 1,
          lines: i + 1 - func.startLine + 1
        })
      }
    }
  }

  // Fermer les fonctions restantes (cas où on n'a pas trouvé la fermeture)
  while (stack.length > 0) {
    const func = stack.pop()!
    functions.push({
      name: func.name,
      startLine: func.startLine,
      endLine: lines.length,
      lines: lines.length - func.startLine + 1
    })
  }

  return functions
}

async function analyzeFile(filePath: string, config: Required<CodeStyleConfig>): Promise<FileAnalysis> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const totalLines = lines.length

  const functions = findFunctions(content)
  const longFunctions = functions.filter(f => f.lines > config.maxFunctionLines)

  return {
    path: filePath,
    totalLines,
    functions,
    longFunctions,
    isTooLong: totalLines > config.maxFileLines
  }
}

// ============================================================================
// Report Generation
// ============================================================================

export async function analyzeCodeStyle(
  projectPath: string,
  config: Partial<CodeStyleConfig> = {}
): Promise<CodeStyleReport> {
  const fullConfig: Required<CodeStyleConfig> = {
    ...DEFAULT_CONFIG,
    ...config
  }

  // Récupérer tous les fichiers
  const files = await getAllFiles(projectPath, fullConfig)

  if (files.length === 0) {
    return {
      totalFiles: 0,
      totalFunctions: 0,
      filesAnalyzed: [],
      longFiles: [],
      longFunctionsCount: 0,
      averageFileLength: 0,
      averageFunctionLength: 0,
      maxFileLength: 0,
      maxFunctionLength: 0,
      score: 100
    }
  }

  // Analyser chaque fichier
  const analyses = await Promise.all(
    files.map(file => analyzeFile(file, fullConfig))
  )

  // Calculer les statistiques
  const totalFiles = analyses.length
  const totalFunctions = analyses.reduce((sum, a) => sum + a.functions.length, 0)
  const longFiles = analyses.filter(a => a.isTooLong).map(a => a.path)
  const longFunctionsCount = analyses.reduce((sum, a) => sum + a.longFunctions.length, 0)

  const totalFileLines = analyses.reduce((sum, a) => sum + a.totalLines, 0)
  const averageFileLength = totalFileLines / totalFiles

  const totalFunctionLines = analyses.reduce(
    (sum, a) => sum + a.functions.reduce((s, f) => s + f.lines, 0),
    0
  )
  const averageFunctionLength = totalFunctions > 0 ? totalFunctionLines / totalFunctions : 0

  const maxFileLength = Math.max(...analyses.map(a => a.totalLines), 0)
  const maxFunctionLength = Math.max(
    ...analyses.flatMap(a => a.functions.map(f => f.lines)),
    0
  )

  // Calculer le score (0-100)
  // Pénalités pour les violations
  const longFilePenalty = (longFiles.length / totalFiles) * 50
  const longFunctionPenalty = totalFunctions > 0 ? (longFunctionsCount / totalFunctions) * 50 : 0

  const score = Math.max(0, Math.min(100, 100 - longFilePenalty - longFunctionPenalty))

  return {
    totalFiles,
    totalFunctions,
    filesAnalyzed: files,
    longFiles,
    longFunctionsCount,
    averageFileLength: Math.round(averageFileLength * 10) / 10,
    averageFunctionLength: Math.round(averageFunctionLength * 10) / 10,
    maxFileLength,
    maxFunctionLength,
    score: Math.round(score * 10) / 10
  }
}

// ============================================================================
// CLI-friendly output
// ============================================================================

export function calculateCodeStyleScore(projectPath: string, config?: Partial<CodeStyleConfig>): Promise<number> {
  return analyzeCodeStyle(projectPath, config).then(report => report.score)
}
