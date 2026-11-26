# dsh-workspace-project-labels

Shows each session's **project name** on its sidebar row in the DeepSeek Harness
Web GUI, with a stable color per project and a field that searches Workspaces by
name.

The sidebar's **In one list** view flattens every session into one list. Without
a Workspace heading above them, rows tell you the session title but not which
project the work belongs to. This plugin puts that back: a small colored chip on
each row.

![The sidebar showing the Workspace search field and a colored project chip on every session row](docs/images/sidebar.png)

Each chip carries the project's name and its own color, so a glance down the
list tells you which project each session belongs to. Hovering a chip shows the
full directory path.

## Install

```sh
dsh plugin --profile web add dsh-workspace-project-labels
```

Or install a local checkout:

```sh
dsh plugin --profile web add ./path/to/dsh-workspace-project-labels
```

Restart the Web UI after installing. The chip appears on every session row that
has a working directory matching a registered Workspace.

## What it shows

Each session row gets a chip carrying the title of the Workspace that owns the
session's working directory. Hovering the chip shows the full directory path.

The chip takes whatever width the row leaves after its title and time label, so
a long project name stays readable instead of being cut at a fixed width. Only
when the sidebar itself is too narrow does the name clip, and the tooltip always
carries the complete name.

Sessions whose working directory matches no registered Workspace show no chip,
so the row stays as it was.

## Colors

Every project gets its own color. The color is derived from the project's
position in the creation-ordered Workspace list, using the golden angle so that
successive projects land far apart on the hue wheel, combined with twenty
lightness/saturation bands. Measured in CIE Lab, every pair of projects stays at
least ΔE 14 apart, so no two chips look alike.

- **The color survives a rename.** It follows the Workspace, not its title.
- **Adding a project does not recolor the others.** New projects append to the
  end of the order, so existing colors stay put.
- **Removing a project shifts later colors.** The order is positional, so a
  deletion moves every project after it one slot. This is the trade for
  guaranteeing distinct colors with no collisions.

The hue range skips the red band, which would read as an error state. The tint
is low-opacity and the text keeps the host's own color, so the chip stays
readable in both light and dark themes.

## How the Workspace is chosen

The plugin compares the session's working directory against every registered
Workspace path and picks the longest match. A session running in a nested
Workspace therefore shows the nested project, not its ancestor.

Paths are compared case-insensitively, matching how Windows treats them.

## Searching by Workspace name

A field above the session list filters by **Workspace name**. It matches the
registered title case-insensitively and ignores session titles and conversation
content entirely, so typing `github` finds the `github-bulk-cloner` and
`github-repo-sorter` Workspaces rather than every session that mentions GitHub.

While a query is active the field reports how many Workspaces match, and the
Workspaces that do not match are dimmed along with their sessions. Workspaces
with no sessions still count as matches: the filter works on the registry, not
on the session list. **Esc** or **×** clears it.

The list keeps its layout while filtering. The host owns the row list and
exposes no filter hook, so non-matching rows are dimmed rather than removed;
that way selection, scrolling, and paging keep working and clearing the query
restores the list instantly. Matching is read from the Workspace registry's own
membership, so nothing is re-fetched and no history is loaded.

## Remote access

The plugin is a client-side module served from the same origin as the rest of
the Web UI, so it renders identically when you reach the GUI through a tunnel,
a reverse proxy, or a VPN such as Tailscale. Nothing is bound to `localhost`.

## Limitations

- The chip reads the session's stored working directory. A session whose
  directory was never recorded shows no chip.
- The label is the Workspace title. Renaming a Workspace updates every chip that
  points at it.
- The chip is display-only; it does not switch Workspace or open a menu.
- The chip renders in every grouping mode. In the grouped views the Workspace
  heading already names the project, so the chip is redundant there.
- The search field dims rows; it does not remove them. A true filtered list
  needs a filter hook from the host, which DSH does not expose.
- Sessions that belong to no Workspace are dimmed whenever a query is active,
  because they have no Workspace name to match.
- The field is inserted into the sidebar's browsing region, which the host marks
  with `data-sidebar-list-area`. A DSH release that renames that attribute would
  hide the field until the plugin is updated.

## Uninstall

```sh
dsh plugin --profile web remove dsh-workspace-project-labels
```

## License

MIT
