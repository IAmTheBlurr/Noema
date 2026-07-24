<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<div data-theme="pine">
	{@render children()}
</div>
