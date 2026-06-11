import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const USERS = [
  { username: 'demo', password: 'academy' },
  { username: 'etienne', password: 'sovr2024' },
]

async function main() {
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { username: u.username },
      update: { password: hash },
      create: { username: u.username, password: hash },
    })
    console.log(`Seeded user: ${u.username}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
