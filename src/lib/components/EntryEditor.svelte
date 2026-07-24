<script lang="ts">
	import { Archive, ArrowUpRight, RotateCcw, Sparkles, Trash2, X } from '@lucide/svelte';

	import { draftFromEntry, type Entry, type EntryDraft, type EntryEvent } from '$lib/domain/entry';
	import type { EntryReflectionResult } from '$lib/services/ai-client';
	import { validateEntryDraft, type ValidatedEntryInput } from '$lib/validation/entry';

	let {
		entry,
		events,
		eventsLoading,
		aiEnabled,
		onClose,
		onSave,
		onResurface,
		onArchive,
		onRestore,
		onTrash,
		onDelete,
		onReflect
	}: {
		entry: Entry;
		events: readonly EntryEvent[];
		eventsLoading: boolean;
		aiEnabled: boolean;
		onClose: () => void;
		onSave: (input: ValidatedEntryInput) => Promise<void>;
		onResurface: () => Promise<void>;
		onArchive: () => Promise<void>;
		onRestore: () => Promise<void>;
		onTrash: () => Promise<void>;
		onDelete: () => Promise<void>;
		onReflect: () => Promise<EntryReflectionResult>;
	} = $props();

	let draft: EntryDraft = $state(emptyDraft());
	let draftInitialized = $state(false);
	let errors: Readonly<Record<string, string>> = $state({});
	let saving = $state(false);
	let acting = $state(false);
	let deleteArmed = $state(false);
	let reflection: EntryReflectionResult | null = $state(null);

	function emptyDraft(): EntryDraft {
		return {
			rawText: '',
			url: '',
			amount: '',
			currency: 'USD',
			notes: '',
			timeHorizon: ''
		};
	}

	$effect(() => {
		if (!draftInitialized) {
			draft = draftFromEntry(entry);
			draftInitialized = true;
		}
	});

	const eventLabels: Record<EntryEvent['type'], string> = {
		created: 'Captured',
		edited: 'Edited',
		resurfaced: 'Remembered again',
		archived: 'Archived',
		restored: 'Restored',
		trashed: 'Moved to trash',
		restored_from_trash: 'Restored from trash'
	};

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const result = validateEntryDraft(draft);
		errors = result.errors;
		if (!result.ok || !result.value) return;
		saving = true;
		try {
			await onSave(result.value);
		} finally {
			saving = false;
		}
	}

	async function act(action: () => Promise<void>): Promise<void> {
		acting = true;
		try {
			await action();
		} finally {
			acting = false;
		}
	}

	async function reflect(): Promise<void> {
		acting = true;
		try {
			reflection = await onReflect();
		} finally {
			acting = false;
		}
	}

	function backdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) onClose();
	}
</script>

<div
	class="editor-backdrop"
	role="presentation"
	onclick={backdropClick}
	onkeydown={(event) => event.key === 'Escape' && onClose()}
>
	<div
		class="editor-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="editor-title"
		tabindex="-1"
	>
		<header class="editor-header">
			<div>
				<p class="eyebrow">{entry.status === 'active' ? 'Inbox entry' : entry.status}</p>
				<h2 id="editor-title">Review this thought</h2>
			</div>
			<button class="icon-button" type="button" aria-label="Close editor" onclick={onClose}>
				<X size={21} aria-hidden="true" />
			</button>
		</header>

		<div class="editor-scroll">
			<form class="editor-form" onsubmit={submit} novalidate>
				<label class="field full">
					<span>Original thought</span>
					<textarea rows="5" bind:value={draft.rawText} aria-invalid={Boolean(errors.rawText)}
					></textarea>
					{#if errors.rawText}<small class="field-error">{errors.rawText}</small>{/if}
				</label>
				<div class="editor-grid">
					<label class="field full">
						<span>URL</span>
						<input type="url" placeholder="https://" bind:value={draft.url} />
						{#if errors.url}<small class="field-error">{errors.url}</small>{/if}
					</label>
					<label class="field">
						<span>Approximate amount</span>
						<input type="number" min="0" step="any" bind:value={draft.amount} />
						{#if errors.amount}<small class="field-error">{errors.amount}</small>{/if}
					</label>
					<label class="field">
						<span>Currency</span>
						<input maxlength="3" bind:value={draft.currency} />
						{#if errors.currency}<small class="field-error">{errors.currency}</small>{/if}
					</label>
					<label class="field full">
						<span>Date or time horizon</span>
						<input bind:value={draft.timeHorizon} />
					</label>
					<label class="field full">
						<span>Notes or justification</span>
						<textarea rows="4" bind:value={draft.notes}></textarea>
						{#if errors.notes}<small class="field-error">{errors.notes}</small>{/if}
					</label>
				</div>
				<div class="editor-save">
					<p>Human-authored changes are recorded in history.</p>
					<button class="primary-button" type="submit" disabled={saving || acting}>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
				</div>
			</form>

			{#if entry.url}
				<!-- The user-supplied URL is validated as an external HTTP(S) link. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="source-link" href={entry.url} target="_blank" rel="noreferrer">
					<ArrowUpRight size={17} aria-hidden="true" /> Open saved link
				</a>
			{/if}

			<section class="editor-section" aria-labelledby="history-title">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Provenance</p>
						<h3 id="history-title">History</h3>
					</div>
					<span class="recurrence-total"
						>{entry.recurrenceCount} resurfacing{entry.recurrenceCount === 1 ? '' : 's'}</span
					>
				</div>
				{#if eventsLoading}
					<div class="history-skeleton" aria-label="Loading history"></div>
				{:else if events.length === 0}
					<p class="subtle-copy">History is unavailable.</p>
				{:else}
					<ol class="timeline">
						{#each events as event (event.id)}
							<li class:resurfaced={event.type === 'resurfaced'}>
								<span class="timeline-marker"></span>
								<div>
									<strong>{eventLabels[event.type]}</strong>
									<time datetime={event.occurredAt.toISOString()}>
										{event.occurredAt.toLocaleString()}
									</time>
									{#if event.changedFields.length}
										<small>{event.changedFields.join(', ')}</small>
									{/if}
									{#if event.revision}
										<details class="revision-details">
											<summary>View preserved version</summary>
											<p>{event.revision.rawText}</p>
											{#if event.revision.notes}<small>{event.revision.notes}</small>{/if}
										</details>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</section>

			{#if aiEnabled && entry.status !== 'trashed'}
				<section class="editor-section reflection-section" aria-labelledby="reflection-title">
					<div class="section-heading">
						<div>
							<p class="eyebrow">Developer preview · never saved</p>
							<h3 id="reflection-title">AI reflection seam</h3>
						</div>
						<button class="quiet-button" type="button" onclick={reflect} disabled={acting}>
							<Sparkles size={16} aria-hidden="true" />
							{reflection ? 'Reflect again' : 'Preview'}
						</button>
					</div>
					{#if reflection}
						<div class="reflection-card">
							<p>{reflection.reflection}</p>
							<ul>
								{#each reflection.questions as question (question)}<li>{question}</li>{/each}
							</ul>
							<small
								>{reflection.metadata.provider} · {reflection.metadata.model} · not persisted</small
							>
						</div>
					{:else}
						<p class="subtle-copy">
							A harmless, non-persisted preview verifies the human/AI boundary.
						</p>
					{/if}
				</section>
			{/if}

			<section class="editor-section action-section" aria-labelledby="actions-title">
				<p class="eyebrow">Lifecycle</p>
				<h3 id="actions-title">Entry actions</h3>
				<div class="lifecycle-actions">
					{#if entry.status !== 'trashed'}
						<button
							class="quiet-button"
							type="button"
							onclick={() => act(onResurface)}
							disabled={acting}
						>
							<RotateCcw size={16} aria-hidden="true" /> Remembered again
						</button>
					{/if}
					{#if entry.status === 'active'}
						<button
							class="quiet-button"
							type="button"
							onclick={() => act(onArchive)}
							disabled={acting}
						>
							<Archive size={16} aria-hidden="true" /> Archive
						</button>
					{:else}
						<button
							class="quiet-button"
							type="button"
							onclick={() => act(onRestore)}
							disabled={acting}
						>
							<RotateCcw size={16} aria-hidden="true" /> Restore to inbox
						</button>
					{/if}
					{#if entry.status !== 'trashed'}
						<button
							class="danger-button"
							type="button"
							onclick={() => act(onTrash)}
							disabled={acting}
						>
							<Trash2 size={16} aria-hidden="true" /> Move to trash
						</button>
					{:else if !deleteArmed}
						<button class="danger-button" type="button" onclick={() => (deleteArmed = true)}>
							<Trash2 size={16} aria-hidden="true" /> Permanently delete
						</button>
					{:else}
						<div class="delete-confirm">
							<div>
								<strong>Delete this entry and all its history?</strong>
								<span>This cannot be undone.</span>
							</div>
							<button type="button" onclick={() => (deleteArmed = false)}>Cancel</button>
							<button
								class="confirm-delete"
								type="button"
								onclick={() => act(onDelete)}
								disabled={acting}
							>
								{acting ? 'Deleting…' : 'Yes, permanently delete'}
							</button>
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>
