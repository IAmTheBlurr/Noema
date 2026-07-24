import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInAnonymously,
	signInWithPopup,
	signOut,
	type Auth,
	type User
} from 'firebase/auth';

export function observeAuth(
	auth: Auth,
	onUser: (user: User | null) => void,
	onError: (error: Error) => void
): () => void {
	return onAuthStateChanged(auth, onUser, onError);
}

export async function signInLocally(auth: Auth): Promise<void> {
	const maxAttempts = 8;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			await signInAnonymously(auth);
			return;
		} catch (error) {
			const code =
				typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
			if (code !== 'auth/network-request-failed' || attempt === maxAttempts) throw error;
			await new Promise((resolve) => setTimeout(resolve, 350));
		}
	}
}

export async function signInWithGoogle(auth: Auth): Promise<void> {
	const provider = new GoogleAuthProvider();
	provider.setCustomParameters({ prompt: 'select_account' });
	await signInWithPopup(auth, provider);
}

export async function signOutUser(auth: Auth): Promise<void> {
	await signOut(auth);
}
