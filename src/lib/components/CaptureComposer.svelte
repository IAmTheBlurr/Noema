<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown, Link2, Plus } from '@lucide/svelte';

	import { emptyEntryDraft, type EntryDraft } from '$lib/domain/entry';
	import { validateEntryDraft, type ValidatedEntryInput } from '$lib/validation/entry';

	let {
		disabled = false,
		onCreate
	}: {
		disabled?: boolean;
		onCreate: (input: ValidatedEntryInput) => Promise<void>;
	} = $props();

	let draft: EntryDraft = $state(emptyEntryDraft());
	let detailsOpen = $state(false);
	let submitting = $state(false);
	let errors: Readonly<Record<string, string>> = $state({});
	let submitError = $state('');

	onMount(() => document.querySelector<HTMLTextAreaElement>('#capture-text')?.focus());

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting || disabled) return;
		const result = validateEntryDraft(draft);
		errors = result.errors;
		if (!result.ok || !result.value) return;

		submitting = true;
		submitError = '';
		try {
			await onCreate(result.value);
			draft = emptyEntryDraft();
			detailsOpen = false;
			errors = {};
			requestAnimationFrame(() =>
				document.querySelector<HTMLTextAreaElement>('#capture-text')?.focus()
			);
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'The thought could not be kept.';
		} finally {
			submitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			if (event.currentTarget instanceof HTMLTextAreaElement) {
				event.currentTarget.form?.requestSubmit();
			}
		}
	}
</script>

<section class="capture-shell" aria-labelledby="capture-heading">
	<div class="capture-heading">
		<div>
			<p class="eyebrow">Quick capture</p>
			<h1 id="capture-heading">What is asking to be remembered?</h1>
		</div>
		<span class="shortcut-hint" aria-label="Keyboard shortcut Control or Command K">
			<span>⌘</span><span>K</span>
		</span>
	</div>

	<form onsubmit={submit} novalidate>
		<label class="sr-only" for="capture-text">Capture a thought</label>
		<textarea
			id="capture-text"
			name="thought"
			rows="3"
			placeholder="A purchase, a repair, a name, an obligation, a possibility…"
			bind:value={draft.rawText}
			onkeydown={handleKeydown}
			aria-describedby={errors.rawText ? 'capture-error' : 'capture-help'}
			aria-invalid={Boolean(errors.rawText)}
			{disabled}></textarea>
		<div class="capture-meta">
			<p id="capture-help">Only the thought is required. You can make sense of it later.</p>
			<span>{draft.rawText.length.toLocaleString()} / 10,000</span>
		</div>
		{#if errors.rawText}
			<p class="field-error" id="capture-error">{errors.rawText}</p>
		{/if}

		<div class="capture-actions">
			<button
				class="details-toggle"
				type="button"
				aria-expanded={detailsOpen}
				aria-controls="capture-details"
				onclick={() => (detailsOpen = !detailsOpen)}
			>
				<ChevronDown size={17} class={detailsOpen ? 'rotated' : ''} aria-hidden="true" />
				Optional details
				{#if draft.url || draft.amount || draft.notes || draft.timeHorizon}
					<span class="detail-dot" aria-label="Details added"></span>
				{/if}
			</button>
			<button class="primary-button" type="submit" disabled={submitting || disabled}>
				<Plus size={18} strokeWidth={2.25} aria-hidden="true" />
				{submitting ? 'Keeping…' : 'Keep thought'}
			</button>
		</div>
		{#if submitError}<p class="field-error" role="alert">{submitError}</p>{/if}

		{#if detailsOpen}
			<div class="optional-grid" id="capture-details">
				<label class="field wide">
					<span><Link2 size={15} aria-hidden="true" /> URL</span>
					<input
						type="url"
						placeholder="https://"
						bind:value={draft.url}
						aria-invalid={Boolean(errors.url)}
					/>
					{#if errors.url}<small class="field-error">{errors.url}</small>{/if}
				</label>
				<label class="field">
					<span>Approximate amount</span>
					<input
						type="number"
						min="0"
						step="any"
						inputmode="decimal"
						placeholder="0.00"
						bind:value={draft.amount}
						aria-invalid={Boolean(errors.amount)}
					/>
					{#if errors.amount}<small class="field-error">{errors.amount}</small>{/if}
				</label>
				<label class="field currency">
					<span>Currency</span>
					<input
						maxlength="3"
						autocomplete="off"
						bind:value={draft.currency}
						oninput={() => (draft.currency = draft.currency.toUpperCase())}
						aria-invalid={Boolean(errors.currency)}
					/>
					{#if errors.currency}<small class="field-error">{errors.currency}</small>{/if}
				</label>
				<label class="field wide">
					<span>Date or time horizon</span>
					<input
						type="text"
						placeholder="This autumn, before the trip, 2027…"
						bind:value={draft.timeHorizon}
						aria-invalid={Boolean(errors.timeHorizon)}
					/>
					{#if errors.timeHorizon}<small class="field-error">{errors.timeHorizon}</small>{/if}
				</label>
				<label class="field full">
					<span>Notes or justification</span>
					<textarea
						rows="3"
						placeholder="Why this matters, what is uncertain, anything worth preserving…"
						bind:value={draft.notes}
						aria-invalid={Boolean(errors.notes)}></textarea>
					{#if errors.notes}<small class="field-error">{errors.notes}</small>{/if}
				</label>
			</div>
		{/if}
	</form>
</section>
