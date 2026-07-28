<script lang="ts">
	import { MoreHorizontal } from '@lucide/svelte';

	import type { CaptureIntent, Entry, Money } from '$lib/domain/entry';

	let {
		entry,
		busy = false,
		markers = [],
		onOpen,
		onResurface,
		onArchive,
		onRestore,
		onTrash
	}: {
		entry: Entry;
		busy?: boolean;
		markers?: readonly string[];
		onOpen: (entry: Entry) => void;
		onResurface: (entry: Entry) => void;
		onArchive: (entry: Entry) => void;
		onRestore: (entry: Entry) => void;
		onTrash: (entry: Entry) => void;
	} = $props();

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	const intentLabels: Record<CaptureIntent, string> = {
		thought: 'Thought',
		'life-event': 'Event',
		'standing-record': 'Standing',
		'recurring-commitment': 'Recurring'
	};

	function formatMoney(money: Money): string {
		try {
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: money.currency,
				maximumFractionDigits: 2
			}).format(money.minorUnits / 100);
		} catch {
			return `${(money.minorUnits / 100).toLocaleString('en-US')} ${money.currency}`;
		}
	}
</script>

<article class="entry-card" class:muted={entry.status !== 'active'}>
	<button class="card-main" type="button" onclick={() => onOpen(entry)}>
		<p class="entry-text">{entry.rawText}</p>
		<div class="entry-meta">
			<span>{intentLabels[entry.captureIntent]}</span>
			<span>{dateFormatter.format(entry.createdAt)}</span>
			{#if entry.money}
				<span class="amount">{formatMoney(entry.money)}</span>
			{/if}
			{#if entry.temporal?.rawText || entry.timeHorizon}
				<span class="horizon">{entry.temporal?.rawText ?? entry.timeHorizon}</span>
			{:else if entry.temporal?.earliest}
				<span class="horizon">{entry.temporal.earliest}</span>
			{/if}
			{#if entry.recurrence}
				<span>{entry.recurrence.activeState}</span>
			{/if}
			{#each markers as marker (marker)}
				<span>{marker}</span>
			{/each}
		</div>
	</button>

	<div class="card-side">
		{#if entry.status !== 'trashed'}
			<button
				class="remember-button"
				type="button"
				onclick={() => onResurface(entry)}
				disabled={busy}
			>
				Repeat
			</button>
		{/if}

		<details class="card-menu">
			<summary aria-label="Actions">
				<MoreHorizontal size={19} aria-hidden="true" />
			</summary>
			<div class="menu-panel">
				{#if entry.status === 'active'}
					<button type="button" onclick={() => onArchive(entry)} disabled={busy}> Archive </button>
				{:else}
					<button type="button" onclick={() => onRestore(entry)} disabled={busy}> Restore </button>
				{/if}
				{#if entry.status !== 'trashed'}
					<button
						class="danger-action"
						type="button"
						onclick={() => onTrash(entry)}
						disabled={busy}
					>
						Delete
					</button>
				{/if}
			</div>
		</details>
	</div>
</article>
