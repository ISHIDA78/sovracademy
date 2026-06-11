'use client'
import { useEffect, useRef, useState } from 'react'
import { rank } from '@/lib/curriculum'

const BANNER_LINES = [
  '   ███████╗ ██████╗ ██╗   ██╗██████╗',
  '   ██╔════╝██╔═══██╗██║   ██║██╔══██╗      A C A D E M Y',
  '   ███████╗██║   ██║██║   ██║██████╔╝',
  '   ╚════██║██║   ██║╚██╗ ██╔╝██╔══██╗   white-hat formation',
  '   ███████║╚██████╔╝ ╚████╔╝ ██║  ██║      v0.1.0 // tty1',
  '   ╚══════╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝',
]
const NOISE = '▓▒░█▄▀▌▐╱╲╳┼╋01#@%&$'

interface BannerProps {
  user: string
  xp: number
  context: string
  onReady?: () => void
}

export default function Banner({ user, xp, context, onReady }: BannerProps) {
  const [rows, setRows] = useState<string[]>(BANNER_LINES.map(() => ''))
  const [done, setDone] = useState(false)
  const calledReady = useRef(false)

  useEffect(() => {
    let resolved = 0
    const maxLen = Math.max(...BANNER_LINES.map(l => l.length))
    const SPEED = 2
    const FRAME = 18

    const tick = () => {
      if (resolved >= maxLen) {
        setRows([...BANNER_LINES])
        setDone(true)
        if (!calledReady.current) { calledReady.current = true; onReady?.() }
        return
      }
      setRows(BANNER_LINES.map(line => {
        let out = ''
        for (let c = 0; c < line.length; c++) {
          const ch = line[c]
          if (c < resolved || ch === ' ') out += ch
          else if (c < resolved + 6) out += NOISE[(Math.random() * NOISE.length) | 0]
          else out += ' '
        }
        return out
      }))
      resolved += SPEED
      setTimeout(tick, FRAME)
    }
    tick()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLine = done
    ? `   ──[ ${user} @ ${context} ]──[ ${xp} xp · ${rank(xp)} ]──`
    : ''

  return (
    <div className="app-banner">
      {rows.map((row, i) => (
        <span key={i} className="ln pre c-grn">{row}</span>
      ))}
      <span className="ln pre c-dim">{statusLine}</span>
    </div>
  )
}
