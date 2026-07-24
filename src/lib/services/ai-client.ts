import { httpsCallable, type Functions } from 'firebase/functions';

export interface AiInvocationMetadata {
	provider: 'mock' | 'gemini';
	model: string;
	promptTemplateVersion: string;
	generatedAt: string;
	persisted: false;
}

export interface AiHealthResult {
	ok: boolean;
	message: string;
	metadata: AiInvocationMetadata;
}

export interface EntryReflectionResult {
	reflection: string;
	questions: readonly string[];
	metadata: AiInvocationMetadata;
}

export class CallableAiClient {
	constructor(
		private readonly functions: Functions,
		private readonly provider: 'mock' | 'gemini'
	) {}

	async healthCheck(): Promise<AiHealthResult> {
		const call = httpsCallable<Record<string, never>, AiHealthResult>(
			this.functions,
			this.provider === 'gemini' ? 'aiHealthGemini' : 'aiHealth'
		);
		const result = await call({});
		return result.data;
	}

	async reflectOnEntry(rawText: string, notes?: string): Promise<EntryReflectionResult> {
		const call = httpsCallable<{ rawText: string; notes?: string }, EntryReflectionResult>(
			this.functions,
			this.provider === 'gemini' ? 'reflectOnEntryGemini' : 'reflectOnEntry'
		);
		const result = await call(notes ? { rawText, notes } : { rawText });
		return result.data;
	}
}
