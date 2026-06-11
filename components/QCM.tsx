'use client'
import { useState } from 'react'

interface Option {
  key: string
  label: string
  correct: boolean
}

interface QCMProps {
  header: string
  question: string
  options: Option[]
  xpReward: number
  onComplete: (xp: number) => void
}

export default function QCM({ header, question, options, xpReward, onComplete }: QCMProps) {
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const handleClick = (opt: Option) => {
    if (done) return
    setDone(true)
    if (opt.correct) {
      setResult('correct')
      onComplete(xpReward)
    } else {
      setResult('wrong')
    }
  }

  return (
    <div style={{ padding: '2px 0 2px 4px' }}>
      <span className="ln pre c-blu">  ◎ {header}</span>
      <span className="ln" style={{ color: '#8be9fd' }}>  ? {question}</span>
      {options.map((opt, i) => (
        <span
          key={opt.key}
          className={`opt${done ? ' done' : ''}`}
          style={{
            color: done
              ? opt.correct ? '#5af78e' : (result === 'wrong' && !opt.correct && i === options.findIndex(o => o.key === opt.key) ? '#ff5555' : '#444')
              : hoveredIdx === i ? '#fff' : '#777',
          }}
          onClick={() => handleClick(opt)}
          onMouseEnter={() => !done && setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {'    '}<span style={{ color: done ? (opt.correct ? '#5af78e' : '#444') : '#555' }}>{opt.key})</span> {opt.label}
        </span>
      ))}
      {result === 'correct' && (
        <span className="ln pre" style={{ paddingLeft: '6px', color: '#5af78e' }}>
          {'    '}✓ correct  <span style={{ color: '#444' }}>+{xpReward} xp</span>
        </span>
      )}
      {result === 'wrong' && (
        <span className="ln pre" style={{ paddingLeft: '6px' }}>
          <span className="c-red">{'    '}✗ incorrect</span>
          <span className="c-dim"> — relis la section</span>
        </span>
      )}
    </div>
  )
}
