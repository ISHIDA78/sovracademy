export interface FSNode {
  type: 'file' | 'dir'
  content?: string
  hidden?: boolean
  perms?: string   // 9 chars e.g. "rwxr-xr-x"
  owner?: string
  size?: number
  children?: Record<string, FSNode>
}

export class FakeFSEngine {
  private root: FSNode
  private cwd: string[]  // path segments from root

  constructor(root: FSNode) {
    this.root = root
    this.cwd = []
  }

  private resolve(path: string): string[] {
    if (path.startsWith('/')) return path.split('/').filter(Boolean)
    return [...this.cwd, ...path.split('/').filter(p => p !== '.')]
  }

  private getNode(segs: string[]): FSNode | null {
    let cur: FSNode = this.root
    for (const seg of segs) {
      if (seg === '..') { segs = segs.slice(0, segs.indexOf(seg) - 1); continue }
      if (!cur.children || !(seg in cur.children)) return null
      cur = cur.children[seg]
    }
    return cur
  }

  private normPath(segs: string[]): string {
    const r: string[] = []
    for (const s of segs) {
      if (s === '..') r.pop()
      else if (s && s !== '.') r.push(s)
    }
    return '/' + r.join('/')
  }

  private nodeAtPath(rawPath?: string): { node: FSNode; segs: string[] } | null {
    const segs = rawPath ? this.resolve(rawPath) : [...this.cwd]
    const clean: string[] = []
    for (const s of segs) {
      if (s === '..') clean.pop()
      else if (s && s !== '.') clean.push(s)
    }
    const node = this.getNodeClean(clean)
    if (!node) return null
    return { node, segs: clean }
  }

  private getNodeClean(segs: string[]): FSNode | null {
    let cur: FSNode = this.root
    for (const seg of segs) {
      if (!cur.children || !(seg in cur.children)) return null
      cur = cur.children[seg]
    }
    return cur
  }

  private formatLs(name: string, node: FSNode, long: boolean, showHidden: boolean): string | null {
    const isHidden = name.startsWith('.') || node.hidden
    if (isHidden && !showHidden) return null
    if (!long) return name + (node.type === 'dir' ? '/' : '')
    const type = node.type === 'dir' ? 'd' : '-'
    const perms = node.perms ?? (node.type === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--')
    const owner = node.owner ?? 'root'
    const size = node.size ?? (node.content?.length ?? 0)
    return `${type}${perms} 1 ${owner} ${owner} ${String(size).padStart(6)} Jan  1 00:00 ${name}`
  }

  exec(raw: string): string {
    const parts = raw.trim().split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    switch (cmd) {
      case 'pwd':
        return this.normPath(this.cwd)

      case 'ls': {
        const flags = args.filter(a => a.startsWith('-')).join('')
        const showAll  = flags.includes('a')
        const longFmt  = flags.includes('l')
        const pathArg  = args.find(a => !a.startsWith('-'))
        const res = this.nodeAtPath(pathArg)
        if (!res) return `ls: cannot access '${pathArg ?? '.'}': No such file or directory`
        const { node } = res
        if (node.type === 'file') return this.formatLs(pathArg ?? '.', node, longFmt, true) ?? ''
        const children = node.children ?? {}
        const entries: string[] = []
        if (showAll) {
          if (longFmt) { entries.push('total 0'); entries.push(`drwxr-xr-x 1 root root      0 Jan  1 00:00 .`); entries.push(`drwxr-xr-x 1 root root      0 Jan  1 00:00 ..`) }
          else { entries.push('.'); entries.push('..') }
        }
        for (const [name, child] of Object.entries(children)) {
          const line = this.formatLs(name, child, longFmt, showAll)
          if (line) entries.push(line)
        }
        return entries.join('\n')
      }

      case 'cd': {
        const target = args[0] ?? '~'
        if (target === '~' || target === '/') { this.cwd = []; return '' }
        const res = this.nodeAtPath(target)
        if (!res) return `bash: cd: ${target}: No such file or directory`
        if (res.node.type !== 'dir') return `bash: cd: ${target}: Not a directory`
        this.cwd = res.segs
        return ''
      }

      case 'cat': {
        if (!args[0]) return 'cat: missing operand'
        const res = this.nodeAtPath(args[0])
        if (!res) return `cat: ${args[0]}: No such file or directory`
        if (res.node.type === 'dir') return `cat: ${args[0]}: Is a directory`
        return res.node.content ?? ''
      }

      case 'file': {
        if (!args[0]) return 'file: missing argument'
        const res = this.nodeAtPath(args[0])
        if (!res) return `${args[0]}: ERROR: No such file or directory`
        if (res.node.type === 'dir') return `${args[0]}: directory`
        const content = res.node.content ?? ''
        if (/^[A-Za-z0-9+/=\n]+$/.test(content.trim())) return `${args[0]}: ASCII text (base64 encoded)`
        return `${args[0]}: ASCII text`
      }

      case 'grep': {
        const recursive = args[0] === '-r'
        const patternArg = recursive ? args[1] : args[0]
        const pathArg = recursive ? args[2] : args[1]
        if (!patternArg) return 'grep: missing pattern'
        let pattern: RegExp
        try { pattern = new RegExp(patternArg, 'i') } catch { return `grep: invalid regexp: ${patternArg}` }
        const searchIn = (node: FSNode, prefix: string): string[] => {
          const results: string[] = []
          if (node.type === 'file' && node.content) {
            for (const line of node.content.split('\n')) {
              if (pattern.test(line)) results.push(prefix ? `${prefix}:${line}` : line)
            }
          } else if (node.type === 'dir' && recursive && node.children) {
            for (const [name, child] of Object.entries(node.children)) {
              results.push(...searchIn(child, prefix ? `${prefix}/${name}` : name))
            }
          }
          return results
        }
        const res = pathArg ? this.nodeAtPath(pathArg) : { node: this.getNodeClean(this.cwd) ?? this.root, segs: this.cwd }
        if (!res) return `grep: ${pathArg}: No such file or directory`
        return searchIn(res.node, pathArg ?? '').join('\n') || ''
      }

      case 'find': {
        const nameFlag = args.indexOf('-name')
        const pattern  = nameFlag >= 0 ? args[nameFlag + 1] : null
        const startArg = args[0] && !args[0].startsWith('-') ? args[0] : undefined
        const res = startArg ? this.nodeAtPath(startArg) : { node: this.getNodeClean(this.cwd) ?? this.root, segs: this.cwd }
        if (!res) return `find: '${startArg}': No such file or directory`
        const walk = (node: FSNode, p: string): string[] => {
          const results: string[] = []
          if (!pattern || node.type === 'file' && minimatch(Object.keys(node.children ?? { [p.split('/').pop()!]: node })[0] ?? p, pattern)) {
            // just check the name
          }
          if (node.type === 'dir' && node.children) {
            for (const [name, child] of Object.entries(node.children)) {
              const full = `${p}/${name}`
              if (!pattern || minimatch(name, pattern)) results.push(full)
              results.push(...walk(child, full))
            }
          }
          return results
        }
        const basePath = startArg ? (startArg.startsWith('/') ? startArg : this.normPath([...this.cwd, startArg])) : this.normPath(this.cwd)
        const found = walk(res.node, basePath)
        return [basePath, ...found].filter(p => !pattern || p.endsWith('/' + (pattern ?? '')) || p === basePath).join('\n')
      }

      case 'base64': {
        if (args[0] !== '-d') return 'base64: invalid option'
        if (!args[1]) return 'base64: missing operand'
        const res = this.nodeAtPath(args[1])
        if (!res) return `base64: ${args[1]}: No such file or directory`
        if (res.node.type === 'dir') return `base64: ${args[1]}: Is a directory`
        try {
          return Buffer.from((res.node.content ?? '').trim().replace(/\n/g, ''), 'base64').toString('utf-8')
        } catch {
          return 'base64: invalid input'
        }
      }

      default:
        return `bash: ${cmd}: command not found`
    }
  }
}

function minimatch(name: string, pattern: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return re.test(name)
}
