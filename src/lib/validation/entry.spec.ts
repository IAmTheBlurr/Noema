import { describe, expect, it } from 'vitest';

import { emptyEntryDraft } from '$lib/domain/entry';
import { validateEntryDraft } from '$lib/validation/entry';

describe('validateEntryDraft', () => {
	it('accepts an unplaced life event', () => {
		const draft = emptyEntryDraft('life-event');
		draft.rawText = 'Moved out of the camper';

		const result = validateEntryDraft(draft);

		expect(result.ok).toBe(true);
		expect(result.value?.temporal).toBeNull();
		expect(result.value?.captureIntent).toBe('life-event');
	});

	it('preserves approximate temporal text and bounds', () => {
		const draft = emptyEntryDraft('life-event');
		draft.rawText = 'Started the Rapid City lease';
		draft.temporalRawText = 'Sometime during winter 2023';
		draft.temporalEarliest = '2023-12-01';
		draft.temporalLatest = '2024-02-29';
		draft.temporalPrecision = 'season';
		draft.temporalReviewed = true;

		const result = validateEntryDraft(draft);

		expect(result.ok).toBe(true);
		expect(result.value?.temporal).toEqual({
			rawText: 'Sometime during winter 2023',
			earliest: '2023-12-01',
			latest: '2024-02-29',
			precision: 'season',
			source: 'human',
			reviewedByUser: true
		});
	});

	it('rejects reversed date ranges and invalid recurrence intervals', () => {
		const draft = emptyEntryDraft('recurring-commitment');
		draft.rawText = 'Adobe';
		draft.temporalEarliest = '2026-03-02';
		draft.temporalLatest = '2026-03-01';
		draft.recurrenceEffectiveFrom = '2026-04-01';
		draft.recurrenceEffectiveUntil = '2026-03-01';
		draft.recurrenceInterval = 0;

		const result = validateEntryDraft(draft);

		expect(result.ok).toBe(false);
		expect(result.errors.temporalLatest).toBe('Use a later date.');
		expect(result.errors.recurrenceEffectiveUntil).toBe('Use a later date.');
		expect(result.errors.recurrenceInterval).toBe('Use a positive integer.');
	});

	it('stores money as integer minor units', () => {
		const draft = emptyEntryDraft('standing-record');
		draft.rawText = 'Current rent';
		draft.amount = '1425.37';

		const result = validateEntryDraft(draft);

		expect(result.ok).toBe(true);
		expect(result.value?.money).toEqual({ minorUnits: 142_537, currency: 'USD' });
	});
});
