<script lang="ts">
	import type { Entry, TemporalExpression } from '$lib/domain/entry';
	import type { LifeEventProjection } from '$lib/domain/projections';

	let {
		projection,
		onOpen
	}: {
		projection: LifeEventProjection;
		onOpen: (entry: Entry) => void;
	} = $props();

	function timeValue(temporal: TemporalExpression | null): string {
		if (!temporal) return 'Unknown';
		if (temporal.rawText) return temporal.rawText;
		if (temporal.earliest && temporal.latest && temporal.earliest !== temporal.latest) {
			return `${temporal.earliest} – ${temporal.latest}`;
		}
		return temporal.earliest ?? temporal.latest ?? 'Unknown';
	}
</script>

{#if projection.placed.length > 0}
	<section class="projection-section" aria-labelledby="dated-title">
		<h3 id="dated-title">Dated</h3>
		<div class="projection-list">
			{#each projection.placed as entry (entry.id)}
				<button class="projection-row" type="button" onclick={() => onOpen(entry)}>
					<span class="projection-value">{timeValue(entry.temporal)}</span>
					<strong>{entry.rawText}</strong>
					<span class="projection-status">{entry.temporal?.precision ?? 'unknown'}</span>
				</button>
			{/each}
		</div>
	</section>
{/if}

<section class="projection-section" aria-labelledby="unplaced-title">
	<h3 id="unplaced-title">Unplaced</h3>
	{#if projection.unplaced.length > 0}
		<div class="projection-list">
			{#each projection.unplaced as entry (entry.id)}
				<button class="projection-row" type="button" onclick={() => onOpen(entry)}>
					<span class="projection-value">{timeValue(entry.temporal)}</span>
					<strong>{entry.rawText}</strong>
					<span class="projection-status">{entry.temporal?.precision ?? 'unknown'}</span>
				</button>
			{/each}
		</div>
	{:else if projection.placed.length === 0}
		<p class="empty-inline">Empty</p>
	{/if}
</section>
