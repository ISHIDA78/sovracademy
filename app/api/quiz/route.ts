import fs from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { CUR } from '@/lib/curriculum'
import { generateQuiz, getCachedLesson } from '@/lib/ollama'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'quizzes')

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cid = searchParams.get('cid')
  const lid = searchParams.get('lid')

  const c = CUR.find(x => x.id === cid)
  const l = c?.lessons.find(x => x.id === lid)
  if (!c || !l) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fichier pré-généré (priorité absolue)
  const contentFile = path.join(CONTENT_DIR, `${lid}.json`)
  if (fs.existsSync(contentFile)) {
    const data = JSON.parse(fs.readFileSync(contentFile, 'utf-8'))
    return NextResponse.json(data)
  }

  const cached = getCachedLesson(`${cid}:${lid}`)
  const quiz = await generateQuiz(c, l, cached?.concept ?? [l.t])
  return NextResponse.json(quiz)
}
