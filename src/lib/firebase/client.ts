import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
	connectFirestoreEmulator,
	getFirestore,
	initializeFirestore,
	type Firestore
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

export interface FirebaseServices {
	app: FirebaseApp;
	auth: Auth;
	db: Firestore;
	functions: Functions;
	useEmulators: boolean;
}

let services: FirebaseServices | undefined;

function publicValue(name: `PUBLIC_${string}`, fallback: string): string {
	const value = env[name];
	return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function firebaseServices(): FirebaseServices {
	if (!browser) throw new Error('Firebase browser services are unavailable during prerendering.');
	if (services) return services;

	const useEmulators = publicValue('PUBLIC_USE_FIREBASE_EMULATORS', 'true') !== 'false';
	const projectId = publicValue('PUBLIC_FIREBASE_PROJECT_ID', 'demo-life-corpus');
	if (!useEmulators && projectId.startsWith('demo-')) {
		throw new Error('Production mode cannot use a Firebase demo project.');
	}

	const app = initializeApp({
		apiKey: publicValue('PUBLIC_FIREBASE_API_KEY', 'demo-api-key'),
		appId: publicValue('PUBLIC_FIREBASE_APP_ID', '1:1234567890:web:demo'),
		authDomain: publicValue('PUBLIC_FIREBASE_AUTH_DOMAIN', 'demo-life-corpus.firebaseapp.com'),
		projectId,
		storageBucket: publicValue(
			'PUBLIC_FIREBASE_STORAGE_BUCKET',
			'demo-life-corpus.firebasestorage.app'
		),
		messagingSenderId: publicValue('PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '1234567890'),
		measurementId: publicValue('PUBLIC_FIREBASE_MEASUREMENT_ID', 'G-DEMO')
	});
	const auth = getAuth(app);
	let db: Firestore;
	try {
		db = initializeFirestore(app, { ignoreUndefinedProperties: true });
	} catch {
		db = getFirestore(app);
	}
	const functions = getFunctions(app, 'us-central1');

	if (useEmulators) {
		const emulatorHost = window.location.hostname;
		connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
		connectFirestoreEmulator(db, emulatorHost, 8080);
		connectFunctionsEmulator(functions, emulatorHost, 5001);
	}

	services = { app, auth, db, functions, useEmulators };
	return services;
}

export function aiDevToolsEnabled(): boolean {
	return publicValue('PUBLIC_ENABLE_AI_DEV_TOOLS', 'true') === 'true';
}

export function aiProvider(): 'mock' | 'gemini' {
	return publicValue('PUBLIC_AI_PROVIDER', 'mock') === 'gemini' ? 'gemini' : 'mock';
}
