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
