import {
	collection,
	doc,
	getDoc,
	limit,
	onSnapshot,
	orderBy,
	query,
	runTransaction,
	serverTimestamp,
	writeBatch,
	type DocumentData,
	type Firestore,
	type QueryDocumentSnapshot
} from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';

import {
	ENTRY_SCHEMA_VERSION,
	type Entry,
	type EntryEvent,
	type EntryEventType,
	type EntryRevision,
	type EntryStatus
} from '$lib/domain/entry';
import type { ValidatedEntryInput } from '$lib/validation/entry';

const ENTRY_LIMIT = 500;

function asDate(value: unknown): Date | null {
	if (typeof value === 'object' && value !== null && 'toDate' in value) {
		const toDate = Reflect.get(value, 'toDate');
		if (typeof toDate === 'function') {
			const result = Reflect.apply(toDate, value, []);
			return result instanceof Date ? result : null;
		}
	}
	return null;
}

function asNullableString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function moneyFromUnknown(value: unknown) {
	const amount =
		typeof value === 'object' && value !== null ? Reflect.get(value, 'amount') : undefined;
	const currency =
		typeof value === 'object' && value !== null ? Reflect.get(value, 'currency') : undefined;
	return typeof amount === 'number' && typeof currency === 'string' ? { amount, currency } : null;
}

function revisionFromUnknown(value: unknown): EntryRevision | null {
	if (typeof value !== 'object' || value === null) return null;
	const rawText = Reflect.get(value, 'rawText');
	if (typeof rawText !== 'string' || rawText.length === 0) return null;
	return {
		rawText,
		url: asNullableString(Reflect.get(value, 'url')),
		money: moneyFromUnknown(Reflect.get(value, 'money')),
		notes: asNullableString(Reflect.get(value, 'notes')),
		timeHorizon: asNullableString(Reflect.get(value, 'timeHorizon'))
	};
}

function entryFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Entry {
	const data = snapshot.data({ serverTimestamps: 'estimate' });
	const createdAt = asDate(data.createdAt) ?? new Date();

	return {
		id: snapshot.id,
		ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
		rawText: typeof data.rawText === 'string' ? data.rawText : '',
		url: asNullableString(data.url),
		money: moneyFromUnknown(data.money),
		notes: asNullableString(data.notes),
		timeHorizon: asNullableString(data.timeHorizon),
		status: data.status === 'archived' || data.status === 'trashed' ? data.status : 'active',
		recurrenceCount: typeof data.recurrenceCount === 'number' ? data.recurrenceCount : 0,
		createdAt,
		updatedAt: asDate(data.updatedAt) ?? createdAt,
		archivedAt: asDate(data.archivedAt),
		trashedAt: asDate(data.trashedAt),
		schemaVersion: ENTRY_SCHEMA_VERSION
	};
}

function isEntryEventType(value: unknown): value is EntryEventType {
	return (
		value === 'created' ||
		value === 'edited' ||
		value === 'resurfaced' ||
		value === 'archived' ||
		value === 'restored' ||
		value === 'trashed' ||
		value === 'restored_from_trash'
	);
}

function eventFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): EntryEvent {
	const data = snapshot.data({ serverTimestamps: 'estimate' });
	return {
		id: snapshot.id,
		ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
		entryId: typeof data.entryId === 'string' ? data.entryId : '',
		type: isEntryEventType(data.type) ? data.type : 'created',
		occurredAt: asDate(data.occurredAt) ?? new Date(),
		schemaVersion: ENTRY_SCHEMA_VERSION,
		changedFields: Array.isArray(data.changedFields)
			? data.changedFields.filter((value): value is string => typeof value === 'string')
			: [],
		revision: revisionFromUnknown(data.revision)
	};
}

function baseEvent(ownerId: string, entryId: string, type: EntryEventType) {
	return {
		ownerId,
		entryId,
		type,
		occurredAt: serverTimestamp(),
		schemaVersion: ENTRY_SCHEMA_VERSION
	};
}

export class FirestoreEntryRepository {
	constructor(
		private readonly db: Firestore,
		private readonly functions: Functions
	) {}

	subscribe(
		ownerId: string,
		onEntries: (entries: readonly Entry[]) => void,
		onError: (error: Error) => void
	): () => void {
		const entriesQuery = query(
			collection(this.db, `users/${ownerId}/entries`),
			orderBy('createdAt', 'desc'),
			limit(ENTRY_LIMIT)
		);
		return onSnapshot(
			entriesQuery,
			{ includeMetadataChanges: true },
			(snapshot) => onEntries(snapshot.docs.map(entryFromSnapshot)),
			onError
		);
	}

	subscribeEvents(
		ownerId: string,
		entryId: string,
		onEvents: (events: readonly EntryEvent[]) => void,
		onError: (error: Error) => void
	): () => void {
		const eventsQuery = query(
			collection(this.db, `users/${ownerId}/entries/${entryId}/events`),
			orderBy('occurredAt', 'desc'),
			limit(100)
		);
		return onSnapshot(
			eventsQuery,
			(snapshot) => onEvents(snapshot.docs.map(eventFromSnapshot)),
			onError
		);
	}

	async create(ownerId: string, input: ValidatedEntryInput): Promise<string> {
		const entryRef = doc(collection(this.db, `users/${ownerId}/entries`));
		const eventRef = doc(collection(entryRef, 'events'));
		const batch = writeBatch(this.db);
		batch.set(entryRef, {
			ownerId,
			...input,
			status: 'active',
			recurrenceCount: 0,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
			archivedAt: null,
			trashedAt: null,
			schemaVersion: ENTRY_SCHEMA_VERSION
		});
		batch.set(eventRef, {
			...baseEvent(ownerId, entryRef.id, 'created'),
			revision: input
		});
		await batch.commit();
		return entryRef.id;
	}

	async update(ownerId: string, entry: Entry, input: ValidatedEntryInput): Promise<void> {
		const candidateFields: Array<string | null> = [
			entry.rawText !== input.rawText ? 'rawText' : null,
			entry.url !== input.url ? 'url' : null,
			JSON.stringify(entry.money) !== JSON.stringify(input.money) ? 'money' : null,
			entry.notes !== input.notes ? 'notes' : null,
			entry.timeHorizon !== input.timeHorizon ? 'timeHorizon' : null
		];
		const changedFields = candidateFields.filter((field): field is string => field !== null);
		if (changedFields.length === 0) return;

		const entryRef = doc(this.db, `users/${ownerId}/entries/${entry.id}`);
		const eventRef = doc(collection(entryRef, 'events'));
		const batch = writeBatch(this.db);
		batch.update(entryRef, { ...input, updatedAt: serverTimestamp() });
		batch.set(eventRef, {
			...baseEvent(ownerId, entry.id, 'edited'),
			changedFields,
			revision: input
		});
		await batch.commit();
	}

	async resurface(ownerId: string, entryId: string): Promise<void> {
		const entryRef = doc(this.db, `users/${ownerId}/entries/${entryId}`);
		const eventRef = doc(collection(entryRef, 'events'));
		await runTransaction(this.db, async (transaction) => {
			const snapshot = await transaction.get(entryRef);
			if (!snapshot.exists()) throw new Error('Entry no longer exists.');
			const current = snapshot.get('recurrenceCount');
			const recurrenceCount = typeof current === 'number' ? current : 0;
			transaction.update(entryRef, {
				recurrenceCount: recurrenceCount + 1,
				updatedAt: serverTimestamp()
			});
			transaction.set(eventRef, baseEvent(ownerId, entryId, 'resurfaced'));
		});
	}

	async changeStatus(
		ownerId: string,
		entryId: string,
		status: EntryStatus,
		previousStatus: EntryStatus
	): Promise<void> {
		const entryRef = doc(this.db, `users/${ownerId}/entries/${entryId}`);
		const eventRef = doc(collection(entryRef, 'events'));
		const type: EntryEventType =
			status === 'archived'
				? 'archived'
				: status === 'trashed'
					? 'trashed'
					: previousStatus === 'trashed'
						? 'restored_from_trash'
						: 'restored';
		const batch = writeBatch(this.db);
		batch.update(entryRef, {
			status,
			updatedAt: serverTimestamp(),
			archivedAt: status === 'archived' ? serverTimestamp() : null,
			trashedAt: status === 'trashed' ? serverTimestamp() : null
		});
		batch.set(eventRef, baseEvent(ownerId, entryId, type));
		await batch.commit();
	}

	async permanentlyDelete(ownerId: string, entryId: string): Promise<void> {
		const entryRef = doc(this.db, `users/${ownerId}/entries/${entryId}`);
		const snapshot = await getDoc(entryRef);
		if (!snapshot.exists() || snapshot.get('ownerId') !== ownerId) {
			throw new Error('Entry not found.');
		}
		const call = httpsCallable<{ entryId: string }, { deleted: boolean }>(
			this.functions,
			'permanentlyDeleteEntry'
		);
		await call({ entryId });
	}
}
