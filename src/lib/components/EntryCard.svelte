<script lang="ts">
	import { Archive, ArrowUpRight, Clock3, MoreHorizontal, RotateCcw, Trash2 } from '@lucide/svelte';

	import type { Entry } from '$lib/domain/entry';

	let {
		entry,
		busy = false,
		onOpen,
		onResurface,
		onArchive,
		onRestore,
		onTrash
	}: {
		entry: Entry;
		busy?: boolean;
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

	function formatMoney(amount: number, currency: string): string {
		try {
			return new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency,
				maximumFractionDigits: 2
			}).format(amount);
		} catch {
			return `${amount.toLocaleString()} ${currency}`;
		}
	}
</script>

<article class="entry-card" class:muted={entry.status !== 'active'}>
	<button class="card-main" type="button" onclick={() => onOpen(entry)}>
		<p class="entry-text">{entry.rawText}</p>
		<div class="entry-meta">
			<span title={entry.createdAt.toLocaleString()}>
				<Clock3 size={14} aria-hidden="true" />
				{dateFormatter.format(entry.createdAt)}
			</span>
			{#if entry.money}
				<span class="amount">{formatMoney(entry.money.amount, entry.money.currency)}</span>
			{/if}
			{#if entry.url}
				<span><ArrowUpRight size={14} aria-hidden="true" /> Link</span>
			{/if}
			{#if entry.timeHorizon}
				<span class="horizon">{entry.timeHorizon}</span>
			{/if}
		</div>
	</button>

	<div class="card-side">
		{#if entry.status !== 'trashed'}
			<button
				class="remember-button"
				type="button"
				title="I remembered this again"
				aria-label={`Remembered again. Current recurrence count ${entry.recurrenceCount}`}
				onclick={() => onResurface(entry)}
				disabled={busy}
			>
				<RotateCcw size={16} aria-hidden="true" />
				<span>{entry.recurrenceCount}</span>
			</button>
		{/if}

		<details class="card-menu">
			<summary aria-label="Entry actions">
				<MoreHorizontal size={19} aria-hidden="true" />
			</summary>
			<div class="menu-panel">
				{#if entry.status === 'active'}
					<button type="button" onclick={() => onArchive(entry)} disabled={busy}>
						<Archive size={16} aria-hidden="true" /> Archive
					</button>
				{:else}
					<button type="button" onclick={() => onRestore(entry)} disabled={busy}>
						<RotateCcw size={16} aria-hidden="true" /> Restore to inbox
					</button>
				{/if}
				{#if entry.status !== 'trashed'}
					<button
						class="danger-action"
						type="button"
						onclick={() => onTrash(entry)}
						disabled={busy}
					>
						<Trash2 size={16} aria-hidden="true" /> Move to trash
					</button>
				{/if}
			</div>
		</details>
	</div>
</article>
