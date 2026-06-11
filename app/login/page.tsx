'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Phase =
  | 'booting'
  | 'login'
  | 'password'
  | 'reg_user'
  | 'reg_pass'
  | 'reg_confirm'
  | 'reg_email'
  | 'forgot_input'
  | 'authenticating'
  | 'done'

interface Line { text: string; cls?: string }

const KERNEL_LINES: Line[] = [
  { text: '' },
  { text: 'Linux version 6.14.6-arch1-1 (gcc 14.2.1) #1 SMP PREEMPT_DYNAMIC', cls: 'c-dim' },
  { text: '[    0.004388] ACPI: RSDP 0x00000000000F05B0 000024 (v02 BOCHS)', cls: 'c-dim' },
  { text: '[    0.039817] NET: Registered PF_INET6 protocol family', cls: 'c-dim' },
  { text: '[    0.058994] Freeing unused kernel image memory: 392K', cls: 'c-dim' },
  { text: '[    0.061203] EXT4-fs (sda3): mounted filesystem with ordered data mode', cls: 'c-gry' },
  { text: '[    0.155880] systemd[1]: systemd 256.7-1-arch running in system mode', cls: 'c-dim' },
  { text: '[    0.162004] systemd[1]: Hostname set to <sovr-academy>.', cls: 'c-dim' },
  { text: '[    0.301244] systemd[1]: Reached target Local File Systems.', cls: 'c-gry' },
  { text: '[    0.321003] systemd[1]: Started OpenSSH Daemon.', cls: 'c-gry' },
  { text: '[    0.327444] systemd[1]: Reached target Multi-User System.', cls: 'c-gry' },
  { text: '' },
  { text: 'Arch Linux 6.14.6-arch1-1 (tty1)', cls: 'c-wht' },
  { text: '' },
]

const DELAYS = [0, 30, 25, 25, 30, 40, 35, 30, 50, 40, 50, 60, 80, 100]

export default function LoginPage() {
  const router = useRouter()
  const [lines, setLines]       = useState<Line[]>([])
  const [phase, setPhase]       = useState<Phase>('booting')
  const [inputVal, setInputVal] = useState('')
  const [username, setUsername] = useState('')
  const [newUser, setNewUser]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [newEmail, setNewEmail] = useState('')
  const inputRef  = useRef<HTMLInputElement>(null)
  const bootDone  = useRef(false)

  /* ── boot animation ── */
  useEffect(() => {
    if (bootDone.current) return
    bootDone.current = true
    let acc = 0
    KERNEL_LINES.forEach((l, i) => {
      acc += DELAYS[i] ?? 30
      setTimeout(() => {
        setLines(prev => [...prev, l])
        if (i === KERNEL_LINES.length - 1) {
          setTimeout(() => {
            setPhase('login')
            setTimeout(() => inputRef.current?.focus(), 50)
          }, 120)
        }
      }, acc)
    })
  }, [])

  const addLine = useCallback((text: string, cls?: string) =>
    setLines(prev => [...prev, { text: text || ' ', cls }]), [])

  const handleKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const val = inputVal.trim()

    /* ── login ── */
    if (phase === 'login') {
      addLine('sovr-academy login: ' + val)
      setInputVal('')
      if (val === '00') {
        addLine('')
        addLine('  → Création de compte', 'c-blu')
        addLine('')
        setPhase('reg_user')
      } else if (val === '101') {
        addLine('')
        addLine('  → Mot de passe oublié', 'c-blu')
        addLine('  Pseudo ou email du compte :', 'c-dim')
        addLine('')
        setPhase('forgot_input')
      } else if (val === '010') {
        addLine('  [*] Opening https://sovr.fr ...', 'c-dim')
        window.open('https://sovr.fr', '_blank', 'noopener')
        setInputVal('')
        setPhase('login')
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        setUsername(val.toLowerCase())
        setPhase('password')
      }
      return
    }

    /* ── forgot password ── */
    if (phase === 'forgot_input') {
      addLine('  Pseudo / email : ' + val)
      setInputVal('')
      setPhase('authenticating')
      addLine('  [*] Envoi en cours...', 'c-dim')
      try {
        await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: val }),
        })
      } catch { /* ignore */ }
      addLine('')
      addLine('  Si un compte correspond, un email a été envoyé.', 'c-gry')
      addLine('')
      setPhase('login')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    /* ── login password ── */
    if (phase === 'password') {
      addLine('Password:')
      setInputVal('')
      setPhase('authenticating')
      const res = await signIn('credentials', { username, password: val, redirect: false })
      if (res?.ok) {
        addLine('')
        addLine('Last login: ' + new Date().toUTCString() + ' on tty1', 'c-dim')
        addLine('')
        setPhase('done')
        setTimeout(() => router.push('/app'), 500)
      } else {
        addLine('')
        addLine('Login incorrect.', 'c-red')
        addLine('')
        setPhase('login')
        setUsername('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      return
    }

    /* ── register: username ── */
    if (phase === 'reg_user') {
      if (!val || val.length < 3) {
        addLine('  ✗ Pseudo minimum 3 caractères.', 'c-red')
        setInputVal('')
        return
      }
      if (!/^[a-z0-9_-]+$/.test(val)) {
        addLine('  New username: ' + val)
        addLine('  ✗ Lettres minuscules, chiffres, _ ou - uniquement.', 'c-red')
        setInputVal('')
        return
      }
      addLine('  New username: ' + val)
      setNewUser(val)
      setInputVal('')
      setPhase('reg_pass')
      return
    }

    /* ── register: password ── */
    if (phase === 'reg_pass') {
      if (!val || val.length < 6) {
        addLine('  New password:')
        addLine('  ✗ Mot de passe minimum 6 caractères.', 'c-red')
        setInputVal('')
        return
      }
      addLine('  New password:')
      setNewPass(val)
      setInputVal('')
      setPhase('reg_confirm')
      return
    }

    /* ── register: confirm password ── */
    if (phase === 'reg_confirm') {
      addLine('  Confirm password:')
      if (val !== newPass) {
        addLine('  ✗ Les mots de passe ne correspondent pas.', 'c-red')
        addLine('')
        setInputVal('')
        setNewPass('')
        setPhase('reg_pass')
        return
      }
      addLine('')
      addLine('  Email (récupération de compte, optionnel — Entrée pour ignorer) :', 'c-dim')
      setInputVal('')
      setPhase('reg_email')
      return
    }

    /* ── register: email (optional) ── */
    if (phase === 'reg_email') {
      const email = val.toLowerCase()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        addLine('  Email: ' + val)
        addLine('  ✗ Format invalide. Réessaie ou Entrée pour ignorer.', 'c-red')
        setInputVal('')
        return
      }
      addLine(email ? '  Email: ' + email : '  Email: (ignoré)')
      setNewEmail(email)
      setInputVal('')
      setPhase('authenticating')
      addLine('')
      addLine('  [*] Création du compte...', 'c-blu')

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser, password: newPass, email: email || undefined }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }

      if (data.ok) {
        addLine('  [✓] Compte créé.', 'c-grn')
        addLine('  [*] Connexion automatique...', 'c-dim')
        const signRes = await signIn('credentials', { username: newUser, password: newPass, redirect: false })
        if (signRes?.ok) {
          addLine('')
          setPhase('done')
          setTimeout(() => router.push('/app'), 600)
        } else {
          addLine('  ✗ Connexion échouée — réessaie manuellement.', 'c-red')
          setPhase('login')
          setTimeout(() => inputRef.current?.focus(), 50)
        }
      } else {
        addLine('  ✗ ' + (data.error ?? 'Erreur serveur.'), 'c-red')
        addLine('')
        setNewUser(''); setNewPass(''); setNewEmail('')
        setPhase('reg_user')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      return
    }
  }

  const label: string =
    phase === 'login'         ? 'sovr-academy login: '
    : phase === 'password'    ? 'Password: '
    : phase === 'reg_user'    ? '  New username: '
    : phase === 'reg_pass'    ? '  New password: '
    : phase === 'reg_confirm' ? '  Confirm password: '
    : phase === 'reg_email'   ? '  Email: '
    : phase === 'forgot_input'? '  Pseudo / email : '
    : ''

  const masked = phase === 'password' || phase === 'reg_pass' || phase === 'reg_confirm'
  const active = phase !== 'authenticating' && phase !== 'booting' && phase !== 'done'

  const hint: string | null =
    phase === 'login'         ? '  ╌╌  00 créer un compte · 101 mdp oublié · 010 sovr.fr  ╌╌'
    : phase === 'reg_user'    ? '  minuscules, chiffres, _ ou -  (3–24 chars)'
    : phase === 'reg_pass'    ? '  minimum 6 caractères'
    : phase === 'reg_email'   ? '  optionnel — Entrée pour passer'
    : phase === 'forgot_input'? '  pseudo ou adresse email du compte'
    : null

  void newEmail // used in fetch body

  return (
    <div className="tty-screen">
      <span id="tty-rows">
        {lines.map((l, i) => (
          <span key={i} className={`ln${l.cls ? ' ' + l.cls : ''}`}>{l.text || ' '}</span>
        ))}
      </span>

      {active && (
        <div className="irow">
          <span className="ilbl">{label}</span>
          <input
            ref={inputRef}
            className={`iinp${masked ? ' mask' : ''}`}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
      )}

      {hint && (
        <div style={{ marginTop: '6px', color: '#3a3a3a', fontSize: '11px', fontFamily: 'inherit', letterSpacing: '0.5px' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
