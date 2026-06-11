'use client'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type Phase = 'input' | 'confirm' | 'submitting' | 'done' | 'error'

interface Line { text: string; cls?: string }

function ResetForm() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get('token') ?? ''

  const [lines, setLines]   = useState<Line[]>([])
  const [phase, setPhase]   = useState<Phase>(token ? 'input' : 'error')
  const [input, setInput]   = useState('')
  const [pass1, setPass1]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addLine = useCallback((text: string, cls?: string) =>
    setLines(prev => [...prev, { text: text || ' ', cls }]), [])

  useEffect(() => {
    if (!token) {
      addLine('')
      addLine('  ✗ Lien invalide ou manquant.', 'c-red')
      addLine('')
      addLine('  Retourne sur /login → 101 pour une nouvelle demande.', 'c-dim')
      return
    }
    addLine('')
    addLine('  sovr-academy — Réinitialisation mot de passe', 'c-wht')
    addLine('  ─────────────────────────────────────────────', 'c-dim')
    addLine('')
    addLine('  Nouveau mot de passe (min. 6 caractères) :', 'c-dim')
    addLine('')
    setTimeout(() => inputRef.current?.focus(), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const val = input.trim()

    if (phase === 'input') {
      if (val.length < 6) {
        addLine('  New password:')
        addLine('  ✗ Minimum 6 caractères.', 'c-red')
        setInput('')
        return
      }
      addLine('  New password:')
      setPass1(val)
      setInput('')
      addLine('  Confirme le mot de passe :', 'c-dim')
      setPhase('confirm')
      return
    }

    if (phase === 'confirm') {
      addLine('  Confirm password:')
      if (val !== pass1) {
        addLine('  ✗ Les mots de passe ne correspondent pas.', 'c-red')
        addLine('')
        addLine('  Nouveau mot de passe :', 'c-dim')
        setInput('')
        setPass1('')
        setPhase('input')
        return
      }
      setInput('')
      setPhase('submitting')
      addLine('')
      addLine('  [*] Mise à jour en cours...', 'c-blu')

      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: pass1 }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }

        if (data.ok) {
          addLine('  [✓] Mot de passe mis à jour.', 'c-grn')
          addLine('  [*] Redirection vers le login...', 'c-dim')
          setPhase('done')
          setTimeout(() => router.push('/login'), 1500)
        } else {
          addLine('  ✗ ' + (data.error ?? 'Lien invalide ou expiré.'), 'c-red')
          setPhase('error')
        }
      } catch {
        addLine('  ✗ Erreur réseau.', 'c-red')
        setPhase('error')
      }
    }
  }

  const label =
    phase === 'input'   ? '  New password: '
    : phase === 'confirm' ? '  Confirm password: '
    : ''

  const active = phase === 'input' || phase === 'confirm'

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
            className="iinp mask"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}

      {phase === 'error' && token && (
        <div style={{ marginTop: '12px', color: '#3a3a3a', fontSize: '11px', fontFamily: 'inherit' }}>
          {'  ╌╌  retourner sur '}<a href="/login" style={{ color: '#555' }}>/login</a>{'  ╌╌'}
        </div>
      )}
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
