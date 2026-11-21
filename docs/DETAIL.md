# Project labels in the session list

The sidebar's **In one list** view shows every session as one flat row. Without
a Workspace heading above them, a row tells you the session title but not which
project it belongs to. This plugin adds that missing piece: a small colored chip
on each row carrying the project's name.

## What it shows

Each session row gets a chip with the title of the Workspace that owns the
session's working directory. Hovering the chip shows the full directory path.
The chip is clipped to keep the row's time label readable; the tooltip always
carries the complete name.

Sessions whose working directory matches no registered Workspace show no chip,
so the row stays as it was.

## Colors

Every project gets a color from a fixed twelve-hue palette, chosen by hashing the
Workspace id. The color therefore survives a rename, and two projects can share
one: with 32 projects and 12 hues, collisions are expected. The chip's text is
the reliable identifier; the color is a scanning aid.

The palette skips the red band, which would read as an error state. The tint is
low-opacity and the text keeps the host's own color, so the chip stays readable
in both light and dark themes.

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
