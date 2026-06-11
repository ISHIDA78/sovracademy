# SŌVR Academy

Formation white-hat en ligne de commande — interface TUI type airgeddon.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind CSS
- NextAuth.js v4 (Credentials provider)
- Prisma v7 + SQLite (via `better-sqlite3`)

## Setup

```bash
npm install
npx prisma migrate dev --name init
npm run seed        # crée les comptes demo/academy et etienne/sovr2024
npm run dev         # lance sur http://localhost:3003
```

## Variables d'environnement (`.env`)

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="..."          # clé secrète JWT, min 32 chars
NEXTAUTH_URL="http://localhost:3003"
```

## Comptes de démo

| login     | password  |
|-----------|-----------|
| demo      | academy   |
| etienne   | sovr2024  |

## Routes

| Route   | Description |
|---------|-------------|
| `/boot` | Landing — kernel log + formulaire Sign in visible + lien caché |
| `/login`| TTY login Arch Linux (pur terminal) |
| `/app`  | Shell principal (protégé, requiert auth) |

## Commandes shell (dans `/app`)

```
[0-8/F]   sélectionner cursus / leçon
ls        afficher le menu courant
start     démarrer/reprendre la leçon
next      leçon suivante
b         retour
score     progression XP
clear     nettoyer l'écran
exit      se déconnecter
poweroff  éteindre la session
h         aide
```

## Curriculum (9 couches)

c0 Architecture CPU → c1 Théorie OS → c2 Linux → c3 Cryptographie
→ c4 Réseaux → c5 Langages système → c6 Sécurité offensive
→ c7 Sécurité défensive → cf Build Your Own OS (White Hat Cert)

Chaque couche se débloque une fois la précédente complétée à 100%.

## Ajouter du contenu

Édite `lib/curriculum.ts` pour ajouter des leçons/couches, puis dans
`app/app/page.tsx` → fonction `lessonNodes()`, ajoute un cas `if (lid === '...')`.
