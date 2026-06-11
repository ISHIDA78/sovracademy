import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/mailer'

export async function POST(req: Request) {
  const { identifier } = await req.json() as { identifier: string }
  const neutral = NextResponse.json({ ok: true }) // toujours neutre

  if (!identifier?.trim()) return neutral

  const id = identifier.trim().toLowerCase()

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: id }, { email: id }] },
  })

  // Réponse neutre même si user introuvable
  if (!user || !user.email) return neutral

  // Invalider les tokens existants
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

  // Créer token (32 bytes hex, hashé en base)
  const raw = crypto.randomBytes(32).toString('hex')
  const hashed = await bcrypt.hash(raw, 10)

  await prisma.passwordResetToken.create({
    data: {
      token: hashed,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    },
  })

  // Envoyer email avec le token brut (le lien contient le raw token)
  try {
    await sendPasswordResetEmail(user.email, raw)
  } catch (e) {
    console.error('[forgot-password] email error:', e)
  }

  return neutral
}
