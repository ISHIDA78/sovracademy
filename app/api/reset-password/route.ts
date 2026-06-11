import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { token, password } = await req.json() as { token: string; password: string }

  if (!token || !password || password.length < 6)
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 })

  // Chercher un token non expiré et non utilisé
  const records = await prisma.passwordResetToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  })

  // Comparer le token brut avec les hashes
  let matched: typeof records[0] | null = null
  for (const r of records) {
    const ok = await bcrypt.compare(token, r.token)
    if (ok) { matched = r; break }
  }

  if (!matched)
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 400 })

  const hash = await bcrypt.hash(password, 10)

  await prisma.$transaction([
    prisma.user.update({ where: { id: matched.userId }, data: { password: hash } }),
    prisma.passwordResetToken.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ ok: true })
}
