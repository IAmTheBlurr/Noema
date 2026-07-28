import type {
	EntryDraft,
	Money,
	RecurrenceDetails,
	StandingRecordDetails,
	TemporalExpression
} from '$lib/domain/entry';

export interface ValidatedEntryInput {
	rawText: string;
	captureIntent: EntryDraft['captureIntent'];
	url: string | null;
	money: Money | null;
	notes: string | null;
	timeHorizon: string | null;
	temporal: TemporalExpression | null;
	standingRecord: StandingRecordDetails | null;
	recurrence: RecurrenceDetails | null;
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

function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateDate(value: string, field: string, errors: Record<string, string>): string | null {
	const trimmed = optionalTrimmed(value);
	if (trimmed && !isIsoDate(trimmed)) errors[field] = 'Enter a valid date.';
	return trimmed;
}

function validateUrl(value: string, field: string, errors: Record<string, string>): string | null {
	const trimmed = optionalTrimmed(value);
	if (!trimmed) return null;
	if (trimmed.length > 2_048) {
		errors[field] = 'Shorten to 2,048 characters.';
		return trimmed;
	}
	try {
		const parsed = new URL(trimmed);
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			errors[field] = 'Use HTTP or HTTPS.';
		}
	} catch {
		errors[field] = 'Enter a URL.';
	}
	return trimmed;
}

function moneyFromDraft(
	amountValue: string | number,
	currencyValue: string,
	errors: Record<string, string>
): Money | null {
	const amountText =
		typeof amountValue === 'number' ? String(amountValue) : amountValue.trim().replace(/,/g, '');
	if (amountText.length === 0) return null;
	const currency = currencyValue.trim().toUpperCase();
	if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(amountText)) {
		errors.amount = 'Use up to two decimals.';
		return null;
	}
	if (!/^[A-Z]{3}$/.test(currency)) {
		errors.currency = 'Use three letters.';
		return null;
	}
	const [whole, fraction = ''] = amountText.split('.');
	const minorUnits = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
	if (!Number.isSafeInteger(minorUnits) || minorUnits > 100_000_000_000_000) {
		errors.amount = 'Enter a smaller amount.';
		return null;
	}
	return { minorUnits, currency };
}

function dateTemporal(value: string | null): TemporalExpression | undefined {
	if (!value) return undefined;
	return {
		earliest: value,
		latest: value,
		precision: 'day',
		source: 'human',
		reviewedByUser: true
	};
}

function validateLifeTemporal(
	draft: EntryDraft,
	errors: Record<string, string>
): TemporalExpression | null {
	const rawText = optionalTrimmed(draft.temporalRawText);
	const earliest = validateDate(draft.temporalEarliest, 'temporalEarliest', errors);
	const latest = validateDate(draft.temporalLatest, 'temporalLatest', errors);
	if (rawText && rawText.length > 500) errors.temporalRawText = 'Shorten to 500 characters.';
	if (earliest && latest && earliest > latest) {
		errors.temporalLatest = 'Use a later date.';
	}
	const hasTemporal =
		Boolean(rawText || earliest || latest) ||
		draft.temporalPrecision !== 'unknown' ||
		draft.temporalReviewed;
	if (!hasTemporal) return null;
	return {
		...(rawText ? { rawText } : {}),
		...(earliest ? { earliest } : {}),
		...(latest ? { latest } : {}),
		precision: draft.temporalPrecision,
		source: 'human',
		reviewedByUser: draft.temporalReviewed
	};
}

function validateStanding(
	draft: EntryDraft,
	errors: Record<string, string>
): StandingRecordDetails | null {
	if (!draft.enableStanding && draft.captureIntent !== 'standing-record') return null;
	const valueText = optionalTrimmed(draft.standingValueText);
	const effectiveFrom = validateDate(draft.standingEffectiveFrom, 'standingEffectiveFrom', errors);
	const effectiveUntil = validateDate(
		draft.standingEffectiveUntil,
		'standingEffectiveUntil',
		errors
	);
	if (valueText && valueText.length > 2_000) {
		errors.standingValueText = 'Shorten to 2,000 characters.';
	}
	if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
		errors.standingEffectiveUntil = 'Use a later date.';
	}
	return {
		...(draft.standingSubjectHint ? { subjectHint: draft.standingSubjectHint } : {}),
		...(valueText ? { valueText } : {}),
		...(dateTemporal(effectiveFrom) ? { effectiveFrom: dateTemporal(effectiveFrom) } : {}),
		...(dateTemporal(effectiveUntil) ? { effectiveUntil: dateTemporal(effectiveUntil) } : {}),
		verificationStatus: draft.standingVerificationStatus,
		state: draft.standingState
	};
}

function validateRecurrence(
	draft: EntryDraft,
	errors: Record<string, string>
): RecurrenceDetails | null {
	if (!draft.enableRecurrence && draft.captureIntent !== 'recurring-commitment') return null;
	const dueDescription = optionalTrimmed(draft.dueDescription);
	const paymentSourceText = optionalTrimmed(draft.paymentSourceText);
	const cancellationUrl = validateUrl(draft.cancellationUrl, 'cancellationUrl', errors);
	const effectiveFrom = validateDate(
		draft.recurrenceEffectiveFrom,
		'recurrenceEffectiveFrom',
		errors
	);
	const effectiveUntil = validateDate(
		draft.recurrenceEffectiveUntil,
		'recurrenceEffectiveUntil',
		errors
	);
	const lastKnownCharge = validateDate(draft.lastKnownCharge, 'lastKnownCharge', errors);
	if (dueDescription && dueDescription.length > 500) {
		errors.dueDescription = 'Shorten to 500 characters.';
	}
	if (paymentSourceText && paymentSourceText.length > 500) {
		errors.paymentSourceText = 'Shorten to 500 characters.';
	}
	if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
		errors.recurrenceEffectiveUntil = 'Use a later date.';
	}

	const intervalText =
		typeof draft.recurrenceInterval === 'number'
			? String(draft.recurrenceInterval)
			: draft.recurrenceInterval.trim();
	let interval: number | undefined;
	if (intervalText) {
		const parsed = Number(intervalText);
		if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1_000) {
			errors.recurrenceInterval = 'Use a positive integer.';
		} else {
			interval = parsed;
		}
	}

	return {
		...(draft.recurringKind ? { recurringKind: draft.recurringKind } : {}),
		cadence: draft.recurrenceCadence,
		...(interval ? { interval } : {}),
		...(dueDescription ? { dueDescription } : {}),
		...(dateTemporal(effectiveFrom) ? { effectiveFrom: dateTemporal(effectiveFrom) } : {}),
		...(dateTemporal(effectiveUntil) ? { effectiveUntil: dateTemporal(effectiveUntil) } : {}),
		verificationStatus: draft.recurrenceVerificationStatus,
		activeState: draft.recurrenceActiveState,
		...(draft.autoRenew ? { autoRenew: true } : {}),
		...(paymentSourceText ? { paymentSourceText } : {}),
		...(cancellationUrl ? { cancellationUrl } : {}),
		...(dateTemporal(lastKnownCharge) ? { lastKnownCharge: dateTemporal(lastKnownCharge) } : {})
	};
}

export function validateEntryDraft(draft: EntryDraft): ValidationResult {
	const errors: Record<string, string> = {};
	const rawText = draft.rawText.trim();
	const url = validateUrl(draft.url, 'url', errors);
	const notes = optionalTrimmed(draft.notes);
	const timeHorizon = optionalTrimmed(draft.timeHorizon);
	const money = moneyFromDraft(draft.amount, draft.currency, errors);
	const temporal = validateLifeTemporal(draft, errors);
	const standingRecord = validateStanding(draft, errors);
	const recurrence = validateRecurrence(draft, errors);

	if (rawText.length === 0) errors.rawText = 'Enter text.';
	if (rawText.length > 10_000) errors.rawText = 'Shorten to 10,000 characters.';
	if (notes && notes.length > 20_000) errors.notes = 'Shorten to 20,000 characters.';
	if (timeHorizon && timeHorizon.length > 500) {
		errors.timeHorizon = 'Shorten to 500 characters.';
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors,
		value: {
			rawText,
			captureIntent: draft.captureIntent,
			url,
			money,
			notes,
			timeHorizon,
			temporal,
			standingRecord,
			recurrence
		}
	};
}
