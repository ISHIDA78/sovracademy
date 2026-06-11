import fs from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { CUR } from '@/lib/curriculum'
import {
  OLLAMA_MODEL, buildConceptPrompt, parseLessonText,
  fallbackLesson, getCachedLesson, setCachedLesson, ollamaAvailable,
} from '@/lib/ollama'

const OLLAMA_URL  = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const CONTENT_DIR = path.join(process.cwd(), 'content', 'lessons')

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cid = searchParams.get('cid')
  const lid = searchParams.get('lid')
  const xp  = parseInt(searchParams.get('xp') ?? '0')

  const c = CUR.find(x => x.id === cid)
  const l = c?.lessons.find(x => x.id === lid)
  if (!c || !l) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 1. Fichier pré-généré (priorité absolue)
  const contentFile = path.join(CONTENT_DIR, `${lid}.json`)
  if (fs.existsSync(contentFile)) {
    const data = JSON.parse(fs.readFileSync(contentFile, 'utf-8'))
    return new Response(JSON.stringify({ cached: true, ...data }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Cache mémoire (session courante)
  const key = `${cid}:${lid}`
  const cached = getCachedLesson(key)
  if (cached) {
    return new Response(JSON.stringify({ cached: true, ...cached }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const available = await ollamaAvailable()
  if (!available) {
    const fb = fallbackLesson(c, l)
    return new Response(JSON.stringify({ cached: false, ...fb }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Stream from Ollama, accumulate, parse and cache
  const done = c.lessons.filter(l2 => false).length // will be computed per-user in future
  const prompt = buildConceptPrompt(c, l, xp, done, c.lessons.length)

  const encoder = new TextEncoder()
  let accumulated = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true }),
          signal: AbortSignal.timeout(40000),
        })

        if (!res.ok || !res.body) throw new Error('Ollama stream failed')

        const reader = res.body.getReader()
        const dec = new TextDecoder()

        while (true) {
          const { done: readerDone, value } = await reader.read()
          if (readerDone) break

          const chunk = dec.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (!line.trim()) continue
            try {
              const obj = JSON.parse(line) as { response?: string; done?: boolean }
              if (obj.response) {
                accumulated += obj.response
                // Stream raw token to client so it can be displayed in real-time
                controller.enqueue(encoder.encode(obj.response))
              }
              if (obj.done) break
            } catch { /* partial line */ }
          }
        }

        // Parse and cache the full result
        const parsed = parseLessonText(accumulated)
        setCachedLesson(key, parsed)

        // Send a final special marker with the parsed struct so client doesn't need to re-parse
        controller.enqueue(encoder.encode(`\n\x00PARSED:${JSON.stringify(parsed)}`))
      } catch (err) {
        const fb = fallbackLesson(c, l)
        setCachedLesson(key, fb)
        controller.enqueue(encoder.encode(`\n\x00PARSED:${JSON.stringify(fb)}`))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache',
    },
  })
}
