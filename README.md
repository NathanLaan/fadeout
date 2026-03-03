# FadeOut

A GNOME Shell extension that dims unfocused windows, helping you focus on the task at hand.

## Requirements

Tested on Debian Linux. Works on Wayland and X11. Supports GNOME Shell 47, 48, and 49.

## Features

- Dims all windows except the currently focused one using a GLSL brightness shader
- Panel indicator with inline fade factor slider and enable/disable toggle
- Smooth animated transitions between focus changes
- GTK4/Adwaita preferences window
- Keeps transient dialogs of the focused app bright
- Automatically disables during the Activities overview
- Configurable fade amount (0–100%) and animation duration (0–1000ms)
- Settings persist across restarts via GSettings

## Requirements

- GNOME Shell 47, 48, or 49
- `glib-compile-schemas` (part of `libglib2.0-dev` or `libglib2.0-bin`)

## Development Setup

Clone the repo and symlink the extension into your local GNOME Shell extensions directory:

```sh
git clone https://github.com/laan/fadeout.git
cd fadeout
make dev
```

This compiles the GSettings schemas and creates a symlink at `~/.local/share/gnome-shell/extensions/fadeout@laan.dev/`.

**On Wayland**, log out and back in for GNOME Shell to detect the new extension. **On X11**, press Alt+F2, type `r`, and press Enter.

Then enable:

```sh
gnome-extensions enable fadeout@laan.dev
```

### Iterating

After editing `extension.js` or `stylesheet.css`, restart GNOME Shell to pick up changes:

- **Wayland**: Log out and back in
- **X11**: Alt+F2 → `r` → Enter

Changes to `prefs.js` take effect immediately — just reopen the preferences window.

If you modify the GSettings schema XML, recompile:

```sh
make schemas
```

### Viewing Logs

Extension errors and `log()` output go to the GNOME Shell journal:

```sh
journalctl -f -o cat /usr/bin/gnome-shell
```

## Install

### From source

```sh
make install
```

Copies the extension to `~/.local/share/gnome-shell/extensions/fadeout@laan.dev/`. Restart GNOME Shell, then enable:

```sh
gnome-extensions enable fadeout@laan.dev
```

### From .deb

Build the package:

```sh
make deb
```

Install it:

```sh
sudo dpkg -i gnome-shell-extension-fadeout_*.deb
```

This installs to `/usr/share/gnome-shell/extensions/fadeout@laan.dev/` and compiles the GSettings schemas automatically.

## Uninstall

### From source

```sh
make uninstall
```

### From .deb

```sh
sudo dpkg -r gnome-shell-extension-fadeout
```

## Settings

All settings can be changed from the panel dropdown menu or the preferences window (`gnome-extensions prefs fadeout@laan.dev`). They can also be set from the command line:

```sh
# Fade factor (0.0 = no dimming, 1.0 = fully black)
gsettings --schemadir fadeout@laan.dev/schemas set org.gnome.shell.extensions.fadeout fade-factor 0.6

# Animation duration in milliseconds
gsettings --schemadir fadeout@laan.dev/schemas set org.gnome.shell.extensions.fadeout animation-duration 300

# Enable/disable
gsettings --schemadir fadeout@laan.dev/schemas set org.gnome.shell.extensions.fadeout enabled true
```

## Project Structure

```
fadeout@laan.dev/
├── metadata.json          Extension metadata (UUID, shell versions)
├── extension.js           GLSL shader, focus tracking, panel indicator
├── prefs.js               GTK4/Adwaita preferences window
├── stylesheet.css         Panel indicator styling
├── icons/
│   └── fadeout-symbolic.svg
└── schemas/
    └── org.gnome.shell.extensions.fadeout.gschema.xml

debian/
├── control                Package metadata (name, depends, description)
├── changelog              Version history
├── copyright              License info in Debian format
├── rules                  Build rules (delegates to dh)
├── postinst               Runs glib-compile-schemas after install
└── postrm                 Cleans up compiled schemas on removal
```

The `debian/` directory contains the packaging metadata used by `make deb` to build a `.deb` file. The `postinst` and `postrm` scripts ensure GSettings schemas are compiled/cleaned automatically when the package is installed or removed.

## How It Works

FadeOut runs as a GNOME Shell extension inside Mutter's compositor process. This is the only way to dim individual windows on Wayland, where applications cannot modify other windows' properties.

When the focused window changes, the extension applies a `Shell.GLSLEffect` to each unfocused window actor. The GLSL fragment shader multiplies each pixel's RGB channels by a configurable brightness value (1.0 = normal, 0.0 = black). Transitions are animated using Clutter's `ease_property()` with an ease-out-quad curve.

## License

MIT
