import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'firestore-rules',
		environment: 'node',
		include: ['tests/rules/**/*.spec.ts'],
		fileParallelism: false,
		testTimeout: 20_000,
		hookTimeout: 20_000
	}
});
