'use client'
import { useEffect, useRef, useState } from 'react'
import { FakeFSEngine } from '@/lib/fakefs'
import type { ExerciseContent, ExerciseCmdHandler, ExerciseCmdResult } from '@/lib/exercise'
import QCM from './QCM'

interface Props {
  exercise: ExerciseContent
  cid: string
  lid: string
  lessonXP: number
  onGainXP: (n: number) => void
  onComplete: (cid: string, lid: string) => void
  scrollBottom: () => void
  onSetExerciseCmd: (handler: ExerciseCmdHandler | null) => void
}

const W = 54
const boxRow = (t: string) => '  │ ' + t + ' '.repeat(Math.max(0, W - t.length)) + '│'
const boxTop = () => '  ╭─' + '─'.repeat(W) + '╮'
const boxBot = () => '  ╰─' + '─'.repeat(W) + '╯'

export default function ExerciseEngine({ exercise, cid, lid, lessonXP, onGainXP, onComplete, scrollBottom, onSetExerciseCmd }: Props) {
  const { type = 'qcm', scenario, context, accept = [], hint, explanation, xp: exXP } = exercise
  const xpReward = exXP ?? Math.round(lessonXP / 3)

  const [done, setDone]         = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [hintUsed, setHintUsed] = useState(false)
  const [resultLines, setResultLines] = useState<React.ReactNode[]>([])

  const fsRef = useRef<FakeFSEngine | null>(null)
  const attemptsRef = useRef(0)
  const doneRef     = useRef(false)

  useEffect(() => {
    if (context?.fs) fsRef.current = new FakeFSEngine(context.fs)
  }, []) // eslint-disable-line

  const validate = (raw: string): boolean => {
    const normalized = raw.trim().replace(/\s+/g, ' ')
    return accept.some(pattern => {
      try { return new RegExp(pattern).test(normalized) } catch { return false }
    })
  }

  const handleCmd = (raw: string): ExerciseCmdResult => {
    if (doneRef.current) return { lines: [], done: true }
    const low = raw.trim().toLowerCase()

    /* hint */
    if (low === 'hint') {
      setHintUsed(true)
      return {
        lines: hint
          ? [<span key="hint" className="ln pre c-dim">{'  # ' + hint}</span>]
          : [<span key="hint" className="ln pre c-dim">{'  # aucun indice disponible'}</span>],
        done: false,
      }
    }

    /* flag type: submit SOVR{...} */
    if (type === 'flag' && low.startsWith('submit ')) {
      const submitted = raw.slice(7).trim()
      const correct = validate(submitted)
      if (correct) {
        doneRef.current = true
        setDone(true)
        onGainXP(xpReward)
        onComplete(cid, lid)
        const lines: React.ReactNode[] = [
          <span key="ok" className="ln pre c-grn">{'  ✓ Flag validé ! +' + xpReward + ' xp'}</span>,
        ]
        if (explanation) lines.push(<span key="exp" className="ln pre c-dim">{'  ℹ  ' + explanation}</span>)
        return { lines, done: true }
      }
      return {
        lines: [<span key="ko" className="ln pre c-red">{'  ✗ Flag incorrect'}</span>],
        done: false,
      }
    }

    /* fakefs routing (for flag & cmd with fs context) */
    if (fsRef.current && type !== 'analyze' && type !== 'fix') {
      const output = fsRef.current.exec(raw)
      return {
        lines: output ? [<span key="fs" className="ln pre" style={{ color: '#bbb' }}>{output}</span>] : [],
        done: false,
      }
    }

    /* cmd / fix / analyze: validate against accept patterns */
    const correct = validate(raw)
    attemptsRef.current++
    setAttempts(a => a + 1)

    if (correct) {
      doneRef.current = true
      setDone(true)
      onGainXP(xpReward)
      onComplete(cid, lid)
      const lines: React.ReactNode[] = [
        <span key="ok" className="ln pre c-grn">{'  ✓ correct  +' + xpReward + ' xp'}</span>,
      ]
      if (explanation) lines.push(<span key="exp" className="ln pre c-dim">{'  ℹ  ' + explanation}</span>)
      return { lines, done: true }
    }

    const lines: React.ReactNode[] = [
      <span key="ko" className="ln pre c-red">{'  ✗ bash: ' + raw + ': incorrect'}</span>,
    ]
    if (attemptsRef.current >= 2 && hint && !hintUsed) {
      lines.push(<span key="hh" className="ln pre c-dim">{'  ↳ tape  hint  pour un indice'}</span>)
    }
    return { lines, done: false }
  }

  /* register / unregister handler with page.tsx */
  useEffect(() => {
    if (type === 'qcm') return
    // stable ref trick so handler always reads latest state
    const handlerRef: ExerciseCmdHandler = (raw) => {
      const result = handleCmd(raw)
      if (result.lines.length) setResultLines(prev => [...prev, ...result.lines])
      if (result.done) { onSetExerciseCmd(null); setTimeout(scrollBottom, 50) }
      return result
    }
    onSetExerciseCmd(handlerRef)
    return () => onSetExerciseCmd(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  useEffect(() => { scrollBottom() }, [resultLines]) // eslint-disable-line

  /* ── QCM (rétrocompatibilité) ── */
  if (type === 'qcm') {
    if (!exercise.question || !exercise.options) return null
    return (
      <>
        <span className="ln pre">{' '}</span>
        <QCM
          header="QCM — généré par IA"
          question={exercise.question}
          options={exercise.options}
          xpReward={xpReward}
          onComplete={gained => { onGainXP(gained); onComplete(cid, lid) }}
        />
        {exercise.explanation && (
          <span className="ln pre c-dim" style={{ paddingLeft: '8px' }}>{'  ℹ  ' + exercise.explanation}</span>
        )}
      </>
    )
  }

  /* ── Interactive exercise header ── */
  const typeLabel: Record<string, string> = {
    cmd:     'CMD — tape la commande',
    analyze: 'ANALYZE — lis et réponds',
    fix:     'FIX — corrige la commande',
    flag:    'FLAG — trouve et soumets',
  }

  return (
    <div>
      <span className="ln pre">{' '}</span>
      <span className="ln pre" style={{ color: '#ff79c6', fontWeight: 700 }}>{'  ◉ ' + (typeLabel[type] ?? type.toUpperCase())}</span>

      {scenario && (
        <>
          <span className="ln pre">{boxTop()}</span>
          {scenario.split('\n').map((l, i) => (
            <span key={i} className="ln pre" style={{ color: '#ccc' }}>{boxRow(l)}</span>
          ))}
          <span className="ln pre">{boxBot()}</span>
        </>
      )}

      {context?.fakeOutput && (
        <>
          <span className="ln pre c-dim">{'  $ ' + (type === 'analyze' ? '# sortie système' : '# contexte')}</span>
          <span className="ln pre" style={{
            color: '#f1fa8c', background: '#080808', display: 'block',
            padding: '4px 8px', borderLeft: '2px solid #333', margin: '3px 0',
            whiteSpace: 'pre',
          }}>
            {context.fakeOutput}
          </span>
        </>
      )}

      {type === 'flag' && (
        <span className="ln pre c-dim">{'  ↳ commande de soumission : submit SOVR{...}'}</span>
      )}

      {!done && (
        <span className="ln pre" style={{ color: '#555' }}>
          {'  ❯ '}
          <span style={{ color: '#3a3a3a' }}>
            {type === 'flag'
              ? 'explore le FS puis submit SOVR{...}'
              : type === 'analyze'
                ? 'réponds directement dans le prompt'
                : 'tape ta commande dans le prompt ci-dessous'}
          </span>
        </span>
      )}

      {/* Feedback lines from commands */}
      {resultLines}

      {done && (
        <span className="ln pre c-dim">{'  ─── exercice terminé ──────────────────────'}</span>
      )}
    </div>
  )
}
