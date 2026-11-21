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
     * Each project gets a stable hue derived from its Workspace id, so the same
     * project keeps its color across reloads and machines. The hue is applied
     * as a low-opacity tint plus a matching left edge, which keeps the chip
     * readable on both light and dark themes without overriding the host's
     * text color.
     */
    const CSS = `
.wpl-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 8em;
  min-width: 0;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--wpl-tint, var(--dsw-alias-interactive-bg-hover));
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: none;
}
.wpl-chip::before {
  content: '';
  flex: none;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--wpl-dot, currentColor);
}
.wpl-chip[data-plain]::before { display: none; }
`

    /** Last path segment of a Windows or POSIX path. */
    function basename(path) {
      if (typeof path !== 'string' || path === '') return ''
      const trimmed = path.replace(/[\\/]+$/, '')
      const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
      return cut >= 0 ? trimmed.slice(cut + 1) : trimmed
    }

    /**
     * Twelve hues spaced around the wheel, skipping the red band that reads as
     * an error state. A fixed palette keeps every pair of colors far apart;
     * a continuous hash would put some projects within a few degrees of each
     * other and make them look identical at chip size.
     */
    const PALETTE = [205, 265, 160, 30, 320, 190, 95, 240, 15, 285, 130, 55]

    /**
     * Stable palette slot for a Workspace: a small FNV-1a hash over its id.
     * Hashing the id rather than the title keeps the color when a project is
     * renamed, and keeps two projects with the same folder name apart.
     */
    function hueOf(key) {
      let hash = 0x811c9dc5
      for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193) >>> 0
      }
      return PALETTE[hash % PALETTE.length]
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
      if (workspace === undefined) return null
      const label = workspace.title || basename(workspace.path)
      if (label === '') return null
      const hue = hueOf(String(workspace.workspaceId ?? workspace.path))
      return h('span', {
        className: 'wpl-chip',
        title: workspace.path,
        'aria-label': label,
        style: {
          '--wpl-tint': `hsl(${hue} 70% 50% / 0.14)`,
          '--wpl-dot': `hsl(${hue} 65% 45%)`,
        },
      }, label)
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
      },
    }
  },
})
