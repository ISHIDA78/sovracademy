import { type Cursus, type Lesson, rank } from './curriculum'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

export interface QuizContent {
  question: string
  options: Array<{ key: string; label: string; correct: boolean }>
  explanation: string
}

export interface LessonStream {
  concept: string[]
  code: string
  situation: string
}

/* ─── check availability ─── */
export async function ollamaAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return r.ok
  } catch { return false }
}

/* ─── pedagogical level by cursus index (0-8) ─── */
function pedagogy(cursusIdx: number): string {
  if (cursusIdx <= 1) return `
APPROCHE OBLIGATOIRE pour ce module débutant :
- Commence TOUJOURS par une analogie de la vie quotidienne (pas d'informatique)
- Explique le "pourquoi ça existe" AVANT le "comment ça marche"
- Chaque concept : quel avantage ça donne à un hacker ou à un défenseur ?
- Pas de jargon sans définition immédiate entre parenthèses
- Ton : direct, comme si tu parlais à quelqu'un qui n'a jamais vu un terminal`

  if (cursusIdx <= 3) return `
APPROCHE pour ce module intermédiaire :
- Suppose que l'étudiant connaît le terminal et les commandes de base
- Parte d'un cas pratique concret avant la théorie
- Connecte toujours au contexte sécurité (attaque possible, vecteur de compromission)
- Mécanisme interne en 1-2 lignes, puis implications pratiques`

  return `
APPROCHE pour ce module avancé :
- Dense et direct, pas d'analogies basiques
- Mécanismes internes précis (registres, syscall numbers, structures kernel)
- Exemples orientés exploitation/analyse/hardening
- Références aux CVE, RFC, ou papiers de recherche si pertinent`
}

/* ─── prompt for concept/code/situation (plain text, streamable) ─── */
export function buildConceptPrompt(c: Cursus, l: Lesson, xp: number, done: number, total: number): string {
  const level = xp < 500 ? 'débutant' : xp < 2000 ? 'intermédiaire' : 'avancé'
  const cursusIdx = ['c0','c1','c2','c3','c4','c5','c6','c7','cf'].indexOf(c.id)

  return `Tu es un formateur expert en sécurité informatique pour SŌVR Academy.

PROFIL ÉTUDIANT : ${xp} XP · niveau ${level} · ${rank(xp)} · ${done}/${total} leçons dans ce module

MODULE  : ${c.label} — ${c.sub}
LEÇON   : ${l.t}
XP cible: +${l.xp}
${pedagogy(cursusIdx)}

FORMAT EXACT (rien avant CONCEPT:, respecte les marqueurs) :

CONCEPT:
[5 à 7 lignes — progression : définition accessible → mécanisme interne → implication sécurité]
[Chaque ligne ≤ 80 caractères, commence par un verbe d'action ou un substantif]
[Zéro markdown : pas de ** ## __ ni backticks]

CODE:
[15 à 25 lignes de commandes shell ou code illustrant la leçon]
[Commentaires en français après # ou //]
[Du basique vers l'avancé dans le même bloc]

SITUATION:
[1 à 2 phrases : scénario réel d'attaque ou de défense où ce concept est décisif]`
}

/* ─── prompt for lesson content (JSON, used by generate.ts offline) ─── */
export function buildLessonJSONPrompt(c: Cursus, l: Lesson, cursusIdx: number): string {
  return `Tu es un formateur expert en sécurité informatique pour SŌVR Academy.
MODULE : ${c.label} — ${c.sub}
LEÇON  : ${l.t}
${pedagogy(cursusIdx)}

Réponds UNIQUEMENT avec ce JSON valide (rien d'autre avant ou après) :
{
  "concept": [
    "ligne 1 : définition simple ou analogie (max 90 chars)",
    "ligne 2 : pourquoi ça existe, quel problème ça résout",
    "ligne 3 : mécanisme interne concret",
    "ligne 4 : ce qu'il faut savoir en pratique",
    "ligne 5 : lien avec la sécurité offensive ou défensive",
    "ligne 6 : piège ou subtilité importante (optionnel)"
  ],
  "code": "# code ou commandes illustrant la leçon\\n# commentaires courts en français\\n# du basique vers l'avancé",
  "situation": "scénario réel d'attaque ou de défense en 1-2 phrases"
}

RÈGLES ABSOLUES :
- Chaque élément de concept : max 90 caractères, zéro markdown (pas de * # ** \`)
- code : multi-ligne avec \\n, entre 10 et 20 lignes utiles
- situation : 1-2 phrases, concrètes, orientées sécurité`
}

/* ─── prompt for QCM exercise ─── */
export function buildQuizPrompt(c: Cursus, l: Lesson, conceptSummary: string): string {
  return `Tu es un formateur expert. Génère un QCM sur la leçon "${l.t}" (module ${c.label}).
RÉSUMÉ : ${conceptSummary.substring(0, 200)}

Réponds UNIQUEMENT avec ce JSON valide (rien d'autre) :
{
  "type": "qcm",
  "question": "question précise sur un mécanisme clé, en français",
  "options": [
    {"key": "A", "label": "réponse courte (8 mots max)", "correct": false},
    {"key": "B", "label": "réponse courte (8 mots max)", "correct": false},
    {"key": "C", "label": "réponse courte (8 mots max)", "correct": true},
    {"key": "D", "label": "réponse courte (8 mots max)", "correct": false}
  ],
  "explanation": "explication de la bonne réponse (15 mots max)"
}

Varie la position de la bonne réponse. Labels concis, pas de phrases complètes.`
}

/* ─── prompt for CMD exercise (simplified — no regex asked) ─── */
export function buildCmdPrompt(c: Cursus, l: Lesson): string {
  return `Tu es un formateur Linux. Génère un exercice CMD pour la leçon "${l.t}" (module ${c.label}).
L'étudiant tape UNE commande Linux précise dans un terminal.

Réponds UNIQUEMENT avec ce JSON valide (rien d'autre) :
{
  "type": "cmd",
  "scenario": "description de la tâche en 2-3 phrases, contexte concret, sans donner la commande",
  "command": "la commande exacte que l'étudiant doit taper (ex: ls -la /etc)",
  "hint": "indice sans révéler la commande (ex: pense à l'option -a)",
  "explanation": "pourquoi cette commande, son utilité en sécurité (1 phrase)"
}

RÈGLES : commande liée à la leçon, pas de placeholder, langue française.`
}

/* ─── prompt for ANALYZE exercise (simplified) ─── */
export function buildAnalyzePrompt(c: Cursus, l: Lesson, conceptLines: string[]): string {
  return `Tu es un formateur sécurité. Génère un exercice ANALYZE pour la leçon "${l.t}" (module ${c.label}).
L'étudiant lit une sortie système et tape une réponse courte (un mot, un nombre, un identifiant).
CONTEXTE : ${conceptLines.slice(0, 2).join(' — ')}

Réponds UNIQUEMENT avec ce JSON valide (rien d'autre) :
{
  "type": "analyze",
  "scenario": "ce que l'étudiant doit trouver dans la sortie suivante (1-2 phrases)",
  "fakeOutput": "sortie réaliste de commande Linux (5-10 lignes, données inventées)",
  "answer": "la réponse courte exacte attendue (1 mot ou nombre)",
  "hint": "indice sur où chercher dans la sortie",
  "explanation": "ce qu'il fallait identifier et pourquoi c'est important"
}

RÈGLES : réponse = 1 mot ou nombre, fakeOutput = vraie syntaxe Linux, langue française.`
}

/* ─── prompt for FIX exercise (simplified) ─── */
export function buildFixPrompt(c: Cursus, l: Lesson): string {
  return `Tu es un formateur Linux. Génère un exercice FIX pour la leçon "${l.t}" (module ${c.label}).
L'étudiant voit une commande incorrecte (erreur de flag, argument manquant, option absente) et doit la corriger.

EXEMPLE de ce qui est attendu :
broken: "chmod 777 /etc/passwd"
fixed:  "chmod 644 /etc/passwd"
error_output: "Dangerous permissions set on sensitive file"

Réponds UNIQUEMENT avec ce JSON valide (rien d'autre) :
{
  "type": "fix",
  "broken": "la commande avec l'erreur (option incorrecte ou argument manquant)",
  "fixed": "la commande corrigée — DIFFÉRENTE de broken, la vraie correction",
  "error_output": "message d'erreur ou avertissement (3-4 lignes réalistes)",
  "hint": "quel aspect corriger (sans révéler la solution)",
  "explanation": "pourquoi broken était incorrect et pourquoi fixed fonctionne"
}

RÈGLES : fixed DOIT être différent de broken. L'erreur doit être liée à "${l.t}". Langue française.`
}

/* ─── parse the plain-text lesson output ─── */
export function parseLessonText(raw: string): LessonStream {
  const conceptMatch = raw.match(/CONCEPT:\s*\n([\s\S]*?)(?=\nCODE:|$)/)
  const codeMatch    = raw.match(/CODE:\s*\n([\s\S]*?)(?=\nSITUATION:|$)/)
  const situMatch    = raw.match(/SITUATION:\s*\n([\s\S]*)/)

  const conceptLines = (conceptMatch?.[1] ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  const rawCode = (codeMatch?.[1] ?? '').trim()
  const code    = rawCode.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim()
  const situation = (situMatch?.[1] ?? '').trim().split('\n').filter(Boolean).join(' ')

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

/* ─── generate quiz at runtime (fallback when no content file) ─── */
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
