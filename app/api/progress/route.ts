import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const progress = await prisma.progress.findMany({
    where: { userId: session.user.id },
    select: { lessonId: true, xp: true },
  })
  return NextResponse.json(progress)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lessonId, xp } = await req.json() as { lessonId: string; xp: number }
  if (!lessonId) return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 })

  await prisma.progress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    update: { xp },
    create: { userId: session.user.id, lessonId, xp },
  })
  return NextResponse.json({ ok: true })
}
