import type { FSNode } from './fakefs'

export interface QCMOption {
  key: string
  label: string
  correct: boolean
}

export interface ExerciseContent {
  type?: 'qcm' | 'cmd' | 'analyze' | 'fix' | 'flag'
  // QCM (rétrocompatibilité)
  question?: string
  options?: QCMOption[]
  explanation?: string
  // Nouveaux types
  scenario?: string
  context?: {
    fakeOutput?: string
    fs?: FSNode
  }
  accept?: string[]
  hint?: string
  xp?: number
}

export type ExerciseCmdResult = { lines: React.ReactNode[]; done: boolean }
export type ExerciseCmdHandler = (raw: string) => ExerciseCmdResult
