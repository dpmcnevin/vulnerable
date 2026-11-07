// Player settings, persisted in localStorage. Port of src/ui/settings.lua.

export type SettingKey = 'music' | 'sfx' | 'fourColor' | 'pixelCards' | 'rubberView';

const STORAGE_KEY = 'vulnerable.settings';
const DEFAULTS: Record<SettingKey, boolean> = {
	music: true,
	sfx: true,
	fourColor: true,
	pixelCards: true,
	rubberView: false
};

class Settings {
	music = $state(DEFAULTS.music);
	sfx = $state(DEFAULTS.sfx);
	fourColor = $state(DEFAULTS.fourColor);
	pixelCards = $state(DEFAULTS.pixelCards);
	rubberView = $state(DEFAULTS.rubberView);

	load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as Partial<Record<SettingKey, boolean>>;
			for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
				if (typeof saved[key] === 'boolean') this[key] = saved[key]!;
			}
		} catch {
			/* private mode or corrupt data: keep defaults */
		}
	}

	save() {
		try {
			const out: Record<string, boolean> = {};
			for (const key of Object.keys(DEFAULTS) as SettingKey[]) out[key] = this[key];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
		} catch {
			/* ignore */
		}
	}

	get(key: SettingKey): boolean {
		return this[key];
	}

	toggle(key: SettingKey): boolean {
		this[key] = !this[key];
		this.save();
		return this[key];
	}
}

export const settings = new Settings();
