export type AiProvider = 'mock' | 'gemini';

export interface AiInvocationMetadata {
	provider: AiProvider;
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

export interface EntryReflectionInput {
	rawText: string;
	notes?: string;
}

export interface EntryReflectionResult {
	reflection: string;
	questions: readonly string[];
	metadata: AiInvocationMetadata;
}

export interface AiService {
	healthCheck(): Promise<AiHealthResult>;
	reflectOnEntry(input: EntryReflectionInput): Promise<EntryReflectionResult>;
}
