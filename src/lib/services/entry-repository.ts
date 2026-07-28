import {
	collection,
	deleteField,
	doc,
	getDoc,
	getDocs,
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
import { normalizeEntryDocument, normalizeEventDocument } from '$lib/domain/normalize';
import type { ValidatedEntryInput } from '$lib/validation/entry';

const ENTRY_LIMIT = 500;

function entryFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Entry {
	return normalizeEntryDocument(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' }));
}

function eventFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): EntryEvent {
	return normalizeEventDocument(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' }));
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

function revisionFromInput(input: ValidatedEntryInput): EntryRevision {
	return {
		rawText: input.rawText,
		url: input.url,
		money: input.money,
		notes: input.notes,
		timeHorizon: input.timeHorizon
	};
}

function createFields(input: ValidatedEntryInput) {
	return {
		rawText: input.rawText,
		captureIntent: input.captureIntent,
		url: input.url,
		money: input.money,
		notes: input.notes,
		timeHorizon: input.timeHorizon,
		...(input.temporal ? { temporal: input.temporal } : {}),
		...(input.standingRecord ? { standingRecord: input.standingRecord } : {}),
		...(input.recurrence ? { recurrence: input.recurrence } : {})
	};
}

function updateFields(input: ValidatedEntryInput) {
	return {
		rawText: input.rawText,
		captureIntent: input.captureIntent,
		url: input.url,
		money: input.money,
		notes: input.notes,
		timeHorizon: input.timeHorizon,
		temporal: input.temporal ?? deleteField(),
		standingRecord: input.standingRecord ?? deleteField(),
		recurrence: input.recurrence ?? deleteField(),
		schemaVersion: ENTRY_SCHEMA_VERSION,
		updatedAt: serverTimestamp()
	};
}

function differs(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) !== JSON.stringify(right);
}

function changedFieldNames(entry: Entry, input: ValidatedEntryInput): string[] {
	const candidates: ReadonlyArray<readonly [string, boolean]> = [
		['rawText', entry.rawText !== input.rawText],
		['captureIntent', entry.captureIntent !== input.captureIntent],
		['url', entry.url !== input.url],
		['money', differs(entry.money, input.money)],
		['notes', entry.notes !== input.notes],
		['timeHorizon', entry.timeHorizon !== input.timeHorizon],
		['temporal', differs(entry.temporal, input.temporal)],
		['standingRecord', differs(entry.standingRecord, input.standingRecord)],
		['recurrence', differs(entry.recurrence, input.recurrence)]
	];
	return candidates.filter(([, changed]) => changed).map(([field]) => field);
}

function structuredEventTypes(entry: Entry, input: ValidatedEntryInput): EntryEventType[] {
	const types = new Set<EntryEventType>();
	if (entry.captureIntent !== input.captureIntent) types.add('capture_intent_changed');
	if (differs(entry.temporal, input.temporal)) types.add('temporal_details_changed');
	if (differs(entry.standingRecord, input.standingRecord)) types.add('standing_record_changed');
	if (differs(entry.recurrence, input.recurrence)) types.add('recurrence_changed');

	if (
		entry.standingRecord?.verificationStatus !== input.standingRecord?.verificationStatus ||
		entry.recurrence?.verificationStatus !== input.recurrence?.verificationStatus
	) {
		types.add('verification_changed');
	}

	const wasEnded =
		entry.standingRecord?.state === 'ended' || entry.recurrence?.activeState === 'ended';
	const isEnded =
		input.standingRecord?.state === 'ended' || input.recurrence?.activeState === 'ended';
	if (!wasEnded && isEnded) types.add('record_ended');
	if (wasEnded && !isEnded) types.add('record_reactivated');
	return [...types];
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

	async loadAll(ownerId: string): Promise<readonly Entry[]> {
		const snapshot = await getDocs(
			query(collection(this.db, `users/${ownerId}/entries`), orderBy('createdAt', 'desc'))
		);
		return snapshot.docs.map(entryFromSnapshot);
	}

	async loadAllEvents(ownerId: string, entries: readonly Entry[]): Promise<readonly EntryEvent[]> {
		const groups = await Promise.all(
			entries.map(async (entry) => {
				const snapshot = await getDocs(
					query(
						collection(this.db, `users/${ownerId}/entries/${entry.id}/events`),
						orderBy('occurredAt', 'asc')
					)
				);
				return snapshot.docs.map(eventFromSnapshot);
			})
		);
		return groups.flat().sort((left, right) => {
			const entryOrder = left.entryId.localeCompare(right.entryId);
			return entryOrder !== 0
				? entryOrder
				: left.occurredAt.valueOf() - right.occurredAt.valueOf() || left.id.localeCompare(right.id);
		});
	}

	async create(ownerId: string, input: ValidatedEntryInput): Promise<string> {
		const entryRef = doc(collection(this.db, `users/${ownerId}/entries`));
		const eventRef = doc(collection(entryRef, 'events'));
		const batch = writeBatch(this.db);
		batch.set(entryRef, {
			ownerId,
			...createFields(input),
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
			revision: revisionFromInput(input)
		});
		await batch.commit();
		return entryRef.id;
	}

	async update(ownerId: string, entry: Entry, input: ValidatedEntryInput): Promise<void> {
		const changedFields = changedFieldNames(entry, input);
		if (changedFields.length === 0) return;

		const entryRef = doc(this.db, `users/${ownerId}/entries/${entry.id}`);
		const batch = writeBatch(this.db);
		batch.update(entryRef, updateFields(input));

		const humanFields = new Set(['rawText', 'url', 'money', 'notes', 'timeHorizon']);
		if (changedFields.some((field) => humanFields.has(field))) {
			batch.set(doc(collection(entryRef, 'events')), {
				...baseEvent(ownerId, entry.id, 'edited'),
				changedFields: changedFields.filter((field) => humanFields.has(field)),
				revision: revisionFromInput(input)
			});
		}
		for (const type of structuredEventTypes(entry, input)) {
			batch.set(doc(collection(entryRef, 'events')), {
				...baseEvent(ownerId, entry.id, type),
				changedFields
			});
		}
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
