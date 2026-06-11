import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST ?? 'mail.infomaniak.com',
  port:   parseInt(process.env.SMTP_PORT ?? '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.MAIL_FROM ?? 'SŌVR Academy <contact@sovr.fr>'
const BASE = process.env.NEXTAUTH_URL ?? 'https://academy.sovr.fr'

interface MailOpts { to: string; subject: string; text: string; html?: string }

export async function sendMail(opts: MailOpts) {
  await transporter.sendMail({ from: FROM, ...opts })
}

export async function sendWelcomeEmail(username: string, email: string) {
  await sendMail({
    to: email,
    subject: 'Bienvenue sur SŌVR Academy',
    text: [
      `Bienvenue, ${username}.`,
      '',
      'Ton compte SŌVR Academy est actif.',
      `Accès : ${BASE}/login`,
      '',
      '-- SŌVR Academy',
    ].join('\n'),
    html: `<pre style="font-family:monospace;font-size:13px;line-height:1.6;color:#ccc;background:#0a0a0a;padding:24px;border-radius:6px;">` +
      `[  <span style="color:#5af78e">OK</span>  ] Bienvenue, <b style="color:#fff">${username}</b>.\n\n` +
      `Ton compte SŌVR Academy est actif.\n` +
      `Accès : <a href="${BASE}/login" style="color:#5af78e">${BASE}/login</a>\n\n` +
      `-- SŌVR Academy</pre>`,
  })
}

export async function sendRegistrationNotice(username: string, email: string | null) {
  await sendMail({
    to: 'contact@sovr.fr',
    subject: `[Academy] Nouvelle inscription — ${username}`,
    text: [
      `Nouvelle inscription SŌVR Academy`,
      `pseudo : ${username}`,
      `email  : ${email ?? '(aucun)'}`,
      `date   : ${new Date().toISOString()}`,
    ].join('\n'),
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${BASE}/reset?token=${token}`
  await sendMail({
    to: email,
    subject: 'Réinitialisation de mot de passe — SŌVR Academy',
    text: [
      'Réinitialisation de mot de passe SŌVR Academy.',
      '',
      `Lien (valable 1h) : ${link}`,
      '',
      'Si tu n\'es pas à l\'origine de cette demande, ignore cet email.',
      '',
      '-- SŌVR Academy',
    ].join('\n'),
    html: `<pre style="font-family:monospace;font-size:13px;line-height:1.6;color:#ccc;background:#0a0a0a;padding:24px;border-radius:6px;">` +
      `Réinitialisation de mot de passe SŌVR Academy.\n\n` +
      `Lien (valable 1h) :\n<a href="${link}" style="color:#5af78e">${link}</a>\n\n` +
      `Si tu n'es pas à l'origine de cette demande, ignore cet email.\n\n` +
      `-- SŌVR Academy</pre>`,
  })
}
