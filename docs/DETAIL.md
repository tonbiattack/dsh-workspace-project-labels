# Project labels in the session list

The sidebar's **In one list** view shows every session as one flat row. Without
a Workspace heading above them, a row tells you the session title but not which
project it belongs to. This plugin adds that missing piece: a small colored chip
on each row carrying the project's name.

![The sidebar with a colored project chip on every session row](images/sidebar.png)

Each chip carries the project's name and its own color, so a glance down the
list tells you which project each session belongs to. Hovering a chip shows the
full directory path.

## What it shows

Each session row gets a chip with the title of the Workspace that owns the
session's working directory. Hovering the chip shows the full directory path.
The chip is clipped to keep the row's time label readable; the tooltip always
carries the complete name.

Sessions whose working directory matches no registered Workspace show no chip,
so the row stays as it was.

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

## Where it appears

The chip is contributed to the session row's trailing seat, which the sidebar
renders in every grouping mode. It is most useful in **In one list**, where no
Workspace heading supplies the context, and it stays out of the way in the
grouped views because the heading already names the project.

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
