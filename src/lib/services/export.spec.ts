import { describe, expect, it } from 'vitest';

import type { Entry, EntryEvent } from '$lib/domain/entry';
import { buildExportBundle, createStoredZip } from '$lib/services/export';

const entry: Entry = {
	id: 'entry-one',
	ownerId: 'user',
	rawText: 'I may still be paying for Adobe.',
	captureIntent: 'recurring-commitment',
	url: null,
	money: null,
	notes: 'Need to verify from USAA.',
	timeHorizon: null,
	temporal: null,
	standingRecord: null,
	recurrence: {
		recurringKind: 'subscription',
		cadence: 'unknown',
		verificationStatus: 'suspected',
		activeState: 'possibly-active'
	},
	status: 'active',
	recurrenceCount: 0,
	createdAt: new Date('2026-07-01T00:00:00.000Z'),
	updatedAt: new Date('2026-07-02T00:00:00.000Z'),
	archivedAt: null,
	trashedAt: null,
	schemaVersion: 2
};

const event: EntryEvent = {
	id: 'event-one',
	ownerId: 'user',
	entryId: 'entry-one',
	type: 'created',
	occurredAt: new Date('2026-07-01T00:00:00.000Z'),
	schemaVersion: 2,
	changedFields: [],
	revision: {
		rawText: entry.rawText,
		url: null,
		money: null,
		notes: entry.notes,
		timeHorizon: null
	}
};

describe('full corpus export', () => {
	it('creates canonical and derived UTF-8 files with valid JSONL', () => {
		const bundle = buildExportBundle([entry], [event], {
			now: new Date('2026-07-28T12:00:00.000Z'),
			appVersion: '0.1.0',
			commit: 'abc123'
		});

		expect(bundle.root).toBe('noema-export-2026-07-28');
		expect(bundle.files.map((file) => file.path)).toEqual([
			'noema-export-2026-07-28/manifest.json',
			'noema-export-2026-07-28/entries.jsonl',
			'noema-export-2026-07-28/entry-events.jsonl',
			'noema-export-2026-07-28/corpus.md',
			'noema-export-2026-07-28/views/life-events.json',
			'noema-export-2026-07-28/views/standing-records.json',
			'noema-export-2026-07-28/views/recurring-commitments.json',
			'noema-export-2026-07-28/views/subscriptions.json',
			'noema-export-2026-07-28/views/current-financial-baseline.json',
			'noema-export-2026-07-28/views/unverified-records.json'
		]);

		const entriesJsonl = bundle.files.find((file) => file.path.endsWith('/entries.jsonl'));
		const eventsJsonl = bundle.files.find((file) => file.path.endsWith('/entry-events.jsonl'));
		const parsedEntry = JSON.parse(entriesJsonl?.content.trim() ?? '');
		const parsedEvent = JSON.parse(eventsJsonl?.content.trim() ?? '');
		expect(parsedEntry.rawText).toBe(entry.rawText);
		expect(parsedEntry.recurrence.recurringKind).toBe('subscription');
		expect(parsedEvent.entryId).toBe(entry.id);
		expect(bundle.files.find((file) => file.path.endsWith('/corpus.md'))?.content).toContain(
			entry.notes
		);
	});

	it('writes a valid stored ZIP directory', () => {
		const bundle = buildExportBundle([entry], [event], {
			now: new Date('2026-07-28T12:00:00.000Z'),
			appVersion: '0.1.0'
		});
		const zip = createStoredZip(bundle.files, new Date('2026-07-28T12:00:00.000Z'));
		const view = new DataView(zip.buffer);

		expect(view.getUint32(0, true)).toBe(0x04034b50);
		expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
		expect(view.getUint16(zip.length - 12, true)).toBe(bundle.files.length);
	});
});
