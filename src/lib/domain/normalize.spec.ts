import { describe, expect, it } from 'vitest';

import { normalizeEntryDocument } from '$lib/domain/normalize';

describe('normalizeEntryDocument', () => {
	it('normalizes a legacy entry without migration', () => {
		const entry = normalizeEntryDocument('legacy', {
			ownerId: 'user',
			rawText: 'Legacy thought',
			money: { amount: 12.34, currency: 'USD' },
			status: 'active',
			recurrenceCount: 2,
			createdAt: new Date('2025-01-01T00:00:00.000Z'),
			updatedAt: new Date('2025-01-02T00:00:00.000Z'),
			schemaVersion: 1
		});

		expect(entry.captureIntent).toBe('thought');
		expect(entry.money).toEqual({ minorUnits: 1_234, currency: 'USD' });
		expect(entry.temporal).toBeNull();
		expect(entry.standingRecord).toBeNull();
		expect(entry.recurrence).toBeNull();
		expect(entry.schemaVersion).toBe(1);
	});

	it('normalizes sparse schema v2 capability blocks', () => {
		const entry = normalizeEntryDocument('current', {
			ownerId: 'user',
			rawText: 'Adobe may still be active',
			captureIntent: 'recurring-commitment',
			recurrence: {
				recurringKind: 'subscription',
				cadence: 'unknown',
				verificationStatus: 'suspected',
				activeState: 'possibly-active'
			},
			status: 'active',
			recurrenceCount: 0,
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			updatedAt: new Date('2026-01-01T00:00:00.000Z'),
			schemaVersion: 2
		});

		expect(entry.recurrence).toMatchObject({
			recurringKind: 'subscription',
			cadence: 'unknown',
			verificationStatus: 'suspected',
			activeState: 'possibly-active'
		});
		expect(entry.schemaVersion).toBe(2);
	});
});
