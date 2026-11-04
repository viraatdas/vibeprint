import fs from 'node:fs'
import path from 'node:path'

/**
 * The branch checked out at `root`, read from the files (no git process: the state is read
 * often). `worktree` is true for a linked worktree (`git worktree add`), whose .git is a file
 * pointing into the main repo's .git/worktrees/.
 */
export function gitHead(root: string): { branch?: string; worktree?: boolean } {
  let gitdir = path.join(root, '.git')
  let worktree = false
  try {
    if (fs.statSync(gitdir).isFile()) {
      const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(gitdir, 'utf8'))
      if (!m) return {}
      gitdir = path.resolve(root, m[1].trim())
      worktree = gitdir.split(path.sep).includes('worktrees')
    }
    const head = fs.readFileSync(path.join(gitdir, 'HEAD'), 'utf8').trim()
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)
    // A detached HEAD (a jj checkout, a rebase) shows as its short commit.
    const branch = ref ? ref[1] : /^[0-9a-f]{7,}$/.test(head) ? head.slice(0, 7) : undefined
    return { ...(branch ? { branch } : {}), ...(worktree ? { worktree } : {}) }
  } catch {
    return {}
  }
}
