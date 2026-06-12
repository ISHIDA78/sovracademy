#!/usr/bin/env tsx
/**
 * Génère toutes les leçons + exercices via Ollama (JSON mode) → content/
 * Usage :
 *   npm run generate                  → skip existants
 *   npm run generate -- --force       → regénère tout
 *   npm run generate -- --cursus=c0   → un seul cursus
 */
import fs from 'fs'
import path from 'path'

// Load .env manually (tsx doesn't auto-load it)
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
import { CUR } from '../lib/curriculum'
import {
  OLLAMA_MODEL,
  buildLessonJSONPrompt,
  buildQuizPrompt,
  buildCmdPrompt,
  buildAnalyzePrompt,
  buildFixPrompt,
  type LessonStream,
} from '../lib/ollama'

const OLLAMA_URL  = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const FORCE       = process.argv.includes('--force')
const TARGET_CID  = process.argv.find(a => a.startsWith('--cursus='))?.split('=')[1]

const LESSONS_DIR = path.join(process.cwd(), 'content', 'lessons')
const QUIZZES_DIR = path.join(process.cwd(), 'content', 'quizzes')

fs.mkdirSync(LESSONS_DIR, { recursive: true })
fs.mkdirSync(QUIZZES_DIR, { recursive: true })

/* ─── exercise type per lesson ─── */
type ExType = 'qcm' | 'cmd' | 'analyze' | 'fix'
const EXERCISE_TYPE: Record<string, ExType> = {
  // c0 — Linux & Terminal
  c0l0: 'cmd', c0l1: 'cmd', c0l2: 'cmd',
  c0l3: 'analyze', c0l4: 'cmd', c0l5: 'fix', c0l6: 'cmd',
  // c1 — Scripting
  c1l0: 'cmd', c1l1: 'fix', c1l2: 'cmd',
  c1l3: 'fix', c1l4: 'cmd', c1l5: 'fix',
  // c2 — Réseaux
  c2l0: 'qcm', c2l1: 'qcm', c2l2: 'analyze',
  c2l3: 'analyze', c2l4: 'cmd', c2l5: 'cmd', c2l6: 'qcm',
  // c3 — Crypto
  c3l0: 'qcm', c3l1: 'qcm', c3l2: 'qcm',
  c3l3: 'analyze', c3l4: 'analyze', c3l5: 'qcm',
  // c4 — Théorie OS
  c4l0: 'qcm', c4l1: 'qcm', c4l2: 'analyze',
  c4l3: 'analyze', c4l4: 'qcm', c4l5: 'qcm',
  // c5 — Architecture CPU
  c5l0: 'qcm', c5l1: 'qcm', c5l2: 'qcm', c5l3: 'qcm', c5l4: 'qcm',
  // c6 — Langages système
  c6l0: 'fix', c6l1: 'analyze', c6l2: 'analyze',
  c6l3: 'analyze', c6l4: 'qcm', c6l5: 'analyze', c6l6: 'qcm',
  // c7 — Sécurité
  c7l0: 'qcm', c7l1: 'analyze', c7l2: 'analyze',
  c7l3: 'analyze', c7l4: 'qcm', c7l5: 'qcm', c7l6: 'analyze',
  c7l7: 'qcm', c7l8: 'analyze', c7l9: 'cmd',
  c7l10: 'fix', c7l11: 'qcm', c7l12: 'analyze',
  // cf — final
  cfl0: 'qcm', cfl1: 'qcm', cfl2: 'qcm',
  cfl3: 'qcm', cfl4: 'qcm', cfl5: 'qcm',
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* Build regex variants for a command (handles multiple spaces) */
function cmdToAccept(cmd: string): string[] {
  const trimmed = cmd.trim()
  const escaped = escapeRegex(trimmed)
  // Also allow multiple spaces between tokens
  const flexible = trimmed.split(/\s+/).map(t => escapeRegex(t)).join('\\s+')
  return [`^${escaped}$`, `^${flexible}$`].filter((v, i, a) => a.indexOf(v) === i)
}

async function checkOllama(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch { return false }
}

async function ollamaJSON(prompt: string, timeoutMs = 60000): Promise<Record<string, unknown>> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { response: string }
  return JSON.parse(data.response) as Record<string, unknown>
}

async function genLesson(cid: string, lid: string): Promise<LessonStream> {
  const c = CUR.find(x => x.id === cid)!
  const l = c.lessons.find(x => x.id === lid)!
  const cursusIdx = ['c0','c1','c2','c3','c4','c5','c6','c7','cf'].indexOf(cid)
  const prompt = buildLessonJSONPrompt(c, l, cursusIdx)

  const raw = await ollamaJSON(prompt, 120000)

  // Normalise concept lines
  const conceptRaw = Array.isArray(raw.concept)
    ? (raw.concept as unknown[]).map(x => String(x).trim()).filter(Boolean)
    : [String(raw.concept ?? l.t)]

  const code = typeof raw.code === 'string'
    ? raw.code.replace(/\\n/g, '\n').trim()
    : ''

  const situation = typeof raw.situation === 'string'
    ? raw.situation.trim()
    : ''

  return { concept: conceptRaw, code, situation }
}

async function genExercise(
  cid: string,
  lid: string,
  concept: string[],
): Promise<Record<string, unknown>> {
  const c = CUR.find(x => x.id === cid)!
  const l = c.lessons.find(x => x.id === lid)!
  const type: ExType = EXERCISE_TYPE[lid] ?? 'qcm'

  let prompt: string
  switch (type) {
    case 'cmd':     prompt = buildCmdPrompt(c, l); break
    case 'analyze': prompt = buildAnalyzePrompt(c, l, concept); break
    case 'fix':     prompt = buildFixPrompt(c, l); break
    default:        prompt = buildQuizPrompt(c, l, concept.join(' '))
  }

  const raw = await ollamaJSON(prompt)

  /* ── Post-process per type into ExerciseContent format ── */
  if (type === 'cmd') {
    const command = String(raw.command ?? '').trim()
    if (!command) throw new Error('cmd: champ command manquant')
    return {
      type: 'cmd',
      scenario: String(raw.scenario ?? '').trim(),
      accept: cmdToAccept(command),
      hint: String(raw.hint ?? '').trim(),
      explanation: String(raw.explanation ?? '').trim(),
    }
  }

  if (type === 'analyze') {
    const answer = String(raw.answer ?? '').trim()
    if (!answer) throw new Error('analyze: champ answer manquant')
    const fakeOutput = String(raw.fakeOutput ?? '').trim()
    return {
      type: 'analyze',
      scenario: String(raw.scenario ?? '').trim(),
      context: { fakeOutput },
      accept: [`^${escapeRegex(answer)}$`, `^${escapeRegex(answer.toLowerCase())}$`]
        .filter((v, i, a) => a.indexOf(v) === i),
      hint: String(raw.hint ?? '').trim(),
      explanation: String(raw.explanation ?? '').trim(),
    }
  }

  if (type === 'fix') {
    const broken = String(raw.broken ?? '').trim()
    const fixed  = String(raw.fixed ?? '').trim()
    if (!fixed) throw new Error('fix: champ fixed manquant')
    if (fixed === broken) throw new Error('fix: fixed identique à broken, exercice invalide')
    return {
      type: 'fix',
      scenario: `Cette commande est incorrecte ou dangereuse : ${broken}`,
      context: { fakeOutput: String(raw.error_output ?? '').trim() },
      accept: cmdToAccept(fixed),
      hint: String(raw.hint ?? '').trim(),
      explanation: String(raw.explanation ?? '').trim(),
    }
  }

  /* qcm */
  if (!raw.question || !Array.isArray(raw.options)) {
    throw new Error('qcm: champs manquants')
  }
  return { type: 'qcm', ...raw }
}

async function main() {
  const available = await checkOllama()
  if (!available) {
    console.error(`Ollama inaccessible sur ${OLLAMA_URL}\nLance : ollama serve`)
    process.exit(1)
  }

  const cursusToProcess = TARGET_CID
    ? CUR.filter(c => c.id === TARGET_CID)
    : CUR

  if (cursusToProcess.length === 0) {
    console.error(`Cursus "${TARGET_CID}" introuvable`)
    process.exit(1)
  }

  const totalLessons = cursusToProcess.reduce((n, c) => n + c.lessons.length, 0)
  let idx = 0, skipped = 0, errors = 0

  console.log(`Modèle  : ${OLLAMA_MODEL}`)
  console.log(`Leçons  : ${totalLessons}`)
  console.log(`Mode    : ${FORCE ? 'force (regénère tout)' : 'incrémental'}`)
  console.log('─'.repeat(60))

  for (const c of cursusToProcess) {
    console.log(`\n[${c.id}] ${c.label}`)

    for (const l of c.lessons) {
      idx++
      const lessonFile  = path.join(LESSONS_DIR, `${l.id}.json`)
      const quizFile    = path.join(QUIZZES_DIR, `${l.id}.json`)
      const exType      = EXERCISE_TYPE[l.id] ?? 'qcm'
      const prefix      = `  [${String(idx).padStart(2)}/${totalLessons}] ${l.t.padEnd(45)} [${exType}]`

      const lessonExists = fs.existsSync(lessonFile)
      const quizExists   = fs.existsSync(quizFile)

      if (!FORCE && lessonExists && quizExists) {
        console.log(`${prefix} skip`)
        skipped++
        continue
      }

      process.stdout.write(`${prefix} ... `)

      try {
        let lessonData: LessonStream

        if (!FORCE && lessonExists) {
          lessonData = JSON.parse(fs.readFileSync(lessonFile, 'utf-8')) as LessonStream
        } else {
          lessonData = await genLesson(c.id, l.id)
          fs.writeFileSync(lessonFile, JSON.stringify(lessonData, null, 2))
        }

        if (FORCE || !quizExists) {
          const exerciseData = await genExercise(c.id, l.id, lessonData.concept)
          fs.writeFileSync(quizFile, JSON.stringify(exerciseData, null, 2))
        }

        process.stdout.write('OK\n')
      } catch (err) {
        process.stdout.write(`ERR: ${(err as Error).message}\n`)
        errors++
      }
    }
  }

  console.log('\n' + '─'.repeat(60))
  const generated = idx - skipped - errors
  console.log(`Générés : ${generated}  |  Ignorés : ${skipped}  |  Erreurs : ${errors}`)
  if (errors === 0) console.log('\nProchaine étape : npm run upload-ftp')
}

main()
