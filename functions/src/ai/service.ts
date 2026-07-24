import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

import type {
	AiHealthResult,
	AiInvocationMetadata,
	AiService,
	EntryReflectionInput,
	EntryReflectionResult
} from './contracts.js';

const PROMPT_TEMPLATE_VERSION = 'entry-reflection-v1';
const GEMINI_MODEL = 'gemini-2.5-flash';

function metadata(provider: 'mock' | 'gemini', model: string): AiInvocationMetadata {
	return {
		provider,
		model,
		promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
		generatedAt: new Date().toISOString(),
		persisted: false
	};
}

export class MockAiService implements AiService {
	async healthCheck(): Promise<AiHealthResult> {
		return {
			ok: true,
			message: 'Deterministic local AI adapter is ready.',
			metadata: metadata('mock', 'deterministic-reflector-v1')
		};
	}

	async reflectOnEntry(input: EntryReflectionInput): Promise<EntryReflectionResult> {
		const normalized = input.rawText.trim().replace(/\s+/g, ' ');
		const excerpt = normalized.length > 96 ? `${normalized.slice(0, 93)}…` : normalized;

		return {
			reflection: `This thought is preserved without forcing a category: “${excerpt}”`,
			questions: [
				'What would make this worth revisiting?',
				'Is there a useful time horizon, even if it is uncertain?'
			],
			metadata: metadata('mock', 'deterministic-reflector-v1')
		};
	}
}

export class GeminiAiService implements AiService {
	readonly #ai;

	constructor(apiKey: string) {
		this.#ai = genkit({
			plugins: [googleAI({ apiKey })],
			model: googleAI.model(GEMINI_MODEL)
		});
	}

	async healthCheck(): Promise<AiHealthResult> {
		const response = await this.#ai.generate({
			prompt: 'Reply with exactly: ready',
			config: { temperature: 0 }
		});

		return {
			ok: response.text.trim().toLowerCase() === 'ready',
			message: 'Gemini connectivity check completed.',
			metadata: metadata('gemini', GEMINI_MODEL)
		};
	}

	async reflectOnEntry(input: EntryReflectionInput): Promise<EntryReflectionResult> {
		const notes = input.notes
			? '\nOptional user notes are present but omitted from this preview.'
			: '';
		const response = await this.#ai.generate({
			prompt: [
				'You are a restrained reflection assistant for a private capture inbox.',
				'Do not classify, recommend a purchase, or prescribe an action.',
				'Write one short neutral reflection and exactly two gentle questions.',
				'Use this exact output shape:',
				'REFLECTION: <one sentence>',
				'QUESTION: <question>',
				'QUESTION: <question>',
				`ENTRY: ${input.rawText}${notes}`
			].join('\n'),
			config: { temperature: 0.2 }
		});

		const lines = response.text
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		const reflectionLine = lines.find((line) => line.startsWith('REFLECTION:'));
		const questions = lines
			.filter((line) => line.startsWith('QUESTION:'))
			.map((line) => line.replace(/^QUESTION:\s*/, ''))
			.slice(0, 2);

		return {
			reflection:
				reflectionLine?.replace(/^REFLECTION:\s*/, '') ??
				'The reflection provider returned an unexpected but non-persisted response.',
			questions:
				questions.length === 2
					? questions
					: ['What matters about this thought?', 'When might it be useful to revisit?'],
			metadata: metadata('gemini', GEMINI_MODEL)
		};
	}
}
