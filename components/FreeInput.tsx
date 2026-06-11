'use client'
import { useState, useRef } from 'react'

interface FreeInputProps {
  header: string
  prompt: string
  placeholder: string
  hint: string
  pattern: RegExp
  expectedOutput: string
  xpReward: number
  onComplete: (xp: number) => void
}

export default function FreeInput({ header, prompt, placeholder, hint, pattern, expectedOutput, xpReward, onComplete }: FreeInputProps) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const submit = () => {
    const val = value.trim()
    if (!val) { setFeedback({ ok: false, msg: '> aucune commande' }); return }
    if (pattern.test(val)) {
      setFeedback({ ok: true, msg: '  ' + expectedOutput })
      setSubmitted(true)
      onComplete(xpReward)
    } else {
      setFeedback({ ok: false, msg: '  bash: ' + val + ': incorrect' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div style={{ paddingLeft: '6px', borderLeft: '2px solid ' + (submitted ? '#5af78e' : '#222'), margin: '3px 0 3px 4px' }}>
      <span className="ln pre c-blu">  ◎ {header}</span>
      <span className="ln" style={{ color: '#777', paddingLeft: '4px' }}>  {prompt}</span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0' }}>
        <span className="c-grn" style={{ flexShrink: 0 }}>$</span>
        <textarea
          ref={taRef}
          className="fi-wrap"
          rows={1}
          placeholder={placeholder}
          value={value}
          onChange={e => { setValue(e.target.value); resize(e.target) }}
          onKeyDown={handleKeyDown}
          disabled={submitted}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', caretColor: '#5af78e',
            fontFamily: 'inherit', fontSize: '13px', resize: 'none', minHeight: '18px',
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      {!submitted && (
        <div style={{ display: 'flex', gap: '12px', padding: '1px 0 3px 0' }}>
          <span style={{ color: '#444', cursor: 'pointer' }} onClick={() => setShowHint(true)}>hint</span>
          <span style={{ color: '#444', cursor: 'pointer' }} onClick={() => { setValue(''); setFeedback(null) }}>clear</span>
          <span className="c-grn" style={{ cursor: 'pointer', fontWeight: 700 }} onClick={submit}>[ submit ↵ ]</span>
        </div>
      )}
      {showHint && !submitted && (
        <span className="ln pre" style={{ color: '#444' }}>  # {hint}</span>
      )}
      {feedback && (
        <span className="ln pre" style={{ color: feedback.ok ? '#5af78e' : '#ff5555' }}>
          {feedback.msg}
          {feedback.ok && <span style={{ color: '#444' }}> +{xpReward} xp</span>}
        </span>
      )}
    </div>
  )
}
