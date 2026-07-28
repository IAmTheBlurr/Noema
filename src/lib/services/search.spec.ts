import { describe, expect, it } from 'vitest';

import type { Entry } from '$lib/domain/entry';
import { boundedClientSearch } from './search';

const entry: Entry = {
	id: 'one',
	ownerId: 'user',
	rawText: 'Replace oxygen sensors on the Dakota',
	captureIntent: 'thought',
	url: null,
	money: { minorUnits: 24_000, currency: 'USD' },
	notes: 'Before the long trip',
	timeHorizon: 'this autumn',
	temporal: null,
	standingRecord: null,
	recurrence: null,
	status: 'active',
	recurrenceCount: 1,
	createdAt: new Date('2026-07-01T00:00:00Z'),
	updatedAt: new Date('2026-07-01T00:00:00Z'),
	archivedAt: null,
	trashedAt: null,
	schemaVersion: 1
};

describe('boundedClientSearch', () => {
	it('matches normalized text across optional fields', () => {
		expect(boundedClientSearch.search([entry], 'DAKOTA autumn')).toEqual([entry]);
		expect(boundedClientSearch.search([entry], '240 usd')).toEqual([entry]);
	});

	it('requires every search term', () => {
		expect(boundedClientSearch.search([entry], 'Dakota earbuds')).toEqual([]);
	});
});
