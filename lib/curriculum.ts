export interface Lesson {
  id: string
  t: string
  xp: number
}

export interface Cursus {
  id: string
  label: string
  cert: string
  sub: string
  final?: boolean
  lessons: Lesson[]
}

export const CUR: Cursus[] = [
  {
    id: 'c0', label: 'Architecture CPU', cert: 'Architecture Bas Niveau',
    sub: 'Registres · Pipeline · Interruptions · Bus',
    lessons: [
      { id: 'c0l0', t: 'Portes logiques & ALU', xp: 120 },
      { id: 'c0l1', t: 'Registres & flags', xp: 140 },
      { id: 'c0l2', t: 'Pipeline & hazards', xp: 160 },
      { id: 'c0l3', t: 'Interruptions & exceptions', xp: 180 },
      { id: 'c0l4', t: 'Bus mémoire & DMA', xp: 200 },
    ],
  },
  {
    id: 'c1', label: 'Théorie OS', cert: 'OS Theory',
    sub: 'Scheduler · Syscalls · IPC · Virtual Memory',
    lessons: [
      { id: 'c1l0', t: 'Processus & threads', xp: 150 },
      { id: 'c1l1', t: 'Scheduler & priorités', xp: 160 },
      { id: 'c1l2', t: 'Syscalls user/kernel', xp: 180 },
      { id: 'c1l3', t: 'IPC : pipes, sockets, shm', xp: 170 },
      { id: 'c1l4', t: 'Mémoire virtuelle & paging', xp: 200 },
      { id: 'c1l5', t: 'Swap, OOM, mmap', xp: 180 },
    ],
  },
  {
    id: 'c2', label: 'Linux — Arch & Debian', cert: 'Linux Admin',
    sub: 'Filesystem · systemd · Réseau · Bash/Fish · Terminal',
    lessons: [
      { id: 'c2l0', t: 'Architecture Arch vs Debian', xp: 120 },
      { id: 'c2l1', t: 'Filesystem & permissions', xp: 130 },
      { id: 'c2l2', t: 'systemd, journald, services', xp: 150 },
      { id: 'c2l3', t: 'Réseau : ip, ss, nftables', xp: 160 },
      { id: 'c2l4', t: 'Bash scripting avancé', xp: 170 },
      { id: 'c2l5', t: 'Fish shell & automatisation', xp: 140 },
      { id: 'c2l6', t: 'Gestion paquets & AUR', xp: 120 },
      { id: 'c2l7', t: 'Émulateurs de terminal & config', xp: 110 },
      { id: 'c2l8', t: 'Tmux : sessions, fenêtres, panneaux', xp: 140 },
      { id: 'c2l9', t: 'Éditeurs CLI : Vim & Nano', xp: 130 },
      { id: 'c2l10', t: 'Redirections, pipes & substitution', xp: 150 },
      { id: 'c2l11', t: 'Readline & raccourcis shell', xp: 110 },
      { id: 'c2l12', t: 'Outils CLI : grep, awk, sed, find', xp: 160 },
    ],
  },
  {
    id: 'c3', label: 'Cryptographie', cert: 'Cryptographie',
    sub: 'Sym/Asym · PKI · TLS/mTLS · Side-channels',
    lessons: [
      { id: 'c3l0', t: 'Sym. : AES, ChaCha20', xp: 180 },
      { id: 'c3l1', t: 'Asym. : RSA, ECC, DH', xp: 200 },
      { id: 'c3l2', t: 'Hashing & HMAC', xp: 160 },
      { id: 'c3l3', t: 'PKI, CA, CRL, OCSP', xp: 200 },
      { id: 'c3l4', t: 'TLS 1.3 & mTLS', xp: 220 },
      { id: 'c3l5', t: 'Side-channel & timing', xp: 250 },
    ],
  },
  {
    id: 'c4', label: 'Réseaux', cert: 'Networking',
    sub: 'OSI · ARP/ICMP/BGP · gRPC · Firewall',
    lessons: [
      { id: 'c4l0', t: 'Modèle OSI complet', xp: 150 },
      { id: 'c4l1', t: 'ARP, ICMP, DNS internals', xp: 170 },
      { id: 'c4l2', t: 'TCP/UDP & raw sockets', xp: 180 },
      { id: 'c4l3', t: 'BGP & routage', xp: 200 },
      { id: 'c4l4', t: 'gRPC & Protobuf', xp: 190 },
      { id: 'c4l5', t: 'nftables & firewall', xp: 180 },
      { id: 'c4l6', t: 'VPN WireGuard/OpenVPN', xp: 200 },
    ],
  },
  {
    id: 'c5', label: 'Langages système', cert: 'Systems Programming',
    sub: 'Rust · C · Asm · Langage machine · ELF',
    lessons: [
      { id: 'c5l0', t: 'C : pointeurs & mémoire', xp: 180 },
      { id: 'c5l1', t: 'Rust : ownership', xp: 200 },
      { id: 'c5l2', t: 'Rust : unsafe & FFI', xp: 220 },
      { id: 'c5l3', t: 'Asm x86-64', xp: 230 },
      { id: 'c5l4', t: 'Langage machine & opcodes', xp: 250 },
      { id: 'c5l5', t: 'ELF, linker, loader', xp: 220 },
      { id: 'c5l6', t: 'Compilation & ABI', xp: 200 },
    ],
  },
  {
    id: 'c6', label: 'Sécurité offensive', cert: 'Offensive Security',
    sub: 'Threat model · RE · Exploit · Forensics',
    lessons: [
      { id: 'c6l0', t: 'Threat modeling & STRIDE', xp: 200 },
      { id: 'c6l1', t: 'Enum & reconnaissance', xp: 210 },
      { id: 'c6l2', t: 'Reverse engineering', xp: 260 },
      { id: 'c6l3', t: 'Stack overflow & shellcode', xp: 280 },
      { id: 'c6l4', t: 'Heap exploitation', xp: 300 },
      { id: 'c6l5', t: 'ROP chains', xp: 320 },
      { id: 'c6l6', t: 'Forensics & malware', xp: 280 },
    ],
  },
  {
    id: 'c7', label: 'Sécurité défensive', cert: 'Defensive Security',
    sub: 'SIEM · Conteneurs · Hardening · IDS',
    lessons: [
      { id: 'c7l0', t: 'SIEM & logs', xp: 200 },
      { id: 'c7l1', t: 'Corrélation alertes', xp: 220 },
      { id: 'c7l2', t: 'Namespaces & cgroups', xp: 200 },
      { id: 'c7l3', t: 'Sécurité conteneurs', xp: 210 },
      { id: 'c7l4', t: 'Hardening (CIS/SELinux)', xp: 240 },
      { id: 'c7l5', t: 'IDS/IPS & honeypots', xp: 250 },
    ],
  },
  {
    id: 'cf', label: 'Build Your OS', cert: '★ WHITE HAT CERTIFICATION',
    final: true, sub: 'Bootloader · Kernel · Init · Network',
    lessons: [
      { id: 'cfl0', t: 'Bootloader GRUB/EFI', xp: 300 },
      { id: 'cfl1', t: 'Kernel config & build', xp: 350 },
      { id: 'cfl2', t: 'Init from scratch', xp: 350 },
      { id: 'cfl3', t: 'Network stack minimal', xp: 400 },
      { id: 'cfl4', t: 'Userland & shell', xp: 400 },
      { id: 'cfl5', t: 'Soutenance live', xp: 500 },
    ],
  },
]

export function unlocked(id: string, done: Record<string, boolean>): boolean {
  const i = CUR.findIndex(c => c.id === id)
  if (i === 0) return true
  if (id === 'cf') return CUR.slice(0, 8).every(c => c.lessons.every(l => done[l.id]))
  return CUR[i - 1].lessons.every(l => done[l.id])
}

export function rank(xp: number): string {
  if (xp < 300) return 'apprenti'
  if (xp < 800) return 'junior'
  if (xp < 1500) return 'confirmé'
  if (xp < 3000) return 'expert'
  if (xp < 6000) return 'senior'
  return '★ white-hat'
}
