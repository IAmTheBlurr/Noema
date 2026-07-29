<script lang="ts">
	import { onMount } from 'svelte';

	import EntryDetailsFields from '$lib/components/EntryDetailsFields.svelte';
	import { emptyEntryDraft, type CaptureIntent, type EntryDraft } from '$lib/domain/entry';
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
	const headings: Record<CaptureIntent, string> = {
		thought: 'Thought',
		'life-event': 'Life Event',
		'standing-record': 'Standing Record',
		'recurring-commitment': 'Recurring'
	};

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
			draft = emptyEntryDraft(draft.captureIntent);
			detailsOpen = false;
			errors = {};
			requestAnimationFrame(() =>
				document.querySelector<HTMLTextAreaElement>('#capture-text')?.focus()
			);
		} catch {
			submitError = 'Add failed. Retry.';
		} finally {
			submitting = false;
		}
	}

	function setIntent(intent: CaptureIntent): void {
		draft.captureIntent = intent;
		if (intent === 'standing-record') draft.enableStanding = true;
		if (intent === 'recurring-commitment') draft.enableRecurrence = true;
		errors = {};
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
		<h1 id="capture-heading">{headings[draft.captureIntent]}</h1>
	</div>

	<form onsubmit={submit} novalidate>
		<fieldset class="capture-form-fields" disabled={submitting || disabled}>
			<div class="intent-selector" role="radiogroup" aria-label="Capture Intent">
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
					onclick={() => setIntent('life-event')}>Life Event</button
				>
				<button
					type="button"
					role="radio"
					aria-checked={draft.captureIntent === 'standing-record'}
					class:active={draft.captureIntent === 'standing-record'}
					onclick={() => setIntent('standing-record')}>Standing Record</button
				>
				<button
					type="button"
					role="radio"
					aria-checked={draft.captureIntent === 'recurring-commitment'}
					class:active={draft.captureIntent === 'recurring-commitment'}
					onclick={() => setIntent('recurring-commitment')}>Recurring</button
				>
			</div>
			<label class="sr-only" for="capture-text">Entry</label>
			<textarea
				id="capture-text"
				name="thought"
				rows="3"
				bind:value={draft.rawText}
				onkeydown={handleKeydown}
				aria-describedby={errors.rawText ? 'capture-error' : undefined}
				aria-invalid={Boolean(errors.rawText)}></textarea>
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
					Details
				</button>
				<button class="primary-button" type="submit">
					{submitting ? 'Adding…' : 'Add'}
				</button>
			</div>
			{#if submitError}<p class="field-error" role="alert">{submitError}</p>{/if}

			{#if detailsOpen}
				<div id="capture-details">
					<EntryDetailsFields bind:draft {errors} />
				</div>
			{/if}
		</fieldset>
	</form>
</section>
