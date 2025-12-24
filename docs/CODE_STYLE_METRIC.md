# Métrique de Code Style

## Vue d'ensemble

Cette métrique analyse automatiquement la qualité du code en vérifiant:
- **Longueur des fonctions**: Les fonctions ne doivent pas dépasser 50 lignes
- **Longueur des fichiers**: Les fichiers ne doivent pas dépasser 500 lignes

## Configuration

### Limites par défaut
- `maxFunctionLines`: 50 lignes
- `maxFileLines`: 500 lignes
- `target`: 90% (score cible dans le preset)

### Poids de la métrique
La métrique `codeStyle` a un poids de **15%** dans le score global.

## Comment ça marche

### Calcul du score

Le score est calculé sur une échelle de 0 à 100:
- **Pénalité pour fichiers longs**: (nombre de fichiers trop longs / total de fichiers) × 50
- **Pénalité pour fonctions longues**: (nombre de fonctions trop longues / total de fonctions) × 50
- **Score final**: 100 - pénalités

### Fichiers exclus
- `node_modules/`
- `dist/`, `build/`, `.next/`
- `coverage/`
- `__tests__/`, fichiers de test
- `.git/`

### Extensions analysées
- `.ts`, `.tsx` (TypeScript)
- `.js`, `.jsx` (JavaScript)

## Utilisation

### Via CLI
```bash
npx tsx scripts/check-code-style.ts [chemin]
```

### Via l'API
```typescript
import { analyzeCodeStyle, calculateCodeStyleScore } from './lib/code-style-analyzer'

// Analyse complète
const report = await analyzeCodeStyle(projectPath)
console.log(report.score)
console.log(report.longFunctions)
console.log(report.longFiles)

// Score uniquement
const score = await calculateCodeStyleScore(projectPath)
console.log(score)
```

### Configuration personnalisée
```typescript
const report = await analyzeCodeStyle(projectPath, {
  maxFunctionLines: 30,
  maxFileLines: 300,
  includedExtensions: ['.ts', '.js'],
  excludedPaths: ['node_modules', 'dist']
})
```

## Stratégie d'amélioration

La stratégie `improve-code-style` est automatiquement déclenchée quand le score est trop bas:

1. Identifie UNE fonction trop longue (>50 lignes) OU UN fichier trop long (>500 lignes)
2. Refactorise en extrayant des fonctions plus petites ou en divisant le fichier
3. Vérifie que le code reste fonctionnel

## Exemples de refactoring

### Fonction trop longue
**Avant:**
```typescript
function processUserData(user) {
  // 80 lignes de code...
  // validation
  // transformation
  // sauvegarde
  // notifications
}
```

**Après:**
```typescript
function processUserData(user) {
  validateUser(user)
  const transformed = transformUserData(user)
  saveUser(transformed)
  notifyUserCreation(transformed)
}

function validateUser(user) { /* ... */ }
function transformUserData(user) { /* ... */ }
function saveUser(user) { /* ... */ }
function notifyUserCreation(user) { /* ... */ }
```

### Fichier trop long
**Avant:**
```typescript
// user-service.ts (700 lignes)
// - validation
// - CRUD operations
// - authentication
// - authorization
```

**Après:**
```typescript
// user-service.ts (150 lignes)
import { validateUser } from './user-validation'
import { UserRepository } from './user-repository'
import { authenticate } from './user-auth'
import { authorize } from './user-authorization'
```

## Tests

Les tests sont dans `lib/__tests__/code-style-analyzer.test.ts`:
- Détection de fonctions courtes et longues
- Détection de fichiers courts et longs
- Exclusion des fichiers de test et node_modules
- Configuration personnalisée
- Calcul des statistiques

```bash
npm test -- code-style-analyzer.test.ts
```

## Score cible

Le score cible est configuré à **90%** (et non 100%) car:
- Un score de 100% est irréaliste pour la plupart des projets
- Certaines fonctions complexes peuvent légitimement dépasser 50 lignes
- Certains fichiers (comme les routes API) peuvent nécessiter plus de 500 lignes
- Un objectif de 90% encourage une bonne hygiène de code sans être trop strict
