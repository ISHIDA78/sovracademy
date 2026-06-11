import { type Cursus, type Lesson, rank } from './curriculum'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

export interface QuizContent {
  question: string
  options: Array<{ key: string; label: string; correct: boolean }>
  explanation: string
}

export interface LessonStream {
  concept: string[]   // parsed lines from stream
  code: string        // code block content
  situation: string   // mise en situation
}

/* ─── check availability ─── */
export async function ollamaAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return r.ok
  } catch { return false }
}

/* ─── prompt for concept/code/situation (plain text, streamable) ─── */
export function buildConceptPrompt(c: Cursus, l: Lesson, xp: number, done: number, total: number): string {
  const level = xp < 500 ? 'débutant' : xp < 2000 ? 'intermédiaire' : 'avancé'
  const progress = `${done}/${total} leçons complétées dans ce module`

  return `Tu es un formateur expert en sécurité informatique et systèmes bas niveau pour SŌVR Academy.

PROFIL ÉTUDIANT : ${xp} XP · niveau ${level} · ${rank(xp)} · ${progress}

MODULE  : ${c.label} (${c.id}) — ${c.sub}
LEÇON   : ${l.t}
XP cible: +${l.xp}

RÈGLE PÉDAGOGIQUE ABSOLUE :
Chaque leçon DOIT commencer depuis la définition fondamentale du concept,
même si l'étudiant est avancé. La progression se fait DANS la leçon :
  Ligne 1 : Qu'est-ce que c'est ? (définition courte, sans jargon)
  Ligne 2 : Pourquoi ça existe, quel problème ça résout ?
  Ligne 3 : Comment ça fonctionne en interne (mécanisme concret)
  Ligne 4 : Ce qu'il faut absolument savoir en pratique
  Ligne 5+ : Subtilités, pièges, cas avancés (selon le niveau ${level})

INSTRUCTIONS DE STYLE :
- Langue FRANÇAISE exclusivement
- Documentation technique Unix : dense, direct, sans politesse ni intro
- Texte brut uniquement : aucun markdown (pas de **, ##, __, ni backticks en dehors du bloc CODE)
- Chaque ligne du CONCEPT ≤ 80 caractères, commence par un verbe ou un nom

Génère la leçon dans ce format EXACT (respecte les marqueurs, rien avant CONCEPT:) :

CONCEPT:
[5 à 7 lignes suivant la progression pédagogique ci-dessus]

CODE:
[15 à 25 lignes de code, commandes shell, ou pseudo-code selon le sujet]
[Commentaires courts en français après # ou //]
[Le code doit illustrer les notions de base puis progresser vers l'avancé]

SITUATION:
[1 à 2 phrases : scenario réel où ce concept s'applique concrètement]`
}

/* ─── prompt for QCM (JSON output) ─── */
export function buildQuizPrompt(c: Cursus, l: Lesson, conceptSummary: string): string {
  return `Tu es un formateur expert. Génère un QCM technique sur cette leçon.

MODULE : ${c.label}
LEÇON  : ${l.t}
RÉSUMÉ : ${conceptSummary.substring(0, 200)}

Réponds UNIQUEMENT avec ce JSON valide (rien d'autre autour) :
{
  "question": "question technique précise sur un concept clé, en français",
  "options": [
    {"key": "A", "label": "réponse courte (8 mots max)", "correct": false},
    {"key": "B", "label": "réponse courte (8 mots max)", "correct": false},
    {"key": "C", "label": "réponse courte (8 mots max)", "correct": true},
    {"key": "D", "label": "réponse courte (8 mots max)", "correct": false}
  ],
  "explanation": "explication courte de la bonne réponse (15 mots max)"
}

IMPORTANT : varie la position de la bonne réponse. Labels concis et techniques.`
}

/* ─── parse the plain-text lesson output ─── */
export function parseLessonText(raw: string): LessonStream {
  const conceptMatch = raw.match(/CONCEPT:\s*\n([\s\S]*?)(?=\nCODE:|$)/)
  const codeMatch    = raw.match(/CODE:\s*\n([\s\S]*?)(?=\nSITUATION:|$)/)
  const situMatch    = raw.match(/SITUATION:\s*\n([\s\S]*)/)

  const conceptLines = (conceptMatch?.[1] ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  // Strip markdown code fences (```lang ... ```)
  const rawCode = (codeMatch?.[1] ?? '').trim()
  const code    = rawCode.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim()
  const situation    = (situMatch?.[1] ?? '').trim().split('\n').filter(Boolean).join(' ')

  return { concept: conceptLines.length ? conceptLines : ['Contenu en cours de génération...'], code, situation }
}

/* ─── fallback static content (Ollama unavailable) ─── */
export function fallbackLesson(c: Cursus, l: Lesson): LessonStream {
  return {
    concept: [
      `Module : ${l.t}`,
      `Couche : ${c.label} — ${c.sub}`,
      'Ollama non disponible — contenu statique de démonstration.',
      'Lance Ollama (ollama serve) pour le contenu généré dynamiquement.',
    ],
    code: `# Exemple — ${l.t}\n# Contenu généré dynamiquement par Ollama`,
    situation: `Ollama requis pour la mise en situation de cette leçon.`,
  }
}

export function fallbackQuiz(c: Cursus, l: Lesson): QuizContent {
  return {
    question: `Quel est l'objectif principal de la leçon "${l.t}" ?`,
    options: [
      { key: 'A', label: 'Comprendre les bases théoriques', correct: false },
      { key: 'B', label: 'Maîtriser la pratique système', correct: true },
      { key: 'C', label: 'Apprendre un langage de script', correct: false },
      { key: 'D', label: 'Configurer un service réseau', correct: false },
    ],
    explanation: 'Cette leçon vise la maîtrise pratique du domaine.',
  }
}

/* ─── in-memory cache ─── */
const conceptCache = new Map<string, LessonStream>()
const quizCache    = new Map<string, QuizContent>()

export function getCachedLesson(key: string) { return conceptCache.get(key) }
export function setCachedLesson(key: string, v: LessonStream) { conceptCache.set(key, v) }
export function getCachedQuiz(key: string) { return quizCache.get(key) }
export function setCachedQuiz(key: string, v: QuizContent) { quizCache.set(key, v) }

/* ─── generate quiz (non-streaming, JSON) ─── */
export async function generateQuiz(c: Cursus, l: Lesson, conceptLines: string[]): Promise<QuizContent> {
  const key = `${c.id}:${l.id}`
  const cached = getCachedQuiz(key)
  if (cached) return cached

  try {
    const prompt = buildQuizPrompt(c, l, conceptLines.join(' '))
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error('Ollama error')
    const data = await res.json() as { response: string }
    const quiz = JSON.parse(data.response) as QuizContent
    setCachedQuiz(key, quiz)
    return quiz
  } catch {
    return fallbackQuiz(c, l)
  }
}
