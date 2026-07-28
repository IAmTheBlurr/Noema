<script lang="ts">
	import { X } from '@lucide/svelte';

	import EntryDetailsFields from '$lib/components/EntryDetailsFields.svelte';
	import {
		draftFromEntry,
		emptyEntryDraft,
		type CaptureIntent,
		type Entry,
		type EntryDraft,
		type EntryEvent
	} from '$lib/domain/entry';
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

	let draft: EntryDraft = $state(emptyEntryDraft());
	let draftInitialized = $state(false);
	let errors: Readonly<Record<string, string>> = $state({});
	let saving = $state(false);
	let acting = $state(false);
	let deleteArmed = $state(false);
	let reflection: EntryReflectionResult | null = $state(null);

	$effect(() => {
		if (!draftInitialized) {
			draft = draftFromEntry(entry);
			draftInitialized = true;
		}
	});

	const eventLabels: Record<EntryEvent['type'], string> = {
		created: 'Created',
		edited: 'Edited',
		resurfaced: 'Repeated',
		archived: 'Archived',
		restored: 'Restored',
		trashed: 'Deleted',
		restored_from_trash: 'Restored',
		capture_intent_changed: 'Intent changed',
		temporal_details_changed: 'Time changed',
		standing_record_changed: 'Standing changed',
		recurrence_changed: 'Recurrence changed',
		verification_changed: 'Verification changed',
		record_ended: 'Ended',
		record_reactivated: 'Reactivated'
	};

	function setIntent(intent: CaptureIntent): void {
		draft.captureIntent = intent;
		if (intent === 'standing-record') draft.enableStanding = true;
		if (intent === 'recurring-commitment') draft.enableRecurrence = true;
	}

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
			<h2 id="editor-title">Edit</h2>
			<button class="icon-button" type="button" aria-label="Close" onclick={onClose}>
				<X size={21} aria-hidden="true" />
			</button>
		</header>

		<div class="editor-scroll">
			<form class="editor-form" onsubmit={submit} novalidate>
				<div class="intent-selector" role="radiogroup" aria-label="Capture intent">
					<button
						type="button"
						role="radio"
						aria-checked={draft.captureIntent === 'thought'}
						class:active={draft.captureIntent === 'thought'}
						onclick={() => setIntent('thought')}>Thought</button
					>
					<button
						type="button"
						role="radio"
						aria-checked={draft.captureIntent === 'life-event'}
						class:active={draft.captureIntent === 'life-event'}
						onclick={() => setIntent('life-event')}>Life event</button
					>
					<button
						type="button"
						role="radio"
						aria-checked={draft.captureIntent === 'standing-record'}
						class:active={draft.captureIntent === 'standing-record'}
						onclick={() => setIntent('standing-record')}>Standing record</button
					>
					<button
						type="button"
						role="radio"
						aria-checked={draft.captureIntent === 'recurring-commitment'}
						class:active={draft.captureIntent === 'recurring-commitment'}
						onclick={() => setIntent('recurring-commitment')}>Recurring</button
					>
				</div>
				<label class="field full">
					<span>Entry</span>
					<textarea rows="5" bind:value={draft.rawText} aria-invalid={Boolean(errors.rawText)}
					></textarea>
					{#if errors.rawText}<small class="field-error">{errors.rawText}</small>{/if}
				</label>
				<EntryDetailsFields bind:draft {errors} />
				<div class="editor-save">
					<button class="primary-button" type="submit" disabled={saving || acting}>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>

			{#if entry.url}
				<!-- The user-supplied URL is validated as an external HTTP(S) link. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="source-link" href={entry.url} target="_blank" rel="noreferrer"> Open </a>
			{/if}

			<section class="editor-section" aria-labelledby="history-title">
				<div class="section-heading">
					<h3 id="history-title">History</h3>
				</div>
				{#if !eventsLoading && events.length > 0}
					<ol class="timeline">
						{#each events as event (event.id)}
							<li class:resurfaced={event.type === 'resurfaced'}>
								<span class="timeline-marker" aria-hidden="true"></span>
								<div>
									<strong>{eventLabels[event.type]}</strong>
									<time datetime={event.occurredAt.toISOString()}>
										{event.occurredAt.toLocaleString()}
									</time>
									{#if event.revision}
										<details class="revision-details">
											<summary>Version</summary>
											<p>{event.revision.rawText}</p>
											{#if event.revision.notes}<small>{event.revision.notes}</small>{/if}
										</details>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				{:else if !eventsLoading}
					<p class="subtle-copy">Empty</p>
				{/if}
			</section>

			{#if aiEnabled && entry.status !== 'trashed'}
				<section class="editor-section reflection-section" aria-labelledby="reflection-title">
					<div class="section-heading">
						<div>
							<h3 id="reflection-title">AI</h3>
						</div>
						<button class="quiet-button" type="button" onclick={reflect} disabled={acting}>
							Preview
						</button>
					</div>
					{#if reflection}
						<div class="reflection-card">
							<p>{reflection.reflection}</p>
							<ul>
								{#each reflection.questions as question (question)}<li>{question}</li>{/each}
							</ul>
							<small>{reflection.metadata.provider} · {reflection.metadata.model}</small>
						</div>
					{/if}
				</section>
			{/if}

			<section class="editor-section action-section">
				<div class="lifecycle-actions">
					{#if entry.status !== 'trashed'}
						<button
							class="quiet-button"
							type="button"
							onclick={() => act(onResurface)}
							disabled={acting}
						>
							Repeat
						</button>
					{/if}
					{#if entry.status === 'active'}
						<button
							class="quiet-button"
							type="button"
							onclick={() => act(onArchive)}
							disabled={acting}
						>
							Archive
						</button>
					{:else}
						<button
							class="quiet-button"
							type="button"
							onclick={() => act(onRestore)}
							disabled={acting}
						>
							Restore
						</button>
					{/if}
					{#if entry.status !== 'trashed'}
						<button
							class="danger-button"
							type="button"
							onclick={() => act(onTrash)}
							disabled={acting}
						>
							Delete
						</button>
					{:else if !deleteArmed}
						<button class="danger-button" type="button" onclick={() => (deleteArmed = true)}>
							Delete
						</button>
					{:else}
						<div class="delete-confirm">
							<button type="button" onclick={() => (deleteArmed = false)}>Cancel</button>
							<button
								class="confirm-delete"
								type="button"
								onclick={() => act(onDelete)}
								disabled={acting}
							>
								{acting ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>
