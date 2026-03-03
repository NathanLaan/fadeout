import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _}
    from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class FadeOutPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // --- Behavior Group ---
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
        });
        page.add(behaviorGroup);

        // Enable/Disable switch
        const enableRow = new Adw.SwitchRow({
            title: _('Enable Dimming'),
            subtitle: _('Dim unfocused windows'),
        });
        settings.bind('enabled', enableRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(enableRow);

        // --- Appearance Group ---
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
        });
        page.add(appearanceGroup);

        // Fade factor slider
        const fadeRow = new Adw.ActionRow({
            title: _('Fade Out Factor'),
            subtitle: _('How much to dim unfocused windows'),
        });
        appearanceGroup.add(fadeRow);

        const fadeLabel = new Gtk.Label({
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
            width_chars: 4,
        });

        const fadeScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            digits: 0,
            draw_value: false,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
                page_increment: 10,
            }),
        });
        fadeScale.set_size_request(200, -1);

        // Add marks at 0%, 25%, 50%, 75%, 100%
        fadeScale.add_mark(0, Gtk.PositionType.BOTTOM, null);
        fadeScale.add_mark(25, Gtk.PositionType.BOTTOM, null);
        fadeScale.add_mark(50, Gtk.PositionType.BOTTOM, null);
        fadeScale.add_mark(75, Gtk.PositionType.BOTTOM, null);
        fadeScale.add_mark(100, Gtk.PositionType.BOTTOM, null);

        // Sync slider <-> settings
        const updateFadeLabel = () => {
            fadeLabel.label = `${Math.round(fadeScale.get_value())}%`;
        };

        fadeScale.set_value(settings.get_double('fade-factor') * 100);
        updateFadeLabel();

        fadeScale.connect('value-changed', () => {
            settings.set_double('fade-factor', fadeScale.get_value() / 100);
            updateFadeLabel();
        });
        settings.connect('changed::fade-factor', () => {
            fadeScale.set_value(settings.get_double('fade-factor') * 100);
            updateFadeLabel();
        });

        fadeRow.add_suffix(fadeScale);
        fadeRow.add_suffix(fadeLabel);

        // Animation duration
        const animRow = new Adw.SpinRow({
            title: _('Animation Duration'),
            subtitle: _('Fade animation duration in milliseconds'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 10,
                page_increment: 100,
            }),
        });
        settings.bind('animation-duration', animRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(animRow);

        window.set_default_size(450, 400);
    }
}
