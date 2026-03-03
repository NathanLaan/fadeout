import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';

const EFFECT_NAME = 'fadeout-dim';

const GLSL_DECLARATIONS = `
uniform float brightness;
`;

const GLSL_CODE = `
cogl_color_out.rgb = cogl_color_out.rgb * brightness;
`;

// --- GLSL Brightness Effect ---

const BrightnessEffect = GObject.registerClass({
    Properties: {
        'brightness': GObject.ParamSpec.float(
            'brightness', null, null,
            GObject.ParamFlags.READWRITE,
            0.0, 1.0, 1.0),
    },
}, class BrightnessEffect extends Shell.GLSLEffect {
    _init(params) {
        this._brightness = undefined;
        super._init(params);
        this._brightnessLocation = this.get_uniform_location('brightness');
        this.brightness = 1.0;
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT,
            GLSL_DECLARATIONS, GLSL_CODE, false);
    }

    get brightness() {
        return this._brightness;
    }

    set brightness(v) {
        if (this._brightness === v)
            return;
        this._brightness = v;
        this.set_uniform_float(this._brightnessLocation, 1, [v]);
        this.notify('brightness');
    }
});

// --- Panel Indicator ---

const FadeOutIndicator = GObject.registerClass(
class FadeOutIndicator extends PanelMenu.Button {
    _init(settings, extensionPath) {
        super._init(0.5, _('FadeOut'));

        this._settings = settings;

        // Panel icon
        const file = Gio.File.new_for_path(`${extensionPath}/icons/fadeout-symbolic.svg`);
        const gicon = new Gio.FileIcon({file});
        this._icon = new St.Icon({
            gicon,
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        // Enable/Disable toggle
        this._toggleItem = new PopupMenu.PopupSwitchMenuItem(
            _('Enable'), this._settings.get_boolean('enabled'));
        this._toggleItem.connect('toggled', (_item, state) => {
            this._settings.set_boolean('enabled', state);
        });
        this.menu.addMenuItem(this._toggleItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Fade factor slider
        this._sliderItem = new PopupMenu.PopupBaseMenuItem({activate: false});
        this._sliderItem.add_style_class_name('fadeout-slider-item');

        const sliderIcon = new St.Icon({
            icon_name: 'display-brightness-symbolic',
            style_class: 'popup-menu-icon',
        });
        this._sliderItem.add_child(sliderIcon);

        this._slider = new Slider.Slider(this._settings.get_double('fade-factor'));
        this._slider.connect('notify::value', () => {
            this._settings.set_double('fade-factor', this._slider.value);
            this._updateLabel();
        });
        this._sliderItem.add_child(this._slider);

        this._sliderLabel = new St.Label({
            style_class: 'fadeout-slider-label',
        });
        this._sliderItem.add_child(this._sliderLabel);
        this._updateLabel();

        this.menu.addMenuItem(this._sliderItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Preferences button
        this.menu.addAction(_('Preferences\u2026'), () => {
            this._openPreferences();
        });

        // Listen for settings changes from prefs window
        this._enabledChangedId = this._settings.connect('changed::enabled', () => {
            this._toggleItem.setToggleState(this._settings.get_boolean('enabled'));
        });
        this._factorChangedId = this._settings.connect('changed::fade-factor', () => {
            this._slider.value = this._settings.get_double('fade-factor');
            this._updateLabel();
        });
    }

    _updateLabel() {
        const pct = Math.round(this._slider.value * 100);
        this._sliderLabel.text = `${pct}%`;
    }

    _openPreferences() {
        const ext = Extension.lookupByURL(import.meta.url);
        ext.openPreferences();
    }

    destroy() {
        if (this._enabledChangedId) {
            this._settings.disconnect(this._enabledChangedId);
            this._enabledChangedId = 0;
        }
        if (this._factorChangedId) {
            this._settings.disconnect(this._factorChangedId);
            this._factorChangedId = 0;
        }
        super.destroy();
    }
});

// --- Main Extension ---

export default class FadeOutExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._signalIds = [];

        this._indicator = new FadeOutIndicator(
            this._settings, this.path);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Connect to focus changes
        this._connectSignal(global.display, 'notify::focus-window',
            () => this._onFocusChanged());

        // Connect to new windows
        this._connectSignal(global.display, 'window-created',
            (_display, window) => this._onWindowCreated(window));

        // Connect to overview show/hide
        this._connectSignal(Main.overview, 'showing',
            () => this._onOverviewShowing());
        this._connectSignal(Main.overview, 'hidden',
            () => this._onOverviewHidden());

        // Settings changes
        this._connectSignal(this._settings, 'changed::enabled',
            () => this._onEnabledChanged());
        this._connectSignal(this._settings, 'changed::fade-factor',
            () => this._onFadeFactorChanged());
        this._connectSignal(this._settings, 'changed::animation-duration',
            () => {});  // picked up dynamically

        this._overviewVisible = Main.overview.visible;

        // Apply to existing windows
        if (this._settings.get_boolean('enabled'))
            this._onFocusChanged();
    }

    disable() {
        // Remove all effects from all windows
        this._removeAllEffects();

        // Disconnect all signals
        for (const {obj, id} of this._signalIds)
            obj.disconnect(id);
        this._signalIds = [];

        // Destroy indicator
        this._indicator?.destroy();
        this._indicator = null;

        this._settings = null;
    }

    _connectSignal(obj, signal, callback) {
        const id = obj.connect(signal, callback);
        this._signalIds.push({obj, id});
    }

    _onFocusChanged() {
        if (!this._settings.get_boolean('enabled'))
            return;
        if (this._overviewVisible)
            return;

        const focusWindow = global.display.get_focus_window();
        const focusApp = focusWindow?.get_pid();

        for (const actor of global.get_window_actors()) {
            const meta = actor.get_meta_window();
            if (!meta)
                continue;

            // Only affect normal windows
            if (meta.get_window_type() !== Meta.WindowType.NORMAL &&
                meta.get_window_type() !== Meta.WindowType.DIALOG &&
                meta.get_window_type() !== Meta.WindowType.MODAL_DIALOG)
                continue;

            const isFocused = meta === focusWindow;

            // Keep transient dialogs of the focused app bright
            const isTransientOfFocused = !isFocused && focusWindow &&
                meta.get_pid() === focusApp &&
                (meta.get_window_type() === Meta.WindowType.DIALOG ||
                 meta.get_window_type() === Meta.WindowType.MODAL_DIALOG);

            if (isFocused || isTransientOfFocused)
                this._undimWindow(actor);
            else
                this._dimWindow(actor);
        }
    }

    _onWindowCreated(metaWindow) {
        // Wait for the window to be mapped so we have an actor
        const id = metaWindow.connect('first-frame', () => {
            metaWindow.disconnect(id);
            if (!this._settings?.get_boolean('enabled'))
                return;
            if (this._overviewVisible)
                return;

            const focusWindow = global.display.get_focus_window();
            if (metaWindow !== focusWindow) {
                const actor = metaWindow.get_compositor_private();
                if (actor)
                    this._dimWindow(actor);
            }
        });
    }

    _onOverviewShowing() {
        this._overviewVisible = true;
        this._removeAllEffects();
    }

    _onOverviewHidden() {
        this._overviewVisible = false;
        if (this._settings.get_boolean('enabled'))
            this._onFocusChanged();
    }

    _onEnabledChanged() {
        if (this._settings.get_boolean('enabled'))
            this._onFocusChanged();
        else
            this._removeAllEffects();
    }

    _onFadeFactorChanged() {
        if (!this._settings.get_boolean('enabled'))
            return;

        const fadeFactor = this._settings.get_double('fade-factor');
        const targetBrightness = 1.0 - fadeFactor;
        const duration = this._settings.get_int('animation-duration');

        for (const actor of global.get_window_actors()) {
            const effect = actor.get_effect(EFFECT_NAME);
            if (effect) {
                actor.ease_property(`@effects.${EFFECT_NAME}.brightness`,
                    targetBrightness, {
                        duration,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    });
            }
        }
    }

    _dimWindow(actor) {
        const fadeFactor = this._settings.get_double('fade-factor');
        const targetBrightness = 1.0 - fadeFactor;
        const duration = this._settings.get_int('animation-duration');

        let effect = actor.get_effect(EFFECT_NAME);
        if (!effect) {
            effect = new BrightnessEffect();
            effect.brightness = 1.0;
            actor.add_effect_with_name(EFFECT_NAME, effect);
        }

        // Cancel any in-progress animation and start new one
        actor.remove_transition(`@effects.${EFFECT_NAME}.brightness`);
        actor.ease_property(`@effects.${EFFECT_NAME}.brightness`,
            targetBrightness, {
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
    }

    _undimWindow(actor) {
        const effect = actor.get_effect(EFFECT_NAME);
        if (!effect)
            return;

        const duration = this._settings.get_int('animation-duration');

        // Cancel any in-progress animation and animate back to full brightness
        actor.remove_transition(`@effects.${EFFECT_NAME}.brightness`);
        actor.ease_property(`@effects.${EFFECT_NAME}.brightness`, 1.0, {
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                // Remove the effect entirely once fully bright
                actor.remove_effect_by_name(EFFECT_NAME);
            },
        });
    }

    _removeAllEffects() {
        for (const actor of global.get_window_actors()) {
            actor.remove_transition(`@effects.${EFFECT_NAME}.brightness`);
            actor.remove_effect_by_name(EFFECT_NAME);
        }
    }
}
