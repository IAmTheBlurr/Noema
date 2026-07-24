import type { EntryDraft, MoneyEstimate } from '$lib/domain/entry';

export interface ValidatedEntryInput {
	rawText: string;
	url: string | null;
	money: MoneyEstimate | null;
	notes: string | null;
	timeHorizon: string | null;
}

export interface ValidationResult {
	ok: boolean;
	errors: Readonly<Record<string, string>>;
	value?: ValidatedEntryInput;
}

function optionalTrimmed(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function validateEntryDraft(draft: EntryDraft): ValidationResult {
	const errors: Record<string, string> = {};
	const rawText = draft.rawText.trim();
	const url = optionalTrimmed(draft.url);
	const notes = optionalTrimmed(draft.notes);
	const timeHorizon = optionalTrimmed(draft.timeHorizon);
	const currency = draft.currency.trim().toUpperCase();
	// Svelte's numeric input binding yields a number at runtime even when the draft starts as text.
	const amountText = typeof draft.amount === 'number' ? String(draft.amount) : draft.amount.trim();

	if (rawText.length === 0) errors.rawText = 'Write the thought you want to keep.';
	if (rawText.length > 10_000) errors.rawText = 'Keep the thought under 10,000 characters.';
	if (notes && notes.length > 20_000) errors.notes = 'Keep notes under 20,000 characters.';
	if (timeHorizon && timeHorizon.length > 500)
		errors.timeHorizon = 'Keep the time horizon under 500 characters.';

	if (url) {
		try {
			const parsed = new URL(url);
			if (!['http:', 'https:'].includes(parsed.protocol)) {
				errors.url = 'Use an http or https URL.';
			}
		} catch {
			errors.url = 'Enter a complete URL, such as https://example.com.';
		}
	}

	let money: MoneyEstimate | null = null;
	if (amountText.length > 0) {
		const amount = Number(amountText);
		if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
			errors.amount = 'Enter a positive approximate amount.';
		} else if (!/^[A-Z]{3}$/.test(currency)) {
			errors.currency = 'Use a three-letter currency code.';
		} else {
			money = { amount, currency };
		}
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors,
		value: {
			rawText,
			url,
			money,
			notes,
			timeHorizon
		}
	};
}
