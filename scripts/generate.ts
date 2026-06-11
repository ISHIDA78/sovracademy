#!/usr/bin/env tsx
/**
 * Génère toutes les leçons + quiz via Ollama et les sauvegarde dans content/
 * Usage :
 *   npm run generate                  → génère tout (skip existants)
 *   npm run generate -- --force       → regénère tout
 *   npm run generate -- --cursus=c0   → un seul cursus
 */
import fs from 'fs'
import path from 'path'
import { CUR } from '../lib/curriculum'
import {
  OLLAMA_MODEL,
  buildConceptPrompt,
  buildQuizPrompt,
  parseLessonText,
  type LessonStream,
  type QuizContent,
} from '../lib/ollama'

const OLLAMA_URL   = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const FORCE        = process.argv.includes('--force')
const TARGET_CID   = process.argv.find(a => a.startsWith('--cursus='))?.split('=')[1]
const DEFAULT_XP   = 1000 // niveau intermédiaire pour la pré-génération

const LESSONS_DIR  = path.join(process.cwd(), 'content', 'lessons')
const QUIZZES_DIR  = path.join(process.cwd(), 'content', 'quizzes')

fs.mkdirSync(LESSONS_DIR, { recursive: true })
fs.mkdirSync(QUIZZES_DIR, { recursive: true })

async function checkOllama(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch { return false }
}

async function genLesson(cid: string, lid: string): Promise<LessonStream> {
  const c = CUR.find(x => x.id === cid)!
  const l = c.lessons.find(x => x.id === lid)!
  const prompt = buildConceptPrompt(c, l, DEFAULT_XP, 0, c.lessons.length)

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true }),
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let raw = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of dec.decode(value, { stream: true }).split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as { response?: string; done?: boolean }
        if (obj.response) raw += obj.response
      } catch { /* partial line */ }
    }
  }

  return parseLessonText(raw)
}

async function genQuiz(cid: string, lid: string, concept: string[]): Promise<QuizContent> {
  const c = CUR.find(x => x.id === cid)!
  const l = c.lessons.find(x => x.id === lid)!
  const prompt = buildQuizPrompt(c, l, concept.join(' '))

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { response: string }
  return JSON.parse(data.response) as QuizContent
}

async function main() {
  const available = await checkOllama()
  if (!available) {
    console.error(`Ollama inaccessible sur ${OLLAMA_URL}`)
    console.error('Lance : ollama serve')
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
      const lessonFile = path.join(LESSONS_DIR, `${l.id}.json`)
      const quizFile   = path.join(QUIZZES_DIR, `${l.id}.json`)
      const prefix     = `  [${idx}/${totalLessons}] ${l.t}`

      const lessonExists = fs.existsSync(lessonFile)
      const quizExists   = fs.existsSync(quizFile)

      if (!FORCE && lessonExists && quizExists) {
        console.log(`${prefix} — skip`)
        skipped++
        continue
      }

      process.stdout.write(`${prefix}... `)

      try {
        let lessonData: LessonStream

        if (!FORCE && lessonExists) {
          lessonData = JSON.parse(fs.readFileSync(lessonFile, 'utf-8')) as LessonStream
        } else {
          lessonData = await genLesson(c.id, l.id)
          fs.writeFileSync(lessonFile, JSON.stringify(lessonData, null, 2))
        }

        if (FORCE || !quizExists) {
          const quizData = await genQuiz(c.id, l.id, lessonData.concept)
          fs.writeFileSync(quizFile, JSON.stringify(quizData, null, 2))
        }

        process.stdout.write('OK\n')
      } catch (err) {
        process.stdout.write(`ERREUR: ${(err as Error).message}\n`)
        errors++
      }
    }
  }

  console.log('\n' + '─'.repeat(60))
  const generated = idx - skipped - errors
  console.log(`Générés : ${generated}  |  Ignorés : ${skipped}  |  Erreurs : ${errors}`)
  if (errors === 0) {
    console.log(`\nProchaine étape : npm run upload-ftp`)
  }
}

main()
