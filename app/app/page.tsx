'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import Banner from '@/components/Banner'
import DynamicLesson from '@/components/DynamicLesson'
import { CUR, unlocked, rank } from '@/lib/curriculum'
import type { ExerciseCmdHandler } from '@/lib/exercise'

/* ─── types ─── */
interface Item { id: number; node: React.ReactNode }
interface S { xp: number; done: Record<string, boolean>; cursus: string | null; lesson: string | null }

/* ─── cd aliases for fuzzy domain switching ─── */
const CD_ALIASES: Record<string, string> = {
  // c0 — Linux & Terminal
  linux: 'c0', terminal: 'c0', bash: 'c0', shell: 'c0', systemd: 'c0',
  filesystem: 'c0', permissions: 'c0', grep: 'c0', find: 'c0',
  // c1 — Scripting & Automatisation
  scripting: 'c1', script: 'c1', cron: 'c1', awk: 'c1', sed: 'c1', automatisation: 'c1',
  // c2 — Réseaux
  reseau: 'c2', reseaux: 'c2', network: 'c2', networking: 'c2',
  grpc: 'c2', bgp: 'c2', dns: 'c2', ip: 'c2', tcp: 'c2', vpn: 'c2',
  // c3 — Cryptographie
  crypto: 'c3', cryptographie: 'c3', cryptography: 'c3', tls: 'c3', aes: 'c3', rsa: 'c3',
  // c4 — Théorie OS
  os: 'c4', kernel: 'c4', theorie: 'c4', scheduler: 'c4', syscall: 'c4',
  processus: 'c4', threads: 'c4', ipc: 'c4', memoire: 'c4',
  // c5 — Architecture CPU
  cpu: 'c5', archi: 'c5', architecture: 'c5', registers: 'c5', alu: 'c5', pipeline: 'c5',
  // c6 — Langages système
  rust: 'c6', c: 'c6', asm: 'c6', langages: 'c6', system: 'c6', elf: 'c6', assembly: 'c6',
  // c7 — Sécurité (offensive + défensive)
  secu: 'c7', security: 'c7', pentest: 'c7', offensif: 'c7', offensive: 'c7',
  exploit: 'c7', re: 'c7', forensics: 'c7', defensif: 'c7', defensive: 'c7',
  siem: 'c7', ids: 'c7', hardening: 'c7', conteneurs: 'c7',
  // cf — final
  whiteh: 'cf', final: 'cf', cert: 'cf', build: 'cf',
}

function resolveCd(arg: string): string | null {
  const low = arg.toLowerCase()
  if (low === '~' || low === '/') return null // main menu signal
  if (CUR.find(c => c.id === low)) return low
  if (CD_ALIASES[low]) return CD_ALIASES[low]
  // Fuzzy: partial match against cursus labels
  const match = CUR.find(c =>
    c.label.toLowerCase().includes(low) ||
    c.sub.toLowerCase().includes(low) ||
    c.id === low
  )
  return match?.id ?? null
}

/* ─── autocomplete ─── */
const GLOBAL_CMDS = ['ls', 'cd', 'start', 'next', 'back', 'b', 'score', 's', 'help', 'h', 'clear', 'exit', 'logout', 'poweroff', 'q']
const EXERCISE_CMDS = ['hint', 'submit']
const CD_TARGETS = ['..', '~', ...CUR.map(c => c.id),
  'cpu', 'os', 'linux', 'terminal', 'tmux', 'vim', 'crypto', 'reseau', 'rust', 'c', 'asm', 'offensive', 'defensive', 'final']

function getCompletions(input: string, inExercise = false): string[] {
  const trimmed = input.trimStart()
  const parts = trimmed.split(/\s+/)
  const cmds = inExercise ? [...GLOBAL_CMDS, ...EXERCISE_CMDS] : GLOBAL_CMDS
  if (parts.length === 1 && !trimmed.endsWith(' ')) {
    return cmds.filter(c => c.startsWith(parts[0])).slice(0, 8)
  }
  if (parts[0] === 'cd' && parts.length <= 2 && !trimmed.endsWith('  ')) {
    const prefix = parts[1] ?? ''
    return CD_TARGETS.filter(t => t.startsWith(prefix)).slice(0, 8)
  }
  return []
}

/* ─── box helpers ─── */
const W = 58
const ln_ = (n: number) => '─'.repeat(n - 2)
const boxTop  = () => '  ╭' + ln_(W) + '╮'
const boxBot  = () => '  ╰' + ln_(W) + '╯'
const boxSep  = () => '  ├' + ln_(W) + '┤'
const boxRow  = (t: string) => '  │' + t + ' '.repeat(Math.max(0, W - 2 - t.length)) + '│'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/* ═══════════════════════════════════════════════════════════ */
export default function AppPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [s, setS] = useState<S>({ xp: 0, done: {}, cursus: null, lesson: null })
  const [items, setItems] = useState<Item[]>([])
  const [cmdInput, setCmdInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [, setHistIdx] = useState(-1)
  const [, setInitPhase] = useState(true)
  const [bannerReady, setBannerReady] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [completions, setCompletions] = useState<string[]>([])
  const [compIdx, setCompIdx] = useState(-1)

  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const counter   = useRef(0)
  const exerciseCmdRef = useRef<ExerciseCmdHandler | null>(null)
  const setExerciseCmd = useCallback((h: ExerciseCmdHandler | null) => { exerciseCmdRef.current = h }, [])

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login') }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/progress').then(r => r.json()).then((data: { lessonId: string; xp: number }[]) => {
      const done: Record<string, boolean> = {}
      let totalXp = 0
      for (const p of data) { done[p.lessonId] = true; totalXp += p.xp }
      setS(prev => ({ ...prev, xp: totalXp, done }))
    }).catch(() => {})
  }, [status])

  const scrollBottom = useCallback(() => {
    setTimeout(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight }, 0)
  }, [])

  const mk = (node: React.ReactNode): Item => ({ id: counter.current++, node })
  const addItems  = useCallback((...nodes: React.ReactNode[]) => setItems(prev => [...prev, ...nodes.map(n => mk(n))]), [])
  const replaceItems = useCallback((...nodes: React.ReactNode[]) => setItems(nodes.map(n => mk(n))), [])

  const gainXP = useCallback((n: number) => setS(prev => ({ ...prev, xp: prev.xp + n })), [])
  const completeLesson = useCallback((cid: string, lid: string) => {
    setS(prev => {
      if (prev.done[lid]) return prev
      fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lid, xp: 0 }) }).catch(() => {})
      return { ...prev, done: { ...prev.done, [lid]: true } }
    })
  }, [])

  /* ─── render main menu ─── */
  const renderMainMenu = useCallback((st: S) => {
    const ns = { ...st, cursus: null, lesson: null }
    setS(ns)
    const totalDone  = Object.keys(ns.done).length
    const totalLess  = CUR.reduce((a, c) => a + c.lessons.length, 0)
    const globalPct  = Math.round(totalDone / totalLess * 100)
    const nodes: React.ReactNode[] = [
      <span key="bt"  className="ln pre box">{boxTop()}</span>,
      <span key="bmt" className="ln pre box">
        {'  │ '}<span className="c-grn" style={{ fontWeight: 700 }}>SŌVR ACADEMY</span>
        <span className="c-dim">{'  —  '}</span>
        <span className="c-wht">{'white-hat curriculum'}</span>
        {' '.repeat(Math.max(0, W - 4 - 13 - 5 - 20)) + '│'}
      </span>,
      <span key="bm0" className="ln pre box">{boxRow('  ' + (session?.user?.name ?? 'user') + '@sovr  ·  ' + ns.xp + ' xp  ·  ' + rank(ns.xp) + '  ·  ' + globalPct + '% global')}</span>,
      <span key="bm"  className="ln pre box">{boxSep()}</span>,
    ]
    for (let i = 0; i < CUR.length; i++) {
      const c = CUR[i]
      const dc = c.lessons.filter(l => ns.done[l.id]).length
      const ul = unlocked(c.id, ns.done)
      const comp = dc === c.lessons.length
      const num = c.final ? ' F' : String(i).padStart(2)
      const pct  = Math.round(dc / c.lessons.length * 100)
      const bar  = (() => {
        const w = 8
        const filled = Math.round(pct / 100 * w)
        return '[' + '█'.repeat(filled) + '░'.repeat(w - filled) + ']'
      })()
      const prog = comp ? ' DONE ' : ul ? bar : ' LOCK '
      const label = c.label.padEnd(24).substring(0, 24)
      nodes.push(
        <span key={'r' + i} className="ln pre box">
          {'  │ '}<span className="c-yel" style={{ fontWeight: 700 }}>{num}</span>
          {')  '}<span style={{ color: comp ? '#5af78e' : ul ? '#e2e2e2' : '#444' }}>{label}</span>
          {'  '}<span style={{ color: comp ? '#5af78e' : ul ? '#6272a4' : '#333', fontSize: '0.85em' }}>{prog}</span>
          {' '.repeat(Math.max(0, W - 2 - (3 + 2 + 3 + label.length + 2 + prog.length))) + '│'}
        </span>
      )
    }
    nodes.push(
      <span key="bs2" className="ln pre box">{boxSep()}</span>,
      <span key="bh"  className="ln pre box">
        {'  │  '}<span className="c-yel">h</span>{') aide  '}
        <span className="c-yel">s</span>{') score  '}
        <span className="c-yel">q</span>{') quitter  '}
        <span className="c-dim">{'cd <domaine>  poweroff'}</span>
        {' '.repeat(Math.max(0, W - 2 - 50)) + '│'}
      </span>,
      <span key="bb"  className="ln pre box">{boxBot()}</span>,
      <span key="nl"  className="ln pre">{' '}</span>,
      <span key="hi"  className="ln pre c-dim">{'  ┌─ Tape un numéro pour entrer dans le bloc correspondant'}</span>,
      <span key="hi2" className="ln pre c-dim">{'  └─ ou cd <domaine>  ·  ex: cd crypto, cd rust, cd linux'}</span>,
      <span key="nl2" className="ln pre">{' '}</span>,
    )
    replaceItems(...nodes)
    scrollBottom()
  }, [replaceItems, scrollBottom, session])

  /* ─── render cursus menu ─── */
  const renderCursusMenu = useCallback((cid: string, st: S) => {
    const ns = { ...st, cursus: cid, lesson: null }
    setS(ns)
    const c = CUR.find(x => x.id === cid)!
    const nodes: React.ReactNode[] = [
      <span key="bt"  className="ln pre box">{boxTop()}</span>,
      <span key="bmt" className="ln pre box">
        {'  │ '}<span className="c-wht" style={{ fontWeight: 700 }}>{c.id.toUpperCase() + ' — ' + c.label.toUpperCase()}</span>
        {' '.repeat(Math.max(0, W - 3 - c.id.length - 3 - c.label.length)) + '│'}
      </span>,
      <span key="bm"  className="ln pre box">{boxSep()}</span>,
      <span key="sub" className="ln pre box">{boxRow('  ' + c.sub)}</span>,
      <span key="cer" className="ln pre box">{boxRow('  Certif: ' + c.cert)}</span>,
      <span key="bs"  className="ln pre box">{boxSep()}</span>,
    ]
    for (let i = 0; i < c.lessons.length; i++) {
      const l = c.lessons[i]
      const done = !!ns.done[l.id]
      const lock = i > 0 && !ns.done[c.lessons[i - 1].id]
      const mark = done ? '[✓]' : lock ? '[✗]' : '[ ]'
      const numStr = String(i).padStart(2)
      const label = l.t.padEnd(30).substring(0, 30)
      const xpStr = '+' + l.xp
      nodes.push(
        <span key={'lr' + i} className="ln pre box">
          {'  │ '}<span className="c-yel" style={{ fontWeight: 700 }}>{numStr}</span>
          {') ' + mark + ' '}
          <span style={{ color: done ? '#5af78e' : lock ? '#555' : '#c8c8c8' }}>{label}</span>
          {'  '}<span className="c-dim">{xpStr}</span>
          {' '.repeat(Math.max(0, W - 2 - (3 + 2 + 2 + 3 + 1 + label.length + 2 + xpStr.length))) + '│'}
        </span>
      )
    }
    const earned = c.lessons.filter(l => ns.done[l.id]).reduce((acc, l) => acc + l.xp, 0)
    const tot    = c.lessons.reduce((acc, l) => acc + l.xp, 0)
    nodes.push(
      <span key="bs2" className="ln pre box">{boxSep()}</span>,
      <span key="prg" className="ln pre box">{boxRow('  Progression: ' + earned + '/' + tot + ' xp  |  ' + c.lessons.filter(l => ns.done[l.id]).length + '/' + c.lessons.length + ' leçons')}</span>,
      <span key="bck" className="ln pre box">
        {'  │  '}<span className="c-yel" style={{ fontWeight: 700 }}>b</span>
        {') retour  '}
        <span className="c-yel" style={{ fontWeight: 700 }}>{'cd <domaine>'}</span>
        {' changer de module' + ' '.repeat(Math.max(0, W - 2 - 42)) + '│'}
      </span>,
      <span key="bbt" className="ln pre box">{boxBot()}</span>,
      <span key="nl"  className="ln pre">{' '}</span>,
      <span key="hi"  className="ln pre c-dim">{'  ┌─ Tape un numéro [00–' + String(c.lessons.length - 1).padStart(2, '0') + '] pour lancer la leçon'}</span>,
      <span key="hi2" className="ln pre c-dim">{'  └─ '}<span className="c-yel">start</span>{' prochaine non faite  ·  '}<span className="c-yel">b</span>{' retour  ·  '}<span className="c-yel">cd ~</span>{' menu'}</span>,
      <span key="nl2" className="ln pre">{' '}</span>,
    )
    replaceItems(...nodes)
    scrollBottom()
  }, [replaceItems, scrollBottom])

  /* ─── render lesson (dynamic via Ollama) ─── */
  const renderLesson = useCallback((cid: string, lid: string, st: S) => {
    const ns = { ...st, cursus: cid, lesson: lid }
    setS(ns)
    const c = CUR.find(x => x.id === cid)!
    const l = c.lessons.find(x => x.id === lid)!

    const node = (
      <>
        <span className="ln pre box">{boxTop()}</span>
        <span className="ln pre box">
          {'  │ '}<span className="c-wht" style={{ fontWeight: 700 }}>{c.id.toUpperCase() + ' :: ' + l.t}</span>
          {' '.repeat(Math.max(0, W - 3 - c.id.length - 4 - l.t.length)) + '│'}
        </span>
        <span className="ln pre box">{boxSep()}</span>
        <span className="ln pre box">{boxRow('  Difficulté ★★☆☆☆   ·   +' + l.xp + ' xp   ·   IA: llama3.2')}</span>
        <span className="ln pre box">{boxBot()}</span>
        <span className="ln pre">{' '}</span>
        <DynamicLesson
          cid={cid} lid={lid}
          xp={ns.xp}
          totalXP={l.xp}
          onGainXP={gainXP}
          onComplete={completeLesson}
          scrollBottom={scrollBottom}
          onSetExerciseCmd={setExerciseCmd}
        />
        <span className="ln pre">{' '}</span>
        <span className="ln pre">
          <span className="c-dim">{'  → '}</span>
          <span className="c-yel">next</span>
          <span className="c-dim">{' leçon suivante  '}</span>
          <span className="c-yel">b</span>
          <span className="c-dim">{' retour  '}</span>
          <span className="c-yel">{'cd <domaine>'}</span>
          <span className="c-dim">{' changer module'}</span>
        </span>
        <span className="ln pre">{' '}</span>
      </>
    )
    replaceItems(node)
    scrollBottom()
  }, [replaceItems, scrollBottom, gainXP, completeLesson])

  /* ─── init sequence ─── */
  const runInit = useCallback(async (st: S) => {
    const lines = [
      { t: '', cls: undefined, d: 20 },
      { t: '[*] Initializing sovr-academy environment...', cls: 'c-blu', d: 120 },
      { t: '[*] Checking dependencies................. [ OK ]', cls: 'c-gry', d: 90 },
      { t: '[*] Loading curriculum modules [9]........ [ OK ]', cls: 'c-gry', d: 90 },
      { t: '[*] Mounting progress database............ [ OK ]', cls: 'c-gry', d: 90 },
      { t: '[*] Connecting to Ollama (llama3.2)....... [ OK ]', cls: 'c-gry', d: 120 },
      { t: '', cls: undefined, d: 120 },
    ]
    for (const l of lines) {
      await sleep(l.d)
      addItems(<span className={`ln pre${l.cls ? ' ' + l.cls : ''}`}>{l.t || ' '}</span>)
      scrollBottom()
    }
    await sleep(120)
    addItems(
      <span className="ln pre c-dim">{'   ' + '─'.repeat(52)}</span>,
      <span className="ln pre c-wht">{'    Bienvenue, '}<span className="c-grn">{session?.user?.name ?? 'user'}</span>{'.  Session chiffrée établie.'}</span>,
      <span className="ln pre c-dim">{'   ' + '─'.repeat(52)}</span>,
      <span className="ln pre">{' '}</span>,
    )
    scrollBottom()
    await sleep(280)

    renderMainMenu(st)
    setInitPhase(false)
    setShowPrompt(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [addItems, scrollBottom, renderLesson, renderMainMenu, session])

  useEffect(() => {
    if (bannerReady && status === 'authenticated') runInit(s)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerReady, status])

  /* ─── command dispatch ─── */
  const dispatch = useCallback((raw: string, st: S) => {
    const low = raw.toLowerCase().trim()
    const parts = low.split(/\s+/)

    const echo = (
      <span key={'echo' + counter.current} className="ln pre">
        <span className="c-grn">{session?.user?.name ?? 'user'}</span>
        <span className="c-dim">@</span><span className="c-grn">academy</span>
        <span className="c-blu">{' ' + (st.lesson ? st.cursus + '/' + st.lesson : st.cursus ?? '~')}</span>
        <span className="c-mag"> ❯ </span>
        <span className="c-wht">{raw}</span>
      </span>
    )

    // ── Exercise mode: route command to active exercise handler ──
    if (exerciseCmdRef.current && low !== 'b' && low !== 'back' && low !== 'exit' && low !== 'logout' && low !== 'poweroff' && low !== 'quit' && low !== 'q') {
      const result = exerciseCmdRef.current(raw)
      addItems(echo, ...result.lines)
      if (result.done) exerciseCmdRef.current = null
      scrollBottom()
      return
    }

    // cd command (domain switch)
    if (parts[0] === 'cd') {
      const arg = parts[1]
      if (!arg || arg === '~' || arg === '/') { renderMainMenu(st); return }
      if (arg === '..') {
        if (st.lesson) { const ns = { ...st, lesson: null }; setS(ns); renderCursusMenu(st.cursus!, ns); return }
        if (st.cursus) { renderMainMenu(st); return }
        addItems(echo); scrollBottom(); return
      }
      const cid = resolveCd(arg)
      if (cid) {
        renderCursusMenu(cid, st); return
      }
      addItems(echo, <span key="nf" className="ln pre c-red">{'  cd: ' + arg + ': domaine inconnu  (ex: cd crypto, cd rust, cd linux)'}</span>)
      scrollBottom(); return
    }

    // main menu digit → cursus
    if (!st.cursus && /^[0-8]$/.test(low)) {
      const c = CUR[parseInt(low)]
      if (c && unlocked(c.id, st.done)) { renderCursusMenu(c.id, st); return }
      addItems(echo, <span key="e" className="ln pre c-red">{'  cursus verrouillé'}</span>); scrollBottom(); return
    }
    if (!st.cursus && low === 'f') {
      if (unlocked('cf', st.done)) { renderCursusMenu('cf', st); return }
      addItems(echo, <span key="e" className="ln pre c-red">{'  projet final verrouillé — termine les couches 0-7'}</span>); scrollBottom(); return
    }

    // cursus number → lesson (supports 0-99)
    if (st.cursus && !st.lesson && /^\d{1,2}$/.test(low)) {
      const c = CUR.find(x => x.id === st.cursus)
      const idx = parseInt(low, 10)
      if (c?.lessons[idx] !== undefined) {
        const locked = idx > 0 && !st.done[c.lessons[idx - 1].id]
        if (locked) { addItems(echo, <span key="e" className="ln pre c-red">{'  leçon ' + idx + ' verrouillée — termine la précédente d\'abord'}</span>); scrollBottom(); return }
        renderLesson(st.cursus, c.lessons[idx].id, st); return
      }
    }

    // text commands
    switch (low) {
      case 'h': case 'help':
        addItems(echo,
          <span key="h0" className="ln pre">{' '}</span>,
          <span key="h1" className="ln pre c-cyn">{'  Navigation :'}</span>,
          <span key="h2" className="ln pre c-gry">{'    [0-8/F]          sélectionner cursus/leçon'}</span>,
          <span key="h3" className="ln pre c-gry">{'    cd <domaine>      changer de domaine (crypto, rust, linux…)'}</span>,
          <span key="h4" className="ln pre c-gry">{'    cd ..             revenir en arrière'}</span>,
          <span key="h5" className="ln pre c-gry">{'    cd ~              menu principal'}</span>,
          <span key="h6" className="ln pre">{' '}</span>,
          <span key="h7" className="ln pre c-cyn">{'  Commandes :'}</span>,
          <span key="h8" className="ln pre c-gry">{'    ls / clear        afficher le menu courant'}</span>,
          <span key="h9" className="ln pre c-gry">{'    start             démarrer/reprendre la leçon'}</span>,
          <span key="h10" className="ln pre c-gry">{'    next              leçon suivante'}</span>,
          <span key="h11" className="ln pre c-gry">{'    b / back          retour'}</span>,
          <span key="h12" className="ln pre c-gry">{'    score / s         progression XP'}</span>,
          <span key="h13" className="ln pre c-gry">{'    exit              déconnecter'}</span>,
          <span key="h14" className="ln pre c-gry">{'    poweroff          éteindre'}</span>,
          <span key="h15" className="ln pre">{' '}</span>,
          <span key="h16" className="ln pre c-cyn">{'  Astuce :'}</span>,
          <span key="h17" className="ln pre c-gry">{'    Tab pour l\'autocomplétion des commandes'}</span>,
          <span key="h18" className="ln pre">{' '}</span>,
        )
        scrollBottom(); break

      case 'ls': case 'clear':
        if (st.lesson) renderLesson(st.cursus!, st.lesson, st)
        else if (st.cursus) renderCursusMenu(st.cursus, st)
        else renderMainMenu(st)
        break

      case 'b': case 'back':
        if (st.lesson) { const ns = { ...st, lesson: null }; setS(ns); renderCursusMenu(st.cursus!, ns) }
        else if (st.cursus) renderMainMenu(st)
        else { addItems(echo); scrollBottom() }
        break

      case 'start': {
        if (!st.cursus) { addItems(echo, <span key="e" className="ln pre c-dim">{"  → choisis un cursus d'abord"}</span>); scrollBottom(); break }
        const c = CUR.find(x => x.id === st.cursus)!
        const nl = c.lessons.find(l => !st.done[l.id])
        if (nl) renderLesson(st.cursus, nl.id, st)
        else { addItems(echo, <span key="e" className="ln pre c-grn">{'  ✓ cursus terminé'}</span>); scrollBottom() }
        break
      }

      case 'next': {
        const c = st.cursus ? CUR.find(x => x.id === st.cursus) : null
        if (!c) { addItems(echo); scrollBottom(); break }
        const nl = c.lessons.find(l => !st.done[l.id])
        if (nl) renderLesson(st.cursus!, nl.id, st)
        else { addItems(echo, <span key="e" className="ln pre c-grn">{'  ✓ tout est complété ici — '}<span className="c-yel">cd ~</span>{' pour choisir un autre module'}</span>); scrollBottom() }
        break
      }

      case 's': case 'score':
        addItems(echo,
          <span key="s0" className="ln pre">{' '}</span>,
          <span key="s1" className="ln pre c-wht">{'  user   : ' + (session?.user?.name ?? '?')}</span>,
          <span key="s2" className="ln pre c-wht">{'  xp     : ' + st.xp}</span>,
          <span key="s3" className="ln pre c-wht">{'  rang   : ' + rank(st.xp)}</span>,
          <span key="s4" className="ln pre c-wht">{'  leçons : ' + Object.keys(st.done).length + ' validées'}</span>,
          <span key="s5" className="ln pre">{' '}</span>,
        )
        scrollBottom(); break

      case 'exit': case 'logout': case 'q': case 'quit':
        doLogout(); break
      case 'poweroff': case 'shutdown': case 'halt':
        doPoweroff(addItems, scrollBottom); break

      case '1021':
        addItems(echo,
          <span key="fi0" className="ln pre">{' '}</span>,
          <span key="fi1" className="ln pre" style={{ color: '#ff5555', fontWeight: 700 }}>{'  ╔══════════════════════════════════════════════╗'}</span>,
          <span key="fi2" className="ln pre" style={{ color: '#ff5555', fontWeight: 700 }}>{'  ║            — FORBIDDEN ID —                 ║'}</span>,
          <span key="fi3" className="ln pre" style={{ color: '#ff5555', fontWeight: 700 }}>{'  ╚══════════════════════════════════════════════╝'}</span>,
          <span key="fi4" className="ln pre">{' '}</span>,
          <span key="fi5" className="ln pre c-dim">{'  Identifiant classifié.'}</span>,
          <span key="fi6" className="ln pre c-dim">{'  Niveau de clearance insuffisant pour ce terminal.'}</span>,
          <span key="fi7" className="ln pre c-dim">{'  Toute tentative d\'accès est journalisée.'}</span>,
          <span key="fi8" className="ln pre">{' '}</span>,
        )
        scrollBottom(); break

      default:
        addItems(echo, <span key="nf" className="ln pre c-red">{'  bash: ' + esc(raw) + ': command not found — h pour l\'aide  (Tab: autocomplétion)'}</span>)
        scrollBottom()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, addItems, scrollBottom, renderMainMenu, renderCursusMenu, renderLesson])

  const doLogout = async () => {
    setShowPrompt(false)
    addItems(
      <span key="lo1" className="ln pre">{' '}</span>,
      <span key="lo2" className="ln pre c-dim">{'  logout'}</span>,
      <span key="lo3" className="ln pre c-gry">{'  Saving session state... [ OK ]'}</span>,
    )
    scrollBottom()
    await sleep(700)
    await signOut({ callbackUrl: '/login' })
  }

  /* ─── keyboard handler ─── */
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault()
      const comps = getCompletions(cmdInput, !!exerciseCmdRef.current)
      if (comps.length === 0) { setCompletions([]); return }
      if (comps.length === 1) {
        const parts = cmdInput.trimStart().split(/\s+/)
        if (parts.length <= 1) setCmdInput(comps[0] + ' ')
        else setCmdInput(parts.slice(0, -1).join(' ') + ' ' + comps[0] + ' ')
        setCompletions([]); setCompIdx(-1); return
      }
      setCompletions(comps)
      const nextIdx = (compIdx + 1) % comps.length
      setCompIdx(nextIdx)
      const parts = cmdInput.trimStart().split(/\s+/)
      if (parts.length <= 1) setCmdInput(comps[nextIdx])
      else setCmdInput(parts.slice(0, -1).join(' ') + ' ' + comps[nextIdx])
      return
    }

    // Dismiss completions on Escape
    if (e.key === 'Escape') { setCompletions([]); setCompIdx(-1); return }

    // Arrow up/down: command history
    if (e.key === 'ArrowUp') {
      setHistIdx(prev => {
        const ni = Math.min(prev + 1, cmdHistory.length - 1)
        setCmdInput(cmdHistory[cmdHistory.length - 1 - ni] ?? '')
        return ni
      })
      e.preventDefault(); return
    }
    if (e.key === 'ArrowDown') {
      setHistIdx(prev => {
        const ni = Math.max(prev - 1, -1)
        setCmdInput(ni < 0 ? '' : (cmdHistory[cmdHistory.length - 1 - ni] ?? ''))
        return ni
      })
      e.preventDefault(); return
    }

    if (e.key !== 'Enter') {
      // Dismiss completions when typing (not Tab)
      if (completions.length > 0) { setCompletions([]); setCompIdx(-1) }
      return
    }

    // Enter: execute
    const raw = cmdInput.trim()
    if (!raw) return
    setCmdInput('')
    setHistIdx(-1)
    setCompletions([]); setCompIdx(-1)
    setCmdHistory(prev => [...prev, raw])
    setS(current => { dispatch(raw, current); return current })
  }

  // Focus input on any keydown in app
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!showPrompt) return
      const tag = (e.target as HTMLElement).tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && e.key.length === 1) inputRef.current?.focus()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showPrompt])

  const user = session?.user?.name ?? 'user'
  const ctx = s.lesson ? (s.cursus + '/' + s.lesson) : s.cursus ?? '~'

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ background: '#000', color: '#555', padding: '8px', fontFamily: 'monospace', fontSize: '13px' }}>connecting...</div>
  }

  return (
    <div className="app-shell">
      <Banner user={user} xp={s.xp} context={ctx} onReady={() => setBannerReady(true)} />
      <div ref={outputRef} className="app-output">
        {items.map(item => <div key={item.id}>{item.node}</div>)}
      </div>
      {showPrompt && (
        <div style={{ flexShrink: 0, background: '#000', borderTop: '1px solid #1c1c1c' }}>
          {/* Autocomplete suggestions */}
          {completions.length > 1 && (
            <div style={{ padding: '2px 8px', borderBottom: '1px solid #1a1a1a' }}>
              {completions.map((c, i) => (
                <span key={c} style={{
                  marginRight: '12px',
                  fontFamily: 'inherit', fontSize: '13px',
                  color: i === compIdx ? '#f1fa8c' : '#555',
                  fontWeight: i === compIdx ? 700 : 400,
                }}>
                  {c}
                </span>
              ))}
            </div>
          )}
          <div className="app-prompt">
            <span style={{ flexShrink: 0, whiteSpace: 'pre', fontFamily: 'inherit', fontSize: '13px' }}>
              <span className="c-grn">{user}</span>
              <span className="c-dim">@</span><span className="c-grn">academy</span>
              <span className="c-blu">{' ' + ctx}</span>
              <span className="c-mag"> ❯ </span>
            </span>
            <input
              ref={inputRef}
              className="cmd-input"
              type="text"
              value={cmdInput}
              onChange={e => { setCmdInput(e.target.value); setCompletions([]); setCompIdx(-1) }}
              onKeyDown={handleKey}
              autoComplete="off" spellCheck={false} autoCapitalize="off"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── poweroff ─── */
async function doPoweroff(addItems: (...nodes: React.ReactNode[]) => void, scrollBottom: () => void) {
  addItems(
    <span key="pw0" className="ln pre">{' '}</span>,
    <span key="pw1" className="ln pre c-yel">{'  Broadcast message from user@sovr-academy:'}</span>,
    <span key="pw2" className="ln pre c-yel">{'  The system is going down for poweroff NOW!'}</span>,
    <span key="pw3" className="ln pre">{' '}</span>,
  )
  scrollBottom()
  const steps = ['[  OK  ] Stopped target Multi-User System.', '[  OK  ] Stopped Ollama service.', '[  OK  ] Unmounted academy://fs.', '[  OK  ] Reached target Shutdown.', 'Powering off.']
  for (const st of steps) {
    await sleep(200 + Math.random() * 100)
    addItems(<span key={'s' + st} className={`ln pre ${st.startsWith('Powering') ? 'c-wht' : 'c-dim'}`}>{'  ' + st}</span>)
    scrollBottom()
  }
  await sleep(500)
  document.body.style.transition = 'opacity .6s'
  document.body.style.opacity = '0'
  await sleep(650)
  document.body.style.opacity = '1'
  document.body.style.transition = ''
  document.body.innerHTML = `
    <div style="position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;font-family:'JetBrains Mono',monospace;">
      <span style="color:#222;font-size:13px;letter-spacing:2px;">— système éteint —</span>
      <button id="pwrbtn"
        style="background:none;border:1px solid #333;color:#444;font-family:inherit;font-size:11px;letter-spacing:3px;padding:10px 28px;cursor:pointer;transition:all .3s;text-transform:uppercase;"
        onmouseover="this.style.borderColor='#0f0';this.style.color='#0f0';"
        onmouseout="this.style.borderColor='#333';this.style.color='#444';">
        ⏻ power on
      </button>
    </div>`
  document.getElementById('pwrbtn')!.addEventListener('click', () => {
    document.body.style.transition = 'opacity .4s'
    document.body.style.opacity = '0'
    setTimeout(() => { window.location.href = '/boot' }, 420)
  })
}
