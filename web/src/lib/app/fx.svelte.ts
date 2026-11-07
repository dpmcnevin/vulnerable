// Particles and screen shake. Port of the effects half of src/ui/anim.lua.
// Particles live in a plain array drawn by Particles.svelte's canvas; the
// shake offset is reactive so the stage can follow it.

import { css, type Color } from '../ui/theme.ts';

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
	rot: number;
	spin: number;
	color: string;
	gravity: number;
}

export interface BurstOpts {
	life?: number;
	size?: number;
	lift?: number;
	gravity?: number;
}

class Fx {
	particles: Particle[] = [];
	shakeAmount = 0;
	shakeX = $state(0);
	shakeY = $state(0);

	/** A burst of confetti-like particles at stage coordinates. */
	burst(x: number, y: number, count: number, colors: Color[], speed = 260, opts: BurstOpts = {}) {
		const rnd = Math.random;
		for (let i = 0; i < count; i++) {
			const a = rnd() * Math.PI * 2;
			const v = speed * (0.35 + rnd() * 0.65);
			this.particles.push({
				x,
				y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v - (opts.lift ?? 120),
				life: 0,
				maxLife: (opts.life ?? 0.9) * (0.6 + rnd() * 0.6),
				size: (opts.size ?? 7) * (0.6 + rnd() * 0.8),
				rot: rnd() * Math.PI,
				spin: (rnd() * 2 - 1) * 10,
				color: css(colors[Math.floor(rnd() * colors.length)]),
				gravity: opts.gravity ?? 520
			});
		}
	}

	shake(amount: number) {
		this.shakeAmount = Math.max(this.shakeAmount, amount);
	}

	update(dt: number) {
		const ps = this.particles;
		for (let i = ps.length - 1; i >= 0; i--) {
			const p = ps[i];
			p.life += dt;
			if (p.life >= p.maxLife) {
				ps.splice(i, 1);
				continue;
			}
			p.vy += p.gravity * dt;
			p.vx *= 1 - 1.5 * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.spin * dt;
		}
		this.shakeAmount *= Math.exp(-9 * dt);
		if (this.shakeAmount < 0.1) {
			if (this.shakeX !== 0 || this.shakeY !== 0) {
				this.shakeX = 0;
				this.shakeY = 0;
			}
		} else {
			this.shakeX = (Math.random() * 2 - 1) * this.shakeAmount;
			this.shakeY = (Math.random() * 2 - 1) * this.shakeAmount;
		}
	}

	draw(g: CanvasRenderingContext2D) {
		for (const p of this.particles) {
			g.globalAlpha = 1 - p.life / p.maxLife;
			g.fillStyle = p.color;
			g.save();
			g.translate(p.x, p.y);
			g.rotate(p.rot);
			g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
			g.restore();
		}
		g.globalAlpha = 1;
	}

	clear() {
		this.particles = [];
	}
}

export const fx = new Fx();
