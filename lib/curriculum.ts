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
    id: 'c0', label: 'Linux & Terminal', cert: 'Linux Practitioner',
    sub: 'Filesystem · Permissions · Services · Outils CLI',
    lessons: [
      { id: 'c0l0', t: 'Naviguer dans le filesystem', xp: 100 },
      { id: 'c0l1', t: 'Lire et écrire des fichiers', xp: 110 },
      { id: 'c0l2', t: 'Permissions et utilisateurs', xp: 120 },
      { id: 'c0l3', t: 'Processus et services systemd', xp: 130 },
      { id: 'c0l4', t: 'Rechercher et filtrer : grep, find', xp: 120 },
      { id: 'c0l5', t: 'Redirections, pipes et substitution', xp: 130 },
      { id: 'c0l6', t: 'Outils réseau de base : ip, ss, curl', xp: 140 },
    ],
  },
  {
    id: 'c1', label: 'Scripting & Automatisation', cert: 'Automation Engineer',
    sub: 'Bash · Variables · Boucles · Fonctions · Cron · awk/sed',
    lessons: [
      { id: 'c1l0', t: 'Premier script Bash', xp: 120 },
      { id: 'c1l1', t: 'Variables, conditions et boucles', xp: 130 },
      { id: 'c1l2', t: 'Fonctions et arguments', xp: 140 },
      { id: 'c1l3', t: 'Codes de retour et gestion des erreurs', xp: 140 },
      { id: 'c1l4', t: 'Automatisation : cron et systemd timers', xp: 150 },
      { id: 'c1l5', t: 'Traitement de texte : awk, sed, grep -E', xp: 160 },
    ],
  },
  {
    id: 'c2', label: 'Réseaux', cert: 'Network Analyst',
    sub: 'IP · DNS · TCP/UDP · ARP · Firewall · VPN',
    lessons: [
      { id: 'c2l0', t: 'Comment fonctionne Internet', xp: 120 },
      { id: 'c2l1', t: 'Modèle OSI par l\'exemple', xp: 130 },
      { id: 'c2l2', t: 'ARP, ICMP et DNS en pratique', xp: 150 },
      { id: 'c2l3', t: 'TCP, UDP et sockets bruts', xp: 160 },
      { id: 'c2l4', t: 'Firewall nftables', xp: 170 },
      { id: 'c2l5', t: 'VPN WireGuard', xp: 180 },
      { id: 'c2l6', t: 'BGP, routage et gRPC', xp: 200 },
    ],
  },
  {
    id: 'c3', label: 'Cryptographie', cert: 'Cryptography Analyst',
    sub: 'Sym/Asym · Hashing · PKI · TLS 1.3 · Side-channels',
    lessons: [
      { id: 'c3l0', t: 'Pourquoi chiffrer ? Histoire et enjeux', xp: 150 },
      { id: 'c3l1', t: 'Chiffrement symétrique : AES, ChaCha20', xp: 180 },
      { id: 'c3l2', t: 'Chiffrement asymétrique : RSA, ECC, DH', xp: 200 },
      { id: 'c3l3', t: 'Hashing et HMAC', xp: 160 },
      { id: 'c3l4', t: 'PKI, CA, CRL et TLS 1.3', xp: 200 },
      { id: 'c3l5', t: 'Attaques side-channel et timing', xp: 250 },
    ],
  },
  {
    id: 'c4', label: 'Théorie OS', cert: 'OS Theory',
    sub: 'Processus · Scheduler · Syscalls · IPC · Mémoire virtuelle',
    lessons: [
      { id: 'c4l0', t: 'Processus et threads', xp: 150 },
      { id: 'c4l1', t: 'Scheduler et priorités', xp: 160 },
      { id: 'c4l2', t: 'Appels système user/kernel', xp: 180 },
      { id: 'c4l3', t: 'IPC : pipes, sockets, mémoire partagée', xp: 170 },
      { id: 'c4l4', t: 'Mémoire virtuelle et paging', xp: 200 },
      { id: 'c4l5', t: 'Swap, OOM killer et mmap', xp: 180 },
    ],
  },
  {
    id: 'c5', label: 'Architecture CPU', cert: 'Hardware Foundations',
    sub: 'Portes logiques · Registres · Pipeline · Interruptions · Bus',
    lessons: [
      { id: 'c5l0', t: 'Portes logiques et ALU', xp: 120 },
      { id: 'c5l1', t: 'Registres, flags et pile CPU', xp: 140 },
      { id: 'c5l2', t: 'Pipeline et hazards', xp: 160 },
      { id: 'c5l3', t: 'Interruptions et exceptions', xp: 180 },
      { id: 'c5l4', t: 'Bus mémoire et DMA', xp: 200 },
    ],
  },
  {
    id: 'c6', label: 'Langages système', cert: 'Systems Programming',
    sub: 'C · Rust · Asm x86-64 · ELF · Compilation',
    lessons: [
      { id: 'c6l0', t: 'C : pointeurs et gestion mémoire', xp: 180 },
      { id: 'c6l1', t: 'Rust : ownership et borrow checker', xp: 200 },
      { id: 'c6l2', t: 'Rust : unsafe et FFI', xp: 220 },
      { id: 'c6l3', t: 'Assembleur x86-64', xp: 230 },
      { id: 'c6l4', t: 'Opcodes et langage machine', xp: 250 },
      { id: 'c6l5', t: 'ELF, linker et loader', xp: 220 },
      { id: 'c6l6', t: 'Compilation, ABI et calling conventions', xp: 200 },
    ],
  },
  {
    id: 'c7', label: 'Sécurité', cert: 'Security Specialist',
    sub: 'Threat model · Recon · Exploit · Forensics · SIEM · Hardening',
    lessons: [
      { id: 'c7l0', t: 'Threat modeling et STRIDE', xp: 200 },
      { id: 'c7l1', t: 'Reconnaissance et énumération', xp: 210 },
      { id: 'c7l2', t: 'Reverse engineering', xp: 260 },
      { id: 'c7l3', t: 'Stack overflow et shellcode', xp: 280 },
      { id: 'c7l4', t: 'Exploitation du tas (heap)', xp: 300 },
      { id: 'c7l5', t: 'Chaînes ROP', xp: 320 },
      { id: 'c7l6', t: 'Forensics et analyse malware', xp: 280 },
      { id: 'c7l7', t: 'SIEM et gestion des logs', xp: 200 },
      { id: 'c7l8', t: 'Corrélation d\'alertes', xp: 220 },
      { id: 'c7l9', t: 'Namespaces, cgroups et conteneurs', xp: 200 },
      { id: 'c7l10', t: 'Hardening système (CIS/SELinux)', xp: 240 },
      { id: 'c7l11', t: 'IDS/IPS et honeypots', xp: 250 },
      { id: 'c7l12', t: 'CTF : scénario de bout en bout', xp: 300 },
    ],
  },
  {
    id: 'cf', label: 'Build Your OS', cert: '★ WHITE HAT CERTIFICATION',
    final: true, sub: 'Bootloader · Kernel · Init · Network',
    lessons: [
      { id: 'cfl0', t: 'Bootloader GRUB/EFI', xp: 300 },
      { id: 'cfl1', t: 'Compilation et config du kernel', xp: 350 },
      { id: 'cfl2', t: 'Init from scratch', xp: 350 },
      { id: 'cfl3', t: 'Stack réseau minimale', xp: 400 },
      { id: 'cfl4', t: 'Userland et shell minimal', xp: 400 },
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
