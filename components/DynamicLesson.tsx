'use client'
import { useEffect, useRef, useState } from 'react'
import ExerciseEngine from './ExerciseEngine'
import type { ExerciseContent, ExerciseCmdHandler } from '@/lib/exercise'

interface Props {
  cid: string
  lid: string
  xp: number
  totalXP: number
  onGainXP: (n: number) => void
  onComplete: (cid: string, lid: string) => void
  scrollBottom: () => void
  onSetExerciseCmd: (handler: ExerciseCmdHandler | null) => void
}

type Phase = 'fetching' | 'animating' | 'code' | 'situation' | 'quiz' | 'done'

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export default function DynamicLesson({ cid, lid, xp, totalXP, onGainXP, onComplete, scrollBottom, onSetExerciseCmd }: Props) {
  const [phase, setPhase]         = useState<Phase>('fetching')
  const [spinIdx, setSpinIdx]     = useState(0)
  const [elapsed, setElapsed]     = useState('0.0')
  const [conceptLines, setConceptLines] = useState<string[]>([])
  const [code, setCode]           = useState('')
  const [situation, setSituation] = useState('')
  const [exercise, setExercise]   = useState<ExerciseContent | null>(null)
  const [revealed, setRevealed]   = useState(0)
  const startRef  = useRef(Date.now())
  const animated  = useRef(false)
  const cancelled = useRef(false)

  /* spinner tick */
  useEffect(() => {
    if (phase !== 'fetching') return
    const id = setInterval(() => {
      setSpinIdx(i => (i + 1) % SPINNER.length)
      setElapsed(((Date.now() - startRef.current) / 1000).toFixed(1))
    }, 100)
    return () => clearInterval(id)
  }, [phase])

  /* fetch lesson (streaming) */
  useEffect(() => {
    cancelled.current = false
    startRef.current = Date.now()
    animated.current = false

    const run = async () => {
      try {
        const res = await fetch(`/api/lesson?cid=${cid}&lid=${lid}&xp=${xp}`)
        if (!res.ok) throw new Error('API error')

        if (res.headers.get('content-type')?.includes('application/json')) {
          const d = await res.json() as { concept: string[]; code: string; situation: string }
          if (!cancelled.current) { setConceptLines(d.concept); setCode(d.code); setSituation(d.situation) }
          return
        }

        const reader = res.body!.getReader()
        const dec = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || cancelled.current) break
          buf += dec.decode(value, { stream: true })

          const markerIdx = buf.indexOf('\x00PARSED:')
          if (markerIdx >= 0) {
            try {
              const parsed = JSON.parse(buf.slice(markerIdx + 8)) as { concept: string[]; code: string; situation: string }
              if (!cancelled.current) { setConceptLines(parsed.concept); setCode(parsed.code); setSituation(parsed.situation) }
            } catch { /* ignore partial */ }
            break
          }
        }
      } catch {
        if (!cancelled.current) {
          setConceptLines(['[Ollama] Impossible de générer le contenu — vérifie que ollama serve est lancé.'])
          setCode('')
          setSituation('')
        }
      }
    }

    run()
    return () => { cancelled.current = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, lid])

  /* start animation when conceptLines arrive */
  useEffect(() => {
    if (conceptLines.length === 0 || animated.current) return
    animated.current = true
    setPhase('animating')

    let i = 0
    const step = () => {
      if (cancelled.current) return
      setRevealed(i + 1)
      scrollBottom()
      i++
      if (i < conceptLines.length) {
        setTimeout(step, 90)
      } else {
        setTimeout(() => {
          if (cancelled.current) return
          setPhase('code'); scrollBottom()
          setTimeout(() => {
            if (cancelled.current) return
            setPhase('situation'); scrollBottom()
            setTimeout(() => { if (!cancelled.current) loadExercise() }, 400)
          }, 500)
        }, 150)
      }
    }
    step()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptLines])

  const loadExercise = async () => {
    try {
      const res = await fetch(`/api/quiz?cid=${cid}&lid=${lid}`)
      if (!res.ok) throw new Error()
      const data = await res.json() as ExerciseContent
      if (!cancelled.current) { setExercise(data); setPhase('quiz'); scrollBottom() }
    } catch {
      if (!cancelled.current) { setPhase('done'); scrollBottom() }
    }
  }

  const ready = phase !== 'fetching'

  return (
    <div>
      {/* ── Loading spinner ── */}
      {phase === 'fetching' && (
        <span className="ln pre c-blu">
          {'  [*] Chargement... '}
          <span className="c-grn">{SPINNER[spinIdx]}</span>
          <span className="c-dim">{' ' + elapsed + 's'}</span>
        </span>
      )}

      {/* ── Concept lines ── */}
      {ready && conceptLines.length > 0 && (
        <>
          <span className="ln pre c-cyn" style={{ fontWeight: 700 }}>{'  ▸ Concept'}</span>
          {conceptLines.slice(0, revealed).map((line, i) => (
            <span key={i} className="ln" style={{ color: '#bbb', paddingLeft: '4px' }}>{line}</span>
          ))}
          {phase === 'animating' && (
            <span className="ln pre c-grn" style={{ opacity: 0.5 }}>{'  ' + SPINNER[spinIdx % SPINNER.length]}</span>
          )}
        </>
      )}

      {/* ── Code block ── */}
      {(phase === 'code' || phase === 'situation' || phase === 'quiz' || phase === 'done') && code && (
        <>
          <span className="ln pre">{' '}</span>
          <span className="ln pre c-cyn" style={{ fontWeight: 700 }}>{'  ▸ Exemple'}</span>
          <span className="ln pre" style={{
            color: '#f1fa8c', background: '#080808', display: 'block',
            padding: '4px 8px', borderLeft: '2px solid #333', margin: '3px 0',
          }}>
            {code}
          </span>
        </>
      )}

      {/* ── Situation ── */}
      {(phase === 'situation' || phase === 'quiz' || phase === 'done') && situation && (
        <>
          <span className="ln pre">{' '}</span>
          <span className="ln pre c-yel">{'  ⚠  MISE EN SITUATION'}</span>
          <span className="ln" style={{ color: '#bbb', paddingLeft: '4px' }}>{situation}</span>
          <span className="ln pre c-dim">{'  ' + '─'.repeat(48)}</span>
        </>
      )}

      {/* ── Exercise loading ── */}
      {phase === 'situation' && (
        <span className="ln pre c-gry">{'  [*] Chargement exercice... '}<span className="c-grn">{SPINNER[spinIdx % SPINNER.length]}</span></span>
      )}

      {/* ── Exercise (QCM ou interactif) ── */}
      {(phase === 'quiz' || phase === 'done') && exercise && (
        <ExerciseEngine
          exercise={exercise}
          cid={cid}
          lid={lid}
          lessonXP={totalXP}
          onGainXP={onGainXP}
          onComplete={(c, l) => { onComplete(c, l); setPhase('done') }}
          scrollBottom={scrollBottom}
          onSetExerciseCmd={onSetExerciseCmd}
        />
      )}
    </div>
  )
}
