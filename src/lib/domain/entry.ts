export const ENTRY_SCHEMA_VERSION = 1 as const;

export type EntryStatus = 'active' | 'archived' | 'trashed';

export interface MoneyEstimate {
	amount: number;
	currency: string;
}

export interface Entry {
	id: string;
	ownerId: string;
	rawText: string;
	url: string | null;
	money: MoneyEstimate | null;
	notes: string | null;
	timeHorizon: string | null;
	status: EntryStatus;
	recurrenceCount: number;
	createdAt: Date;
	updatedAt: Date;
	archivedAt: Date | null;
	trashedAt: Date | null;
	schemaVersion: typeof ENTRY_SCHEMA_VERSION;
}

export interface EntryDraft {
	rawText: string;
	url: string;
	amount: string | number;
	currency: string;
	notes: string;
	timeHorizon: string;
}

export type EntryEventType =
	'created' | 'edited' | 'resurfaced' | 'archived' | 'restored' | 'trashed' | 'restored_from_trash';

export interface EntryEvent {
	id: string;
	ownerId: string;
	entryId: string;
	type: EntryEventType;
	occurredAt: Date;
	schemaVersion: typeof ENTRY_SCHEMA_VERSION;
	changedFields: readonly string[];
	revision: EntryRevision | null;
}

export interface EntryRevision {
	rawText: string;
	url: string | null;
	money: MoneyEstimate | null;
	notes: string | null;
	timeHorizon: string | null;
}

export function emptyEntryDraft(): EntryDraft {
	return {
		rawText: '',
		url: '',
		amount: '',
		currency: 'USD',
		notes: '',
		timeHorizon: ''
	};
}

export function draftFromEntry(entry: Entry): EntryDraft {
	return {
		rawText: entry.rawText,
		url: entry.url ?? '',
		amount: entry.money ? String(entry.money.amount) : '',
		currency: entry.money?.currency ?? 'USD',
		notes: entry.notes ?? '',
		timeHorizon: entry.timeHorizon ?? ''
	};
}
