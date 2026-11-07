import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Version shown on the home screen: package.json's version plus the short
// commit hash (GITHUB_SHA in Actions, else the local checkout's HEAD).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
function commit(): string {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
	} catch {
		return '';
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	worker: { format: 'es' },
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__APP_COMMIT__: JSON.stringify(commit())
	}
});
