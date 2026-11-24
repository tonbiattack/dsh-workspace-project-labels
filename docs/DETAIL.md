# Project labels in the session list

The sidebar's **In one list** view shows every session as one flat row. Without
a Workspace heading above them, a row tells you the session title but not which
project it belongs to. This plugin adds that missing piece: a colored chip with
the project's name, a filter, and GitHub counts.

## What it shows

Each session row gets a chip with the title of the Workspace that owns the
session's working directory. Hovering the chip shows the full directory path.
The chip is clipped to keep the row's time label readable; the tooltip always
carries the complete name.

Sessions whose working directory matches no registered Workspace show no chip,
so the row stays as it was.

## Filtering by project

A search field sits above the session list. Typing matches the Workspace title
and its folder name, case-insensitively, and dims every session that belongs to
another project.

Clicking a project chip filters to that project; clicking it again clears the
filter. **Esc** or the **×** button clears everything.

The filter dims rows rather than removing them. The host owns the row list and
exposes no filter hook, so removing rows would mean fighting its rendering.
Dimming keeps the list stable: selection, scrolling, and paging keep working,
and clearing the filter restores the list instantly.

## GitHub counts

When a project's git remote points at GitHub, the chip is followed by two
compact links: **I** for open issues and **P** for open pull requests, each
opening the matching list on github.com.

Counts come from the plugin's own Host endpoint, which reads the git remote of
each Workspace and asks the GitHub API. The token never reaches the browser: the
Client asks for counts, never for credentials.

- One request per repository per five minutes, shared by every session row of
  that project.
- A count of 100 or more is shown with a `+`, because the API page size caps the
  exact number.
- A project with no GitHub remote shows nothing. A rate limit, authentication
  failure, timeout, or offline state shows a dimmed dot whose tooltip names the
  reason; clicking it retries.
- Setting `enabled: false` on the plugin row turns the GitHub integration off
  while the labels and the filter keep working.

The Host resolves a token from `GITHUB_TOKEN` or `GH_TOKEN` in the environment,
then the DSH credentials store, then the `gh` CLI. Without a token, public
repositories still work at GitHub's anonymous rate limit.

## Colors

Every project gets its own color, derived from its position in the
creation-ordered Workspace list. The golden angle spreads successive projects
far apart on the hue wheel, and twenty lightness/saturation bands add a second
axis. Measured in CIE Lab, every pair of projects stays at least ΔE 14 apart, so
no two chips look alike.

The color survives a rename because it follows the Workspace, not its title.
Adding a project appends to the end of the order and leaves existing colors
untouched; removing one shifts the colors of every project after it.

The hue range skips the red band, which would read as an error state. The tint
is low-opacity and the text keeps the host's own color, so the chip stays
readable in both light and dark themes.

## How the Workspace is chosen

The plugin compares the session's working directory against every registered
Workspace path and picks the longest match. A session running in a nested
Workspace therefore shows the nested project, not its ancestor.

Paths are compared case-insensitively, matching how Windows treats them.

## Remote access

Everything is served from the same origin as the rest of the Web UI, so the
plugin renders identically when you reach the GUI through a tunnel, a reverse
proxy, or a VPN such as Tailscale.

## Limitations

- The chip reads the session's stored working directory. A session whose
  directory was never recorded shows no chip.
- The label is the Workspace title. Renaming a Workspace updates every chip that
  points at it.
- The filter dims rows; it does not remove them. A true filtered list needs a
  filter hook from the host, which DSH does not currently expose.
- GitHub counts cover the first 100 open items per repository. Beyond that the
  number is a lower bound shown with `+`.
- The filter bar is inserted into the sidebar's list area, which the host marks
  with `data-sidebar-list-area`. A DSH release that renames that attribute would
  hide the bar until the plugin is updated.
