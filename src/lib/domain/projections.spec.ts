import { describe, expect, it } from 'vitest';

import type { Entry } from '$lib/domain/entry';
import {
	buildFinancialBaseline,
	normalizeMonthlyAmount,
	projectLifeEvents,
	projectUnverified,
	selectCurrentStandingRecord
} from '$lib/domain/projections';

function entry(id: string, patch: Partial<Entry> = {}): Entry {
	return {
		id,
		ownerId: 'user',
		rawText: id,
		captureIntent: 'thought',
		url: null,
		money: null,
		notes: null,
		timeHorizon: null,
		temporal: null,
		standingRecord: null,
		recurrence: null,
		status: 'active',
		recurrenceCount: 0,
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z'),
		archivedAt: null,
		trashedAt: null,
		schemaVersion: 2,
		...patch
	};
}

describe('normalizeMonthlyAmount', () => {
	it.each([
		['weekly', 43_333],
		['biweekly', 21_667],
		['semimonthly', 20_000],
		['monthly', 10_000],
		['quarterly', 3_333],
		['yearly', 833]
	] as const)('normalizes %s cadence', (cadence, expected) => {
		expect(normalizeMonthlyAmount({ minorUnits: 10_000, currency: 'USD' }, cadence)).toEqual({
			minorUnits: expected,
			currency: 'USD'
		});
	});

	it('excludes irregular and unknown cadence', () => {
		expect(normalizeMonthlyAmount({ minorUnits: 100, currency: 'USD' }, 'irregular')).toBeNull();
		expect(normalizeMonthlyAmount({ minorUnits: 100, currency: 'USD' }, 'unknown')).toBeNull();
	});
});

describe('standing and financial projections', () => {
	it('selects the latest current standing record', () => {
		const oldSalary = entry('old', {
			standingRecord: {
				subjectHint: 'salary',
				effectiveFrom: {
					earliest: '2025-01-01',
					latest: '2025-01-01',
					precision: 'day',
					source: 'human',
					reviewedByUser: true
				},
				verificationStatus: 'confirmed',
				state: 'current'
			}
		});
		const newSalary = entry('new', {
			standingRecord: {
				subjectHint: 'salary',
				effectiveFrom: {
					earliest: '2026-01-01',
					latest: '2026-01-01',
					precision: 'day',
					source: 'human',
					reviewedByUser: true
				},
				verificationStatus: 'confirmed',
				state: 'current'
			}
		});

		expect(selectCurrentStandingRecord([oldSalary, newSalary], 'salary')?.id).toBe('new');
	});

	it('separates confirmed and possible monthly outflow without currency conversion', () => {
		const confirmed = entry('rent', {
			money: { minorUnits: 120_000, currency: 'USD' },
			recurrence: {
				recurringKind: 'rent',
				cadence: 'monthly',
				verificationStatus: 'confirmed',
				activeState: 'active'
			}
		});
		const possible = entry('adobe', {
			money: { minorUnits: 12_000, currency: 'USD' },
			recurrence: {
				recurringKind: 'subscription',
				cadence: 'yearly',
				verificationStatus: 'suspected',
				activeState: 'possibly-active'
			}
		});
		const income = entry('paycheck', {
			money: { minorUnits: 200_000, currency: 'USD' },
			recurrence: {
				recurringKind: 'income',
				cadence: 'biweekly',
				verificationStatus: 'confirmed',
				activeState: 'active'
			}
		});

		const baseline = buildFinancialBaseline([confirmed, possible, income]);

		expect(baseline.confirmedMonthlyTotals).toEqual({ USD: 120_000 });
		expect(baseline.possibleMonthlyTotals).toEqual({ USD: 1_000 });
		expect(baseline.confirmedRecurring.map((item) => item.id)).toEqual(['rent']);
		expect(baseline.unverifiedSubscriptions.map((item) => item.id)).toEqual(['adobe']);
	});

	it('surfaces incomplete and conflicting records for verification', () => {
		const first = entry('salary-one', {
			standingRecord: {
				subjectHint: 'salary',
				verificationStatus: 'confirmed',
				state: 'current'
			}
		});
		const second = entry('salary-two', {
			standingRecord: {
				subjectHint: 'salary',
				verificationStatus: 'remembered',
				state: 'current'
			}
		});
		const subscription = entry('unknown-subscription', {
			recurrence: {
				recurringKind: 'subscription',
				cadence: 'unknown',
				verificationStatus: 'suspected',
				activeState: 'possibly-active'
			}
		});

		expect(
			projectUnverified([first, second, subscription])
				.map((item) => item.id)
				.sort()
		).toEqual(['salary-one', 'salary-two', 'unknown-subscription']);
	});
});

describe('life event projection', () => {
	it('orders dated events and retains an unplaced section', () => {
		const older = entry('older', {
			captureIntent: 'life-event',
			temporal: {
				earliest: '2022-08-01',
				latest: '2022-08-31',
				precision: 'month',
				source: 'human',
				reviewedByUser: true
			}
		});
		const newer = entry('newer', {
			captureIntent: 'life-event',
			temporal: {
				earliest: '2023-12-01',
				latest: '2024-02-29',
				precision: 'season',
				source: 'human',
				reviewedByUser: true
			}
		});
		const unplaced = entry('unplaced', { captureIntent: 'life-event' });

		const projection = projectLifeEvents([older, unplaced, newer]);

		expect(projection.placed.map((item) => item.id)).toEqual(['newer', 'older']);
		expect(projection.unplaced.map((item) => item.id)).toEqual(['unplaced']);
	});
});
