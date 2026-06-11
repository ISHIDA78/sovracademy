import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail, sendRegistrationNotice } from '@/lib/mailer'

export async function POST(req: Request) {
  const { username, password, email } = await req.json() as { username: string; password: string; email?: string }

  if (!username || username.length < 3 || username.length > 24)
    return NextResponse.json({ error: 'Pseudo 3–24 caractères.' }, { status: 400 })
  if (!/^[a-z0-9_-]+$/.test(username))
    return NextResponse.json({ error: 'Pseudo : lettres, chiffres, _ ou - uniquement.' }, { status: 400 })
  if (!password || password.length < 6)
    return NextResponse.json({ error: 'Mot de passe minimum 6 caractères.' }, { status: 400 })

  const normalEmail = email?.trim().toLowerCase() || null
  if (normalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail))
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing)
    return NextResponse.json({ error: 'Pseudo déjà pris.' }, { status: 409 })

  if (normalEmail) {
    const emailTaken = await prisma.user.findUnique({ where: { email: normalEmail } })
    if (emailTaken)
      return NextResponse.json({ error: 'Email déjà utilisé.' }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 10)
  await prisma.user.create({ data: { username, password: hash, email: normalEmail } })

  // Emails fire-and-forget — ne bloquent jamais l'inscription
  Promise.allSettled([
    normalEmail ? sendWelcomeEmail(username, normalEmail) : Promise.resolve(),
    sendRegistrationNotice(username, normalEmail),
  ]).catch(() => {})

  return NextResponse.json({ ok: true })
}
