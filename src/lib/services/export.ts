import type { Entry, EntryEvent, Money } from '$lib/domain/entry';
import {
	buildFinancialBaseline,
	projectLifeEvents,
	projectSubscriptions,
	projectUnverified,
	verificationReasonsForCorpus
} from '$lib/domain/projections';

export interface ExportFile {
	path: string;
	content: string;
}

export interface ExportBundle {
	root: string;
	files: readonly ExportFile[];
}

export interface ExportOptions {
	now?: Date;
	appVersion: string;
	commit?: string;
}

function moneyJson(money: Money | null): Money | null {
	return money ? { minorUnits: money.minorUnits, currency: money.currency } : null;
}

function entryJson(entry: Entry) {
	return {
		id: entry.id,
		ownerId: entry.ownerId,
		rawText: entry.rawText,
		captureIntent: entry.captureIntent,
		url: entry.url,
		money: moneyJson(entry.money),
		notes: entry.notes,
		timeHorizon: entry.timeHorizon,
		temporal: entry.temporal,
		standingRecord: entry.standingRecord,
		recurrence: entry.recurrence,
		status: entry.status,
		recurrenceCount: entry.recurrenceCount,
		createdAt: entry.createdAt.toISOString(),
		updatedAt: entry.updatedAt.toISOString(),
		archivedAt: entry.archivedAt?.toISOString() ?? null,
		trashedAt: entry.trashedAt?.toISOString() ?? null,
		schemaVersion: entry.schemaVersion
	};
}

function eventJson(event: EntryEvent) {
	return {
		id: event.id,
		ownerId: event.ownerId,
		entryId: event.entryId,
		type: event.type,
		occurredAt: event.occurredAt.toISOString(),
		schemaVersion: event.schemaVersion,
		changedFields: [...event.changedFields],
		revision: event.revision
			? {
					rawText: event.revision.rawText,
					url: event.revision.url,
					money: moneyJson(event.revision.money),
					notes: event.revision.notes,
					timeHorizon: event.revision.timeHorizon
				}
			: null
	};
}

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function jsonl(values: readonly unknown[]): string {
	return values.map((value) => JSON.stringify(value)).join('\n') + (values.length > 0 ? '\n' : '');
}

function corpusMarkdown(entries: readonly Entry[], exportedAt: string): string {
	const lines = ['# Noema corpus', '', `Exported: ${exportedAt}`, ''];
	for (const entry of entries) {
		lines.push(`## ${entry.id}`, '', entry.rawText, '');
		lines.push(`- Intent: ${entry.captureIntent}`);
		lines.push(`- Status: ${entry.status}`);
		lines.push(`- Created: ${entry.createdAt.toISOString()}`);
		if (entry.temporal?.rawText) lines.push(`- When: ${entry.temporal.rawText}`);
		if (entry.temporal?.earliest) lines.push(`- Earliest: ${entry.temporal.earliest}`);
		if (entry.temporal?.latest) lines.push(`- Latest: ${entry.temporal.latest}`);
		if (entry.money) {
			lines.push(`- Amount: ${entry.money.currency} ${(entry.money.minorUnits / 100).toFixed(2)}`);
		}
		if (entry.url) lines.push(`- URL: ${entry.url}`);
		if (entry.notes) lines.push('', '### Notes', '', entry.notes);
		lines.push('');
	}
	return `${lines.join('\n')}\n`;
}

export function buildExportBundle(
	entriesInput: readonly Entry[],
	eventsInput: readonly EntryEvent[],
	options: ExportOptions
): ExportBundle {
	const now = options.now ?? new Date();
	const exportedAt = now.toISOString();
	const date = exportedAt.slice(0, 10);
	const root = `noema-export-${date}`;
	const entries = [...entriesInput].sort((left, right) => left.id.localeCompare(right.id));
	const events = [...eventsInput].sort(
		(left, right) =>
			left.entryId.localeCompare(right.entryId) ||
			left.occurredAt.valueOf() - right.occurredAt.valueOf() ||
			left.id.localeCompare(right.id)
	);
	const lifeEvents = projectLifeEvents(entries);
	const standingRecords = entries.filter((entry) => entry.standingRecord);
	const recurringCommitments = entries.filter((entry) => entry.recurrence);
	const subscriptions = projectSubscriptions(entries);
	const unverified = projectUnverified(entries);
	const baseline = buildFinancialBaseline(entries);

	const files: ExportFile[] = [
		{
			path: `${root}/manifest.json`,
			content: json({
				exportSchemaVersion: 1,
				exportedAt,
				appVersion: options.appVersion,
				...(options.commit ? { commit: options.commit } : {}),
				counts: {
					entries: entries.length,
					entryEvents: events.length,
					lifeEvents: lifeEvents.placed.length + lifeEvents.unplaced.length,
					standingRecords: standingRecords.length,
					recurringCommitments: recurringCommitments.length,
					subscriptions: subscriptions.length,
					unverifiedRecords: unverified.length
				}
			})
		},
		{
			path: `${root}/entries.jsonl`,
			content: jsonl(entries.map(entryJson))
		},
		{
			path: `${root}/entry-events.jsonl`,
			content: jsonl(events.map(eventJson))
		},
		{
			path: `${root}/corpus.md`,
			content: corpusMarkdown(entries, exportedAt)
		},
		{
			path: `${root}/views/life-events.json`,
			content: json({
				placed: lifeEvents.placed.map(entryJson),
				unplaced: lifeEvents.unplaced.map(entryJson)
			})
		},
		{
			path: `${root}/views/standing-records.json`,
			content: json(standingRecords.map(entryJson))
		},
		{
			path: `${root}/views/recurring-commitments.json`,
			content: json(recurringCommitments.map(entryJson))
		},
		{
			path: `${root}/views/subscriptions.json`,
			content: json(subscriptions.map(entryJson))
		},
		{
			path: `${root}/views/current-financial-baseline.json`,
			content: json({
				salary: baseline.salary ? entryJson(baseline.salary) : null,
				payFrequency: baseline.payFrequency ? entryJson(baseline.payFrequency) : null,
				rent: baseline.rent ? entryJson(baseline.rent) : null,
				confirmedRecurring: baseline.confirmedRecurring.map(entryJson),
				possibleRecurring: baseline.possibleRecurring.map(entryJson),
				confirmedSubscriptions: baseline.confirmedSubscriptions.map(entryJson),
				unverifiedSubscriptions: baseline.unverifiedSubscriptions.map(entryJson),
				confirmedMonthlyTotals: baseline.confirmedMonthlyTotals,
				possibleMonthlyTotals: baseline.possibleMonthlyTotals,
				missingValueEntryIds: baseline.missingValueEntryIds,
				verificationEntryIds: baseline.verificationEntryIds
			})
		},
		{
			path: `${root}/views/unverified-records.json`,
			content: json(
				unverified.map((entry) => ({
					entry: entryJson(entry),
					reasons: verificationReasonsForCorpus(entries, entry)
				}))
			)
		}
	];
	return { root, files };
}

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number): void {
	target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number): void {
	target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function dosTime(date: Date): { time: number; day: number } {
	const year = Math.max(1980, date.getUTCFullYear());
	return {
		time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
		day: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
	};
}

export function createStoredZip(files: readonly ExportFile[], modifiedAt = new Date()): Uint8Array {
	const encoder = new TextEncoder();
	const output: number[] = [];
	const central: number[] = [];
	const { time, day } = dosTime(modifiedAt);

	for (const file of files) {
		const name = encoder.encode(file.path);
		const content = encoder.encode(file.content);
		const checksum = crc32(content);
		const offset = output.length;

		writeUint32(output, 0x04034b50);
		writeUint16(output, 20);
		writeUint16(output, 0x0800);
		writeUint16(output, 0);
		writeUint16(output, time);
		writeUint16(output, day);
		writeUint32(output, checksum);
		writeUint32(output, content.length);
		writeUint32(output, content.length);
		writeUint16(output, name.length);
		writeUint16(output, 0);
		output.push(...name, ...content);

		writeUint32(central, 0x02014b50);
		writeUint16(central, 20);
		writeUint16(central, 20);
		writeUint16(central, 0x0800);
		writeUint16(central, 0);
		writeUint16(central, time);
		writeUint16(central, day);
		writeUint32(central, checksum);
		writeUint32(central, content.length);
		writeUint32(central, content.length);
		writeUint16(central, name.length);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint16(central, 0);
		writeUint32(central, 0);
		writeUint32(central, offset);
		central.push(...name);
	}

	const centralOffset = output.length;
	output.push(...central);
	writeUint32(output, 0x06054b50);
	writeUint16(output, 0);
	writeUint16(output, 0);
	writeUint16(output, files.length);
	writeUint16(output, files.length);
	writeUint32(output, central.length);
	writeUint32(output, centralOffset);
	writeUint16(output, 0);
	return Uint8Array.from(output);
}

export function downloadExport(bundle: ExportBundle, now = new Date()): void {
	const bytes = createStoredZip(bundle.files, now);
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const blob = new Blob([buffer], { type: 'application/zip' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `${bundle.root}.zip`;
	anchor.click();
	URL.revokeObjectURL(url);
}
