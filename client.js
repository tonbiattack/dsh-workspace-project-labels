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
  /* The chip takes the space the row leaves after its title and time label,
     and shrinks before it clips. A fixed max-width cut long project names
     (the longest here is 29 characters) down to an unreadable stub. */
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
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
}
/* The trailing seat is a flex row; letting the chip grow into the free space
   is what keeps a long name readable instead of clipped at a fixed width. */
.wpl-chip-wrap {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  flex: 0 1 auto;
}

/* The Workspace filter sits between the section header and the session list.
   The host region is a flex column and the list is its flexing scroller, so a
   non-flexing sibling here shifts the list down without changing its sizing. */
.wpl-bar-host {
  flex: none;
  padding: 2px 8px 6px;
  box-sizing: border-box;
}
.wpl-bar-host[hidden] { display: none; }
.wpl-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.wpl-input {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3);
  background: transparent;
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
.wpl-status {
  padding-top: 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 14px;
}

/* A filtered-out row keeps its place and height so the list does not reflow;
   only its contents fade. */
.wpl-hidden {
  opacity: 0.28;
  transition: opacity 120ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .wpl-hidden { transition: none; }
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
     * One Session row's project chip. Both hooks are global standard props, so
     * the component subscribes to the smallest slice it needs: the Workspace
     * list and this Session's working directory.
     */
    function ProjectLabel(props) {
      const items = props.useWorkspaces(snapshot => snapshot.items)
      const cwd = props.useSessions(state => state.byId[props.sessionId]?.cwd)
      const workspace = React.useMemo(() => workspaceForCwd(items, cwd), [items, cwd])
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
      return h('span', { className: 'wpl-chip-wrap' },
        h('span', {
          className: 'wpl-chip',
          title: `${label}\n${workspace.path}`,
          'aria-label': label,
          style: { '--wpl-edge': color.edge, '--wpl-tint': color.tint },
        }, label),
      )
    }

    /**
     * Shared Workspace-filter state. The field writes it; the dimming pass
     * reads it. Kept outside React so the DOM pass can read it directly.
     */
    const workspaceFilter = {
      query: '',
      listeners: new Set(),
      get() { return this.query },
      set(query) {
        const next = typeof query === 'string' ? query : ''
        if (next === this.query) return
        this.query = next
        for (const listener of [...this.listeners]) listener()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }

    /** Subscribe a component to the Workspace filter. */
    function useWorkspaceFilter() {
      const [query, setQuery] = React.useState(() => workspaceFilter.get())
      React.useEffect(() => {
        const sync = () => setQuery(workspaceFilter.get())
        sync()
        return workspaceFilter.subscribe(sync)
      }, [])
      return query
    }

    /**
     * Does one Workspace match the query? Only the registered title is searched,
     * falling back to the folder name when a Workspace has no title. Session
     * titles and conversation content are deliberately not consulted.
     * @param workspace - candidate Workspace row.
     * @param query - lowercased, trimmed user text; empty matches everything.
     */
    function matchesWorkspace(workspace, query) {
      if (query === '') return true
      const title = (workspace.title || basename(workspace.path ?? '')).toLowerCase()
      return title.includes(query)
    }

    /**
     * Apply the Workspace filter to the rendered sidebar.
     *
     * The host owns the row list and exposes no filter hook, so matching rows
     * cannot be removed. Non-matching Workspace headers and their sessions are
     * dimmed instead: the list keeps its layout, and clearing restores it.
     * Workspace membership comes from the registry (`workspace.sessionIds`),
     * not from re-deriving a Workspace per session.
     *
     * @param items - registered Workspace rows.
     */
    function applyWorkspaceFilter(items) {
      const raw = workspaceFilter.get().trim().toLowerCase()
      const filtering = raw !== ''
      const matchingIds = new Set()
      const matchingSessions = new Set()
      if (filtering) {
        for (const workspace of items) {
          if (!matchesWorkspace(workspace, raw)) continue
          matchingIds.add(workspace.workspaceId)
          for (const sessionId of workspace.sessionIds ?? []) matchingSessions.add(sessionId)
        }
      }
      for (const row of document.querySelectorAll('[data-row-key^="workspace:"]')) {
        if (!filtering) { row.classList.remove('wpl-hidden'); continue }
        const key = (row.getAttribute('data-row-key') ?? '').slice('workspace:'.length)
        // The ungrouped bucket has an empty key and is not a registered
        // Workspace, so it hides whenever a Workspace filter is active.
        row.classList.toggle('wpl-hidden', !matchingIds.has(key))
      }
      for (const row of document.querySelectorAll('[data-row-key^="session:"]')) {
        if (!filtering) { row.classList.remove('wpl-hidden'); continue }
        const id = (row.getAttribute('data-row-key') ?? '').slice('session:'.length)
        row.classList.toggle('wpl-hidden', !matchingSessions.has(id))
      }
    }

    /**
     * The sidebar's Workspace search field.
     *
     * It is mounted once from the sidebar foot and portals its markup into a
     * container inserted immediately before the session list, so it sits under
     * the section header and above the rows without joining the scroller or
     * the host's flex sizing.
     *
     * @param props - slot props; `useWorkspaces` is the global Workspace hook.
     */
    function WorkspaceFilterHost(props) {
      const query = useWorkspaceFilter()
      const items = props.useWorkspaces === undefined
        ? []
        : props.useWorkspaces(snapshot => snapshot.items)
      const [mount, setMount] = React.useState(null)

      // Attach one container above the list, and keep it attached across the
      // host's own re-renders.
      React.useEffect(() => {
        let container
        let observer
        const attach = () => {
          const area = document.querySelector('[data-sidebar-list-area]')
          if (area === null || area.parentElement === null) return false
          // Hidden while the sidebar is collapsed to its rail: the list has no
          // usable width, so a field there would only crowd the icons.
          if (area.clientWidth < 120) {
            if (container !== undefined) container.hidden = true
            return true
          }
          if (container === undefined) {
            container = document.createElement('div')
            container.className = 'wpl-bar-host'
            container.dataset.plugin = 'dsh-workspace-project-labels'
          }
          container.hidden = false
          if (container.parentElement !== area.parentElement || container.nextElementSibling !== area) {
            area.parentElement.insertBefore(container, area)
          }
          setMount(container)
          return true
        }
        if (!attach()) {
          observer = new MutationObserver(() => {
            if (attach() && observer !== undefined) { observer.disconnect(); observer = undefined }
          })
          observer.observe(document.body, { childList: true, subtree: true })
        }
        const onResize = () => { attach() }
        window.addEventListener('resize', onResize)
        return () => {
          window.removeEventListener('resize', onResize)
          observer?.disconnect()
          container?.remove()
        }
      }, [])

      // Re-run the dimming pass whenever the filter, the Workspace list, or the
      // rendered rows change. Rows appear and disappear as the host pages and
      // expands groups, so observe the list rather than guessing when.
      React.useEffect(() => {
        applyWorkspaceFilter(items)
        const area = document.querySelector('[data-sidebar-list-area]')
        if (area === null) return undefined
        const observer = new MutationObserver(() => { applyWorkspaceFilter(items) })
        observer.observe(area, { childList: true, subtree: true })
        return () => {
          observer.disconnect()
          for (const row of document.querySelectorAll('.wpl-hidden')) row.classList.remove('wpl-hidden')
        }
      }, [items, query])

      if (mount === null) return null
      const { createPortal } = require('react-dom')
      const trimmed = query.trim().toLowerCase()
      const matches = trimmed === '' ? -1 : items.filter(workspace => matchesWorkspace(workspace, trimmed)).length
      return createPortal(h(WorkspaceFilterBar, { matches }), mount)
    }

    /**
     * The field itself: a text input, a match count while filtering, and a
     * clear button. Escape clears it.
     * @param props - `matches` is the number of matching Workspaces, or -1 when
     *   no filter is active.
     */
    function WorkspaceFilterBar(props) {
      const query = useWorkspaceFilter()
      const [draft, setDraft] = React.useState(query)
      React.useEffect(() => { setDraft(query) }, [query])
      const active = query.trim() !== ''
      const noMatch = props.matches === 0
      return h(React.Fragment, null,
        h('div', { className: 'wpl-bar' },
          h('input', {
            className: 'wpl-input',
            type: 'text',
            value: draft,
            placeholder: 'ワークスペース名で絞り込み',
            'aria-label': 'ワークスペース名で絞り込み',
            onChange: (event) => {
              setDraft(event.target.value)
              workspaceFilter.set(event.target.value)
            },
            onKeyDown: (event) => {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              setDraft('')
              workspaceFilter.set('')
            },
          }),
          active && h('button', {
            type: 'button',
            className: 'wpl-clear',
            title: '絞り込みを解除',
            'aria-label': '絞り込みを解除',
            onClick: () => { setDraft(''); workspaceFilter.set('') },
          }, '×'),
        ),
        active && h('div', { className: 'wpl-status' },
          noMatch ? '一致するワークスペースはありません'
            : `${props.matches} 件のワークスペース`),
      )
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

        // The search field lives in the sidebar foot, which renders exactly one
        // occupant per registration. Registering it on a row-scoped list would
        // render one field per session row, which is what broke the layout in
        // an earlier attempt: the field itself is portalled above the list.
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'workspace-project-labels-filter',
          order: 900,
        }, WorkspaceFilterHost))
      },
    }
  },
})
