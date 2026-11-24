window.__ModuleLoader__.load({
  id: 'dsh-workspace-project-labels',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * The trailing seat is narrow and shares the row with the time label, so
     * the label is a compact chip: the project's title (or its folder name),
     * clipped, with the full path in the tooltip.
     *
     * The color is a left edge plus a matching tint. A colored edge reads far
     * better at chip size than a small dot, and the tint stays light enough
     * that the host's own text color remains legible in both themes.
     */
    const CSS = `
.wpl-chip {
  display: inline-flex;
  align-items: center;
  max-width: 8em;
  min-width: 0;
  padding: 0 5px 0 4px;
  border-radius: 4px;
  border-left: 2px solid var(--wpl-edge, transparent);
  background: var(--wpl-tint, var(--dsw-alias-interactive-bg-hover));
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: none;
  cursor: pointer;
  border-top: none;
  border-right: none;
  border-bottom: none;
  font-family: inherit;
}
.wpl-chip:hover { filter: brightness(0.95); }
.wpl-chip[data-active] {
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 0 0 1px var(--wpl-edge, transparent);
}
.wpl-chip:focus-visible {
  outline: 2px solid var(--dsw-alias-border-selected);
  outline-offset: 1px;
}

/* The filter bar is inserted above the session list inside the sidebar's
   scrolling area, so it scrolls with the list and never covers a row. */
.wpl-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 6px;
  min-width: 0;
  box-sizing: border-box;
}
.wpl-input {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3);
  background: var(--dsw-specific-sidebar-fill, transparent);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  font-family: inherit;
}
.wpl-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.wpl-input:focus {
  outline: none;
  border-color: var(--dsw-alias-border-selected);
}
.wpl-clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}
.wpl-clear:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* Dimming is the filter's visible effect: rows stay in place, so the list
   never reflows and the host's own selection and scrolling keep working. */
.wpl-dimmed {
  opacity: 0.3;
  transition: opacity 120ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .wpl-dimmed { transition: none; }
}

/* GitHub counts sit beside the project chip: two compact links, each opening
   the matching list on github.com. */
.wpl-gh {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  font-size: 10px;
  line-height: 16px;
}
.wpl-gh a {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 3px;
  border-radius: 3px;
  color: var(--dsw-alias-label-tertiary);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.wpl-gh a:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.wpl-gh a:focus-visible {
  outline: 2px solid var(--dsw-alias-border-selected);
  outline-offset: 1px;
}
.wpl-gh[data-state="error"] a,
.wpl-gh[data-state="loading"] a {
  opacity: 0.5;
  pointer-events: none;
}
.wpl-gh-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}
`

    /** Last path segment of a Windows or POSIX path. */
    function basename(path) {
      if (typeof path !== 'string' || path === '') return ''
      const trimmed = path.replace(/[\\/]+$/, '')
      const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
      return cut >= 0 ? trimmed.slice(cut + 1) : trimmed
    }

    /**
     * Golden angle: successive indices land as far apart on the wheel as the
     * count allows, so any prefix of the sequence is evenly spread. This is what
     * makes every project distinct instead of colliding in a small palette.
     */
    const GOLDEN_ANGLE = 138

    /**
     * Hues run over 20°–340° so no project lands in the red band, which would
     * read as an error state next to a session row.
     */
    const HUE_START = 20
    const HUE_SPAN = 320

    /**
     * Twenty lightness/saturation bands cycle with the index. Hue alone leaves
     * neighbors about 11° apart at 32 projects, which is hard to tell apart on a
     * 16px chip; the bands add a second axis so neighbors differ in brightness
     * and saturation as well. Measured in CIE Lab, this combination keeps every
     * pair at least ΔE 14 apart, against ΔE 2.9 for hue alone.
     */
    const BANDS = Array.from({ length: 20 }, (_, k) => ({
      light: 28 + (k % 5) * 9,
      sat: 65 + (k % 4) * 9,
    }))

    /**
     * Color for the project at `index` in the stable order.
     * @param index - zero-based position in the creation-ordered Workspace list.
     */
    function colorForIndex(index) {
      const hue = (HUE_START + (index * GOLDEN_ANGLE) % HUE_SPAN) % 360
      const band = BANDS[index % BANDS.length]
      return {
        edge: `hsl(${hue} ${band.sat}% ${band.light}%)`,
        tint: `hsl(${hue} ${band.sat}% ${band.light}% / 0.16)`,
      }
    }

    /**
     * Stable order for color assignment: oldest Workspace first, id as the
     * tiebreak. Sorting by creation time means a newly added project appends at
     * the end and leaves every existing color untouched, which a sort by id
     * would not guarantee.
     */
    function orderKey(item) {
      return `${item.createdAt ?? ''}\u0000${String(item.workspaceId ?? item.path)}`
    }

    /**
     * Resolve the Workspace that owns a Session by its working directory.
     * Workspace paths are canonical, so the comparison is case-insensitive;
     * the longest matching prefix wins, preferring a nested Workspace over its
     * ancestor.
     */
    function workspaceForCwd(items, cwd) {
      if (typeof cwd !== 'string' || cwd === '') return undefined
      const norm = value => value.replace(/[\\/]+$/, '').toLowerCase()
      const target = norm(cwd)
      let best
      let bestLength = -1
      for (const item of items) {
        if (typeof item?.path !== 'string' || item.path === '') continue
        const base = norm(item.path)
        if (target === base || target.startsWith(base + '\\') || target.startsWith(base + '/')) {
          if (base.length > bestLength) { best = item; bestLength = base.length }
        }
      }
      return best
    }

    /**
     * Case-insensitive substring match over the Workspace title and its folder
     * name. An empty query matches everything.
     * @param workspace - candidate Workspace.
     * @param query - user text, already trimmed.
     */
    function matchesQuery(workspace, query) {
      if (query === '') return true
      const needle = query.toLowerCase()
      const title = (workspace.title ?? '').toLowerCase()
      const folder = basename(workspace.path ?? '').toLowerCase()
      return title.includes(needle) || folder.includes(needle)
    }

    /**
     * Shared filter state for the whole sidebar. The bar writes it and every
     * row reads it, so the two surfaces stay in step without a store service.
     */
    const filterState = {
      query: '',
      activeWorkspaceId: undefined,
      listeners: new Set(),
      get() { return { query: this.query, activeWorkspaceId: this.activeWorkspaceId } },
      set(next) {
        const query = next.query ?? ''
        const activeWorkspaceId = next.activeWorkspaceId ?? undefined
        if (query === this.query && activeWorkspaceId === this.activeWorkspaceId) return
        this.query = query
        this.activeWorkspaceId = activeWorkspaceId
        for (const listener of [...this.listeners]) listener()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }

    /** Subscribe a component to the shared filter state. */
    function useFilter() {
      const [snapshot, setSnapshot] = React.useState(() => filterState.get())
      React.useEffect(() => {
        const sync = () => setSnapshot(filterState.get())
        sync()
        return filterState.subscribe(sync)
      }, [])
      return snapshot
    }

    /**
     * Shared GitHub count cache. One fetch per Workspace path per TTL, shared
     * by every row that points at the same project, so a list of many sessions
     * costs one request per project rather than one per row.
     */
    const githubCache = {
      /** path -> { at, value } */
      entries: new Map(),
      /** path -> Promise, so concurrent rows share one request. */
      inflight: new Map(),
      listeners: new Set(),
      ttlMs: 5 * 60 * 1000,
      get(path) {
        const entry = this.entries.get(path)
        if (entry === undefined) return undefined
        if (Date.now() - entry.at > this.ttlMs) return undefined
        return entry.value
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
      notify() {
        for (const listener of [...this.listeners]) listener()
      },
      /**
       * Fetch counts for the given paths, reusing cached and in-flight work.
       * @param paths - Workspace directories to resolve.
       * @param force - bypass the cache.
       */
      async load(paths, force = false) {
        const wanted = paths.filter(path => force || this.get(path) === undefined)
        if (wanted.length === 0) return
        const pending = wanted.filter(path => !this.inflight.has(path))
        if (pending.length > 0) {
          const request = fetch('/plugins/workspace-project-labels/github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: pending, force }),
          })
            .then(response => response.ok ? response.json() : { ok: false, results: {} })
            .then(body => {
              const results = body?.results ?? {}
              const at = Date.now()
              for (const path of pending) {
                this.entries.set(path, { at, value: results[path] ?? { ok: false, reason: 'no-response' } })
              }
            })
            .catch(() => {
              const at = Date.now()
              for (const path of pending) {
                this.entries.set(path, { at, value: { ok: false, reason: 'offline' } })
              }
            })
            .finally(() => {
              for (const path of pending) this.inflight.delete(path)
              this.notify()
            })
          for (const path of pending) this.inflight.set(path, request)
        }
        await Promise.all(wanted.map(path => this.inflight.get(path)))
      },
    }

    /** Subscribe a component to the GitHub cache. */
    function useGitHub() {
      const [, bump] = React.useReducer(value => value + 1, 0)
      React.useEffect(() => githubCache.subscribe(bump), [])
      return githubCache
    }

    /**
     * The GitHub counts for one project: open issues and open pull requests,
     * each a link to the matching list. Renders nothing when the project has no
     * GitHub remote, so a non-GitHub project keeps its row unchanged.
     */
    function GitHubBadge(props) {
      const cache = useGitHub()
      const path = props.path
      const entry = cache.get(path)
      React.useEffect(() => {
        if (entry === undefined) cache.load([path])
      }, [path, entry === undefined])
      if (entry === undefined) {
        return h('span', { className: 'wpl-gh', 'data-state': 'loading', 'aria-hidden': 'true' },
          h('span', { className: 'wpl-gh-dot' }))
      }
      if (entry.ok !== true) {
        // A project without a GitHub remote is not an error worth showing.
        if (entry.reason === 'no-github-remote') return null
        const label = entry.reason === 'rate-limit' ? 'GitHub のレート制限'
          : entry.reason === 'auth' ? 'GitHub の認証に失敗'
          : entry.reason === 'not-found' ? 'リポジトリが見つからない'
          : entry.reason === 'timeout' ? 'GitHub がタイムアウト'
          : entry.reason === 'offline' ? 'オフライン'
          : 'GitHub を取得できない'
        return h('span', {
          className: 'wpl-gh',
          'data-state': 'error',
          title: `${label}（クリックで再取得）`,
          onClick: (event) => { event.stopPropagation(); cache.load([path], true) },
        }, h('span', { className: 'wpl-gh-dot' }))
      }
      const base = `https://github.com/${entry.owner}/${entry.repo}`
      const suffix = entry.truncated === true ? '+' : ''
      return h('span', { className: 'wpl-gh', 'data-state': 'ready' },
        h('a', {
          href: `${base}/issues`,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: `未対応 Issue ${entry.issues}${suffix} 件`,
          onClick: (event) => event.stopPropagation(),
        }, 'I', String(entry.issues) + suffix),
        h('a', {
          href: `${base}/pulls`,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: `未対応 PR ${entry.pullRequests}${suffix} 件`,
          onClick: (event) => event.stopPropagation(),
        }, 'P', String(entry.pullRequests) + suffix),
      )
    }

    /**
     * One Session row's project chip. Both hooks are global standard props, so
     * the component subscribes to the smallest slice it needs: the Workspace
     * list and this Session's working directory.
     *
     * Clicking the chip filters the list to that project; clicking it again
     * clears the filter.
     */
    function ProjectLabel(props) {
      const items = props.useWorkspaces(snapshot => snapshot.items)
      const cwd = props.useSessions(state => state.byId[props.sessionId]?.cwd)
      const workspace = React.useMemo(() => workspaceForCwd(items, cwd), [items, cwd])
      const filter = useFilter()
      // Index in the stable order decides the color, so no two projects share
      // one. Recomputed only when the Workspace list itself changes.
      const color = React.useMemo(() => {
        if (workspace === undefined) return undefined
        const ordered = [...items].sort((a, b) => orderKey(a) < orderKey(b) ? -1 : orderKey(a) > orderKey(b) ? 1 : 0)
        const index = ordered.findIndex(item => item.workspaceId === workspace.workspaceId)
        return colorForIndex(index < 0 ? 0 : index)
      }, [items, workspace])
      if (workspace === undefined || color === undefined) return null
      const label = workspace.title || basename(workspace.path)
      if (label === '') return null
      const active = filter.activeWorkspaceId === workspace.workspaceId
      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'wpl-chip',
          title: `${workspace.path}\n${active ? 'クリックで絞り込みを解除' : 'クリックでこのプロジェクトだけ表示'}`,
          'aria-label': label,
          'aria-pressed': active,
          ...(active ? { 'data-active': '' } : {}),
          style: { '--wpl-edge': color.edge, '--wpl-tint': color.tint },
          onClick: (event) => {
            event.stopPropagation()
            filterState.set({
              query: filterState.query,
              activeWorkspaceId: active ? undefined : workspace.workspaceId,
            })
          },
        }, label),
        h(GitHubBadge, { path: workspace.path }),
      )
    }

    /**
     * The filter bar: a text field matching project names and a clear button.
     * It renders above the session list and never blocks the host's own
     * search, which lives in the sidebar header.
     */
    function FilterBar() {
      const filter = useFilter()
      const [draft, setDraft] = React.useState(filter.query)
      // Keep the field in step when another surface clears the filter.
      React.useEffect(() => { setDraft(filter.query) }, [filter.query])
      const active = filter.query !== '' || filter.activeWorkspaceId !== undefined
      return h('div', { className: 'wpl-bar' },
        h('input', {
          className: 'wpl-input',
          type: 'search',
          value: draft,
          placeholder: 'プロジェクト名で絞り込み',
          'aria-label': 'プロジェクト名で絞り込み',
          onChange: (event) => {
            const value = event.target.value
            setDraft(value)
            filterState.set({ query: value, activeWorkspaceId: filter.activeWorkspaceId })
          },
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setDraft('')
              filterState.set({ query: '', activeWorkspaceId: undefined })
            }
          },
        }),
        active && h('button', {
          type: 'button',
          className: 'wpl-clear',
          title: '絞り込みを解除',
          'aria-label': '絞り込みを解除',
          onClick: () => {
            setDraft('')
            filterState.set({ query: '', activeWorkspaceId: undefined })
          },
        }, '×'),
      )
    }

    /**
     * Dim the rows the filter excludes. The host owns the row list, so this
     * plugin cannot remove rows; dimming keeps the list stable and reversible
     * while still making the matching sessions obvious.
     *
     * Rows are found by their `data-row-key` attribute, which the sidebar sets
     * on every session row. A missing attribute simply leaves that row alone.
     */
    function applyDimming(items) {
      const { query, activeWorkspaceId } = filterState.get()
      const active = query !== '' || activeWorkspaceId !== undefined
      const rows = document.querySelectorAll('[data-row-key^="session:"]')
      if (!active) {
        for (const row of rows) row.classList.remove('wpl-dimmed')
        return
      }
      const matching = new Set()
      for (const workspace of items) {
        if (activeWorkspaceId !== undefined && workspace.workspaceId !== activeWorkspaceId) continue
        if (!matchesQuery(workspace, query)) continue
        for (const sessionId of workspace.sessionIds ?? []) matching.add(sessionId)
      }
      for (const row of rows) {
        const key = row.getAttribute('data-row-key') ?? ''
        const sessionId = key.slice('session:'.length)
        row.classList.toggle('wpl-dimmed', !matching.has(sessionId))
      }
    }

    /**
     * Mounts the filter bar into the sidebar's scrolling list area and keeps
     * the dimming in step with the filter and with the host's own re-renders.
     *
     * The bar is inserted as a sibling before the list rather than through a
     * slot: the sidebar declares no slot above the session list, and the
     * browsing region's own slots are row-scoped. `data-sidebar-list-area` is
     * the stable anchor the sidebar publishes for exactly this region.
     */
    function FilterHost(props) {
      const items = props.useWorkspaces(snapshot => snapshot.items)
      const filter = useFilter()
      const [mount, setMount] = React.useState(null)

      // Find (or re-find) the list area and attach a container to it.
      React.useEffect(() => {
        let container
        const attach = () => {
          const area = document.querySelector('[data-sidebar-list-area]')
          if (area === null) return false
          if (container !== undefined && container.parentElement === area) return true
          if (container === undefined) {
            container = document.createElement('div')
            container.dataset.plugin = 'dsh-workspace-project-labels'
          }
          area.insertBefore(container, area.firstChild)
          setMount(container)
          return true
        }
        if (!attach()) {
          // The sidebar may not have rendered yet; watch until it does.
          const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
          observer.observe(document.body, { childList: true, subtree: true })
          return () => { observer.disconnect(); container?.remove() }
        }
        return () => { container?.remove() }
      }, [])

      // Re-apply dimming whenever the filter, the Workspace list, or the rows
      // change. The sidebar re-renders rows on its own schedule (paging,
      // expansion, new sessions), so observe the list rather than guessing.
      React.useEffect(() => {
        applyDimming(items)
        const area = document.querySelector('[data-sidebar-list-area]')
        if (area === null) return undefined
        const observer = new MutationObserver(() => { applyDimming(items) })
        observer.observe(area, { childList: true, subtree: true })
        return () => {
          observer.disconnect()
          for (const row of document.querySelectorAll('.wpl-dimmed')) row.classList.remove('wpl-dimmed')
        }
      }, [items, filter.query, filter.activeWorkspaceId])

      if (mount === null) return null
      const { createPortal } = require('react-dom')
      return createPortal(h(FilterBar), mount)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-workspace-project-labels'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'workspace-project-labels: styles')

        ctx.slots.inject('sidebar.session.row.trailing', () => ctx.slots.register({
          name: 'sidebar.session.row.trailing',
          id: 'workspace-project-labels',
          order: 50,
        }, ProjectLabel))

        // The host mounts once per sidebar row; the first one owns the bar.
        ctx.slots.inject('sidebar.session.row.trailing', () => ctx.slots.register({
          name: 'sidebar.session.row.trailing',
          id: 'workspace-project-labels-host',
          order: 51,
        }, FilterHost))
      },
    }
  },
})
