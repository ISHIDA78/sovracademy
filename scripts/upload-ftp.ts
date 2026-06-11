#!/usr/bin/env tsx
/**
 * Upload content/ vers le serveur FTP de prod
 * Configurer dans .env :
 *   FTP_HOST=ftp.infomaniak.com
 *   FTP_USER=xxx
 *   FTP_PASS=xxx
 *   FTP_REMOTE_PATH=/sites/sovracademy/content
 *   FTP_SECURE=true
 *
 * Usage :
 *   npm run upload-ftp
 *   npm run upload-ftp -- --verbose
 */
import * as ftp from 'basic-ftp'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config()

const FTP_HOST   = process.env.FTP_HOST
const FTP_USER   = process.env.FTP_USER
const FTP_PASS   = process.env.FTP_PASS
const FTP_REMOTE = process.env.FTP_REMOTE_PATH ?? '/content'
const FTP_SECURE = process.env.FTP_SECURE !== 'false'
const VERBOSE    = process.argv.includes('--verbose')

const CONTENT_DIR = path.join(process.cwd(), 'content')

function countFiles(dir: string): number {
  let n = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name))
    else n++
  }
  return n
}

async function main() {
  if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
    console.error('Variables manquantes dans .env : FTP_HOST, FTP_USER, FTP_PASS')
    process.exit(1)
  }

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error('Dossier content/ introuvable — lance d\'abord : npm run generate')
    process.exit(1)
  }

  const total = countFiles(CONTENT_DIR)
  if (total === 0) {
    console.error('content/ est vide — lance d\'abord : npm run generate')
    process.exit(1)
  }

  console.log(`Serveur : ${FTP_HOST} (secure: ${FTP_SECURE})`)
  console.log(`Remote  : ${FTP_REMOTE}`)
  console.log(`Fichiers: ${total} à uploader`)
  console.log('─'.repeat(60))

  const client = new ftp.Client()
  client.ftp.verbose = VERBOSE

  // Afficher la progression
  client.trackProgress(info => {
    if (info.name) {
      process.stdout.write(`\r  ${info.name.padEnd(40)} ${info.bytes} bytes`)
    }
  })

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: FTP_SECURE,
    })
    console.log('Connecté\n')

    await client.uploadFromDir(CONTENT_DIR, FTP_REMOTE)

    client.trackProgress()
    process.stdout.write('\n')
    console.log('─'.repeat(60))
    console.log(`Upload terminé — ${total} fichiers vers ${FTP_HOST}${FTP_REMOTE}`)
  } catch (err) {
    client.trackProgress()
    console.error('\nErreur FTP:', (err as Error).message)
    process.exit(1)
  } finally {
    client.close()
  }
}

main()
