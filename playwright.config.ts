import { defineConfig } from '@playwright/test';

delete process.env.NO_COLOR;

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.e2e.ts',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: false,
	timeout: 60_000,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'retain-on-failure'
	}
});
