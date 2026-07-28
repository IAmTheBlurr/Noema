import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
	type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	setDoc,
	Timestamp,
	updateDoc
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-life-corpus';
let environment: RulesTestEnvironment;

function validEntry(ownerId: string) {
	const now = Timestamp.now();
	return {
		ownerId,
		rawText: 'A thought worth preserving',
		url: null,
		money: null,
		notes: null,
		timeHorizon: null,
		status: 'active',
		recurrenceCount: 0,
		createdAt: now,
		updatedAt: now,
		archivedAt: null,
		trashedAt: null,
		schemaVersion: 1
	};
}

function validStructuredEntry(ownerId: string) {
	return {
		...validEntry(ownerId),
		captureIntent: 'recurring-commitment',
		money: { minorUnits: 1299, currency: 'USD' },
		temporal: {
			rawText: 'August 2022',
			earliest: '2022-08-01',
			latest: '2022-08-31',
			precision: 'month',
			source: 'human',
			reviewedByUser: true
		},
		standingRecord: {
			subjectHint: 'rent',
			valueText: 'Current rent',
			verificationStatus: 'confirmed',
			state: 'current'
		},
		recurrence: {
			recurringKind: 'subscription',
			cadence: 'monthly',
			interval: 1,
			verificationStatus: 'suspected',
			activeState: 'possibly-active',
			autoRenew: true
		},
		schemaVersion: 2
	};
}

async function seedEntry(ownerId: string, entryId = 'entry-one'): Promise<void> {
	await environment.withSecurityRulesDisabled(async (context) => {
		await setDoc(
			doc(context.firestore(), `users/${ownerId}/entries/${entryId}`),
			validEntry(ownerId)
		);
	});
}

beforeAll(async () => {
	environment = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: {
			host: '127.0.0.1',
			port: 8080,
			rules: readFileSync(resolve('firebase/firestore.rules'), 'utf8')
		}
	});
});

beforeEach(async () => {
	await environment.clearFirestore();
});

afterAll(async () => {
	await environment.cleanup();
});

describe('Life Corpus Firestore isolation', () => {
	it('denies unauthenticated reads and writes', async () => {
		await seedEntry('alice');
		const db = environment.unauthenticatedContext().firestore();

		await assertFails(getDoc(doc(db, 'users/alice/entries/entry-one')));
		await assertFails(setDoc(doc(db, 'users/alice/entries/new-entry'), validEntry('alice')));
	});

	it('allows an owner to create and read a valid entry', async () => {
		const db = environment.authenticatedContext('alice').firestore();
		const entryRef = doc(collection(db, 'users/alice/entries'), 'new-entry');

		await assertSucceeds(setDoc(entryRef, validEntry('alice')));
		await assertSucceeds(getDoc(entryRef));
	});

	it('accepts valid sparse structured fields', async () => {
		const db = environment.authenticatedContext('alice').firestore();
		const entryRef = doc(collection(db, 'users/alice/entries'), 'structured');

		await assertSucceeds(setDoc(entryRef, validStructuredEntry('alice')));
		await assertSucceeds(getDoc(entryRef));
	});

	it('denies cross-user reads and writes', async () => {
		await seedEntry('alice');
		const bob = environment.authenticatedContext('bob').firestore();

		await assertFails(getDoc(doc(bob, 'users/alice/entries/entry-one')));
		await assertFails(setDoc(doc(bob, 'users/alice/entries/intrusion'), validEntry('alice')));
	});

	it('denies owner reassignment and direct deletion', async () => {
		await seedEntry('alice');
		const alice = environment.authenticatedContext('alice').firestore();
		const entryRef = doc(alice, 'users/alice/entries/entry-one');

		await assertFails(updateDoc(entryRef, { ownerId: 'bob' }));
		await assertFails(deleteDoc(entryRef));
	});

	it('allows append-only valid events and rejects event mutation', async () => {
		await seedEntry('alice');
		const alice = environment.authenticatedContext('alice').firestore();
		const eventRef = doc(alice, 'users/alice/entries/entry-one/events/event-one');

		await assertSucceeds(
			setDoc(eventRef, {
				ownerId: 'alice',
				entryId: 'entry-one',
				type: 'resurfaced',
				occurredAt: Timestamp.now(),
				schemaVersion: 1
			})
		);
		await assertFails(updateDoc(eventRef, { type: 'edited' }));
		await assertFails(deleteDoc(eventRef));
	});

	it('rejects unexpected fields and invalid shapes', async () => {
		const alice = environment.authenticatedContext('alice').firestore();
		const entryRef = doc(alice, 'users/alice/entries/invalid');

		await assertFails(setDoc(entryRef, { ...validEntry('alice'), secretPayload: true }));
		await assertFails(setDoc(entryRef, { ...validEntry('alice'), rawText: '' }));
		await assertFails(
			setDoc(entryRef, {
				...validEntry('alice'),
				money: { amount: -1, currency: 'dollars' }
			})
		);
		await assertFails(
			setDoc(entryRef, {
				...validStructuredEntry('alice'),
				recurrence: {
					...validStructuredEntry('alice').recurrence,
					interval: 0
				}
			})
		);
		await assertFails(
			setDoc(entryRef, {
				...validStructuredEntry('alice'),
				temporal: {
					...validStructuredEntry('alice').temporal,
					confidence: 2
				}
			})
		);
	});
});
