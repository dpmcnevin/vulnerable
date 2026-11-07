// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {}
	/** package.json version, injected at build time (vite.config.ts). */
	const __APP_VERSION__: string;
	/** Short commit hash of the build, or '' if unknown. */
	const __APP_COMMIT__: string;
}

export {};
