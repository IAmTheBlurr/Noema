import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

import type { AiService, EntryReflectionInput } from './ai/contracts.js';
import { GeminiAiService, MockAiService } from './ai/service.js';

if (getApps().length === 0) {
	initializeApp();
}

const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

function developerToolsEnabled(): boolean {
	return process.env.FUNCTIONS_EMULATOR === 'true' || process.env.ENABLE_AI_DEV_TOOLS === 'true';
}

function requireUser(auth: { uid: string } | undefined): string {
	if (!auth) {
		throw new HttpsError('unauthenticated', 'Sign in is required.');
	}
	return auth.uid;
}

function getGeminiService(): AiService {
	const apiKey = geminiApiKey.value();
	if (!apiKey) {
		throw new HttpsError(
			'failed-precondition',
			'Gemini is disabled because its server-side credential is not configured.'
		);
	}
	return new GeminiAiService(apiKey);
}

function parseReflectionInput(data: unknown): EntryReflectionInput {
	if (typeof data !== 'object' || data === null || !('rawText' in data)) {
		throw new HttpsError('invalid-argument', 'A rawText string is required.');
	}
	const rawText = Reflect.get(data, 'rawText');
	const notes = Reflect.get(data, 'notes');
	if (typeof rawText !== 'string' || rawText.trim().length === 0 || rawText.length > 10_000) {
		throw new HttpsError('invalid-argument', 'rawText must contain 1 to 10,000 characters.');
	}
	if (notes !== undefined && (typeof notes !== 'string' || notes.length > 20_000)) {
		throw new HttpsError(
			'invalid-argument',
			'notes must be a string of at most 20,000 characters.'
		);
	}
	return typeof notes === 'string' ? { rawText, notes } : { rawText };
}

export const aiHealth = onCall(
	{
		region: 'us-central1',
		timeoutSeconds: 30,
		memory: '256MiB'
	},
	async (request) => {
		requireUser(request.auth);
		if (!developerToolsEnabled()) {
			throw new HttpsError('not-found', 'Developer AI tools are disabled.');
		}
		return new MockAiService().healthCheck();
	}
);

export const reflectOnEntry = onCall(
	{
		region: 'us-central1',
		timeoutSeconds: 60,
		memory: '256MiB'
	},
	async (request) => {
		requireUser(request.auth);
		if (!developerToolsEnabled()) {
			throw new HttpsError('not-found', 'Developer AI tools are disabled.');
		}
		const input = parseReflectionInput(request.data);
		return new MockAiService().reflectOnEntry(input);
	}
);

export const aiHealthGemini = onCall(
	{
		region: 'us-central1',
		secrets: [geminiApiKey],
		timeoutSeconds: 30,
		memory: '256MiB'
	},
	async (request) => {
		requireUser(request.auth);
		if (!developerToolsEnabled()) {
			throw new HttpsError('not-found', 'Developer AI tools are disabled.');
		}
		return getGeminiService().healthCheck();
	}
);

export const reflectOnEntryGemini = onCall(
	{
		region: 'us-central1',
		secrets: [geminiApiKey],
		timeoutSeconds: 60,
		memory: '256MiB'
	},
	async (request) => {
		requireUser(request.auth);
		if (!developerToolsEnabled()) {
			throw new HttpsError('not-found', 'Developer AI tools are disabled.');
		}
		const input = parseReflectionInput(request.data);
		return getGeminiService().reflectOnEntry(input);
	}
);

export const permanentlyDeleteEntry = onCall(
	{
		region: 'us-central1',
		timeoutSeconds: 60,
		memory: '256MiB'
	},
	async (request) => {
		const uid = requireUser(request.auth);
		const entryId =
			typeof request.data === 'object' && request.data !== null
				? Reflect.get(request.data, 'entryId')
				: undefined;
		if (typeof entryId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(entryId)) {
			throw new HttpsError('invalid-argument', 'A valid entryId is required.');
		}

		const entryRef = db.doc(`users/${uid}/entries/${entryId}`);
		const snapshot = await entryRef.get();
		if (!snapshot.exists) {
			throw new HttpsError('not-found', 'Entry not found.');
		}
		if (snapshot.get('ownerId') !== uid || snapshot.get('status') !== 'trashed') {
			throw new HttpsError(
				'failed-precondition',
				'Only the owner can permanently delete a trashed entry.'
			);
		}

		await db.recursiveDelete(entryRef);
		logger.info('Permanently deleted one entry tree.');
		return { deleted: true };
	}
);
