import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function git(cwd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? ((err as { code: number }).code) : 1) : 0
      resolve({ code, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Commits `.vibeprint/` at checkpoints (submit, interpretation, decisions) so
 * the spec has history next to the code. Only that directory is committed:
 * whatever else the user has staged stays staged and uncommitted.
 */
export class GitCheckpointer {
  private timer: NodeJS.Timeout | null = null
  private messages: string[] = []
  private running: Promise<void> | null = null
  private warned = false
  enabled: boolean

  constructor(
    private root: string,
    private dirRel: string,
    private opts: { enabled: boolean; beforeCommit?: () => void; log: (msg: string) => void; delayMs?: number },
  ) {
    this.enabled = opts.enabled
  }

  async isRepo(): Promise<boolean> {
    const r = await git(this.root, ['rev-parse', '--is-inside-work-tree'])
    return r.code === 0 && r.stdout.trim() === 'true'
  }

  schedule(message: string): void {
    if (!this.enabled) return
    this.messages.push(message)
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.commitNow(), this.opts.delayMs ?? 2500)
  }

  async commitNow(): Promise<string | null> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.messages.length) return null
    if (this.running) await this.running
    const msgs = this.messages.splice(0)
    let result: string | null = null
    this.running = (async () => {
      result = await this.commit(msgs)
    })()
    await this.running
    this.running = null
    return result
  }

  private async busy(): Promise<string | null> {
    for (const name of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG']) {
      const r = await git(this.root, ['rev-parse', '--git-path', name])
      const p = path.resolve(this.root, r.stdout.trim())
      if (r.code === 0 && fs.existsSync(p)) return name
    }
    return null
  }

  private async commit(msgs: string[]): Promise<string | null> {
    if (!(await this.isRepo())) return null
    const blocker = await this.busy()
    if (blocker) {
      this.opts.log(`git: skipped checkpoint (${blocker} in progress)`)
      return null
    }
    this.opts.beforeCommit?.()
    const unique = [...new Set(msgs)]
    const subject = unique[unique.length - 1]
    const body = unique.length > 1 ? `\n\n${unique.slice(0, -1).map((m) => `- ${m}`).join('\n')}` : ''
    for (let attempt = 0; attempt < 4; attempt++) {
      const add = await git(this.root, ['add', '-A', '--', this.dirRel])
      if (add.code !== 0) {
        if (/index\.lock/.test(add.stderr)) {
          await sleep(700 * (attempt + 1))
          continue
        }
        this.warn(`git add failed: ${add.stderr.trim()}`)
        return null
      }
      const diff = await git(this.root, ['diff', '--cached', '--quiet', '--', this.dirRel])
      if (diff.code === 0) return null // nothing changed
      const c = await git(this.root, ['commit', '-q', '-m', subject + body, '--only', '--', this.dirRel])
      if (c.code === 0) {
        const head = await git(this.root, ['rev-parse', '--short', 'HEAD'])
        this.opts.log(`git: ${head.stdout.trim()} ${subject}`)
        return head.stdout.trim()
      }
      if (/index\.lock/.test(c.stderr)) {
        await sleep(700 * (attempt + 1))
        continue
      }
      this.warn(`git commit failed: ${(c.stderr || c.stdout).trim()}`)
      return null
    }
    this.warn('git: index stayed locked; checkpoint skipped')
    return null
  }

  private warn(msg: string) {
    this.opts.log(msg)
    if (!this.warned) {
      this.warned = true
      this.opts.log('git: checkpoints will keep trying; run with --no-commit to turn them off')
    }
  }
}
