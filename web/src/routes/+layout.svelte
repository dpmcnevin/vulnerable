<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Vulnerable — a contract bridge roguelike</title>
	<meta name="description" content="A contract bridge roguelike: bid, declare, and build a relic engine across eight rubbers." />
</svelte:head>

{@render children()}
