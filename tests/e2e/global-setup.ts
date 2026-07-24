import { createServer } from 'vite';

export default async function globalSetup(): Promise<() => Promise<void>> {
	const server = await createServer({
		logLevel: 'error',
		server: {
			host: '127.0.0.1',
			port: 5173,
			strictPort: true
		}
	});
	await server.listen();

	return async () => {
		await server.close();
	};
}
