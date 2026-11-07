// Lua 5.1 / LuaJIT `table.sort`, reproduced exactly.
//
// Array.prototype.sort is stable; Lua's quicksort is not. Where a comparator
// has ties between distinguishable elements, the two disagree on the order,
// and that order can feed back into which card the AI plays. Using the same
// algorithm everywhere the Lua code calls table.sort keeps the TypeScript
// engine bit-for-bit identical to the reference. Sorts in place.

export function luaSort<T>(a: T[], lt: (x: T, y: T) => boolean): T[] {
	// 1-based accessors, so the body reads like lib_table.c's auxsort.
	const get = (k: number) => a[k - 1];
	const swap = (x: number, y: number) => {
		const t = a[x - 1];
		a[x - 1] = a[y - 1];
		a[y - 1] = t;
	};

	const auxsort = (l: number, u: number): void => {
		while (l < u) {
			// Sort a[l], a[(l+u)/2] and a[u].
			if (lt(get(u), get(l))) swap(l, u);
			if (u - l === 1) break;
			let i = Math.floor((l + u) / 2);
			if (lt(get(i), get(l))) {
				swap(i, l);
			} else if (lt(get(u), get(i))) {
				swap(i, u);
			}
			if (u - l === 2) break;
			const P = get(i);
			swap(i, u - 1);
			// a[l] <= P == a[u-1] <= a[u]; only sort l+1 .. u-2.
			i = l;
			let j = u - 1;
			for (;;) {
				while (lt(get(++i), P)) {
					if (i > u) throw new Error('invalid order function for sorting');
				}
				while (lt(P, get(--j))) {
					if (j < l) throw new Error('invalid order function for sorting');
				}
				if (j < i) break;
				swap(i, j);
			}
			swap(u - 1, i);
			// Recurse into the smaller half, loop on the larger.
			if (i - l < u - i) {
				j = l;
				i = i - 1;
				l = i + 2;
			} else {
				j = i + 1;
				i = u;
				u = j - 2;
			}
			auxsort(j, i);
		}
	};

	auxsort(1, a.length);
	return a;
}
