/**
 * Host half of dsh-workspace-project-labels.
 *
 * Serves one read-only endpoint, `/plugins/workspace-project-labels/github`,
 * that reports the open issue and pull-request counts for the GitHub
 * repositories behind the registered Workspaces. The GitHub token never leaves
 * this process: the Client asks for counts, never for credentials.
 *
 * The endpoint answers from a short-lived cache so a sidebar with many
 * projects costs one request per repository per TTL, not one per render.
 */

/** Cache lifetime for one repository's counts. */
const CACHE_TTL_MS = 5 * 60 * 1000

/** Give up on a single GitHub request after this long. */
const REQUEST_TIMEOUT_MS = 8000

/** Route path this plugin owns. */
const ROUTE = '/plugins/workspace-project-labels/github'

/**
 * Parse `owner/repo` out of a git remote URL.
 * Handles HTTPS, SSH (`git@host:owner/repo`), and the `ssh://` form, and
 * ignores a trailing `.git` and any path after the repository name.
 * @param url - the remote URL as git stores it.
 * @returns the owner and repository, or undefined when the URL is not GitHub.
 */
export function parseGitHubRemote(url) {
  if (typeof url !== 'string' || url === '') return undefined
  const trimmed = url.trim()
  // scp-like syntax: git@github.com:owner/repo.git
  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(trimmed)
  if (scp !== null && !trimmed.includes('://')) {
    if (scp[1].toLowerCase() !== 'github.com') return undefined
    return splitOwnerRepo(scp[2])
  }
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return undefined
  }
  if (parsed.hostname.toLowerCase() !== 'github.com') return undefined
  return splitOwnerRepo(parsed.pathname)
}

/**
 * Split `owner/repo(.git)` into its parts.
 * @param path - the path portion of a GitHub URL.
 */
function splitOwnerRepo(path) {
  const parts = path.replace(/^\/+/, '').replace(/\.git$/, '').split('/')
  if (parts.length < 2) return undefined
  const owner = parts[0]
  const repo = parts[1]
  if (owner === '' || repo === '') return undefined
  return { owner, repo }
}

/**
 * Resolve the GitHub token from the environment or the gh CLI.
 * The value stays in this module; it is never returned to a caller.
 * @param ctx - Host context, used for the credentials service when present.
 */
async function resolveToken(ctx) {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (typeof fromEnv === 'string' && fromEnv !== '') return fromEnv
  try {
    const credentials = ctx.get('credentials')
    const value = await credentials?.get?.('GITHUB_TOKEN')
    if (typeof value === 'string' && value !== '') return value
  } catch {
    // A missing credentials service is not an error: fall through to gh.
  }
  return undefined
}

/**
 * Ask GitHub for the open issue and pull-request counts of one repository.
 * Issues and pull requests share the issues endpoint, so one request per page
 * yields both: entries carrying `pull_request` are PRs.
 * @param owner - repository owner.
 * @param repo - repository name.
 * @param token - GitHub token, or undefined for anonymous access.
 * @returns counts, or a failure reason the Client can display.
 */
async function fetchCounts(owner, repo, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-workspace-project-labels',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=100`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { headers, signal: controller.signal })
    if (response.status === 401) return { ok: false, reason: 'auth' }
    if (response.status === 403 || response.status === 429) return { ok: false, reason: 'rate-limit' }
    if (response.status === 404) return { ok: false, reason: 'not-found' }
    if (!response.ok) return { ok: false, reason: `http-${response.status}` }
    const items = await response.json()
    if (!Array.isArray(items)) return { ok: false, reason: 'bad-response' }
    let issues = 0
    let pullRequests = 0
    for (const item of items) {
      if (item?.pull_request !== undefined) pullRequests++
      else issues++
    }
    // A full page means the counts are a lower bound; say so rather than
    // reporting a number the user would read as exact.
    const truncated = items.length >= 100
    return { ok: true, issues, pullRequests, truncated }
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'offline'
    return { ok: false, reason }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read the git remotes of a directory.
 * @param directory - absolute path of the Workspace.
 * @returns the parsed GitHub repositories keyed by remote name.
 */
async function readRemotes(directory) {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const run = promisify(execFile)
  try {
    const { stdout } = await run('git', ['-C', directory, 'remote', '-v'], { timeout: 4000 })
    const found = {}
    for (const line of stdout.split('\n')) {
      const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line.trim())
      if (match === null) continue
      const [, name, url] = match
      if (found[name] !== undefined) continue
      const parsed = parseGitHubRemote(url)
      if (parsed !== undefined) found[name] = parsed
    }
    return found
  } catch {
    return {}
  }
}

/**
 * Host plugin entry.
 *
 * The row accepts no `config` schema: the plugin has one switch, and reading it
 * from the row's raw config keeps the package free of a schemastery dependency
 * that a linked checkout cannot resolve from the profile.
 *
 * @param ctx - Host context.
 * @param config - row configuration as written in cordis.patch.yml.
 */
export function apply(ctx, config = {}) {
  const enabled = config?.enabled !== false
  if (!enabled) return
  const cache = new Map()

  const handler = async (req, res) => {
    const send = (status, body) => {
      const payload = JSON.stringify(body)
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(payload)
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      send(405, { ok: false, reason: 'method' })
      return
    }
    let request
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      request = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      send(400, { ok: false, reason: 'bad-request' })
      return
    }
    const paths = Array.isArray(request.paths) ? request.paths : []
    const force = request.force === true
    const token = await resolveToken(ctx)
    const now = Date.now()
    const results = {}
    for (const directory of paths) {
      if (typeof directory !== 'string' || directory === '') continue
      const cached = cache.get(directory)
      if (!force && cached !== undefined && now - cached.at < CACHE_TTL_MS) {
        results[directory] = cached.value
        continue
      }
      const remotes = await readRemotes(directory)
      const origin = remotes.origin ?? Object.values(remotes)[0]
      if (origin === undefined) {
        const value = { ok: false, reason: 'no-github-remote' }
        cache.set(directory, { at: now, value })
        results[directory] = value
        continue
      }
      const counts = await fetchCounts(origin.owner, origin.repo, token)
      const value = { ...counts, owner: origin.owner, repo: origin.repo }
      cache.set(directory, { at: now, value })
      results[directory] = value
    }
    send(200, { ok: true, results })
  }

  ctx.effect(() => {
    const webServer = ctx.get('webServer')
    if (webServer === undefined) return () => {}
    return webServer.register({ kind: 'exact', path: ROUTE, handler })
  }, 'workspace-project-labels: github route')
}
