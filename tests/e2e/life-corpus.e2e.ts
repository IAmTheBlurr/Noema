import { expect, test, type Page } from '@playwright/test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

const PROJECT_ID = 'demo-life-corpus';
let environment: RulesTestEnvironment;

type SeedEntry = {
	id: string;
	data: Readonly<Record<string, unknown>>;
};

test.beforeAll(async () => {
	environment = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: {
			host: '127.0.0.1',
			port: 8080
		}
	});
});

test.afterAll(async () => {
	await environment.cleanup();
});

async function storedOwnerId(page: Page): Promise<string | null> {
	return page.evaluate(async () => {
		for (const storage of [localStorage, sessionStorage]) {
			for (let index = 0; index < storage.length; index += 1) {
				const key = storage.key(index);
				if (!key?.startsWith('firebase:authUser:')) continue;
				const value = storage.getItem(key);
				if (!value) continue;
				const parsed = JSON.parse(value) as { uid?: unknown };
				if (typeof parsed.uid === 'string') return parsed.uid;
			}
		}

		return new Promise<string | null>((resolve) => {
			const open = indexedDB.open('firebaseLocalStorageDb');
			open.onerror = () => resolve(null);
			open.onsuccess = () => {
				const database = open.result;
				if (!database.objectStoreNames.contains('firebaseLocalStorage')) {
					database.close();
					resolve(null);
					return;
				}
				const transaction = database.transaction('firebaseLocalStorage', 'readonly');
				const request = transaction.objectStore('firebaseLocalStorage').getAll();
				request.onerror = () => {
					database.close();
					resolve(null);
				};
				request.onsuccess = () => {
					const uid = request.result
						.map((record: { value?: { uid?: unknown } }) => record.value?.uid)
						.find((value: unknown): value is string => typeof value === 'string');
					database.close();
					resolve(uid ?? null);
				};
			};
		});
	});
}

async function currentOwnerId(page: Page): Promise<string> {
	await expect.poll(() => storedOwnerId(page)).not.toBeNull();
	const ownerId = await storedOwnerId(page);
	if (!ownerId) throw new Error('Auth fixture missing.');
	return ownerId;
}

function entryDocument(
	ownerId: string,
	rawText: string,
	fields: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
	const now = Timestamp.now();
	return {
		ownerId,
		rawText,
		captureIntent: 'thought',
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
		schemaVersion: 2,
		...fields
	};
}

async function seedEntries(ownerId: string, entries: readonly SeedEntry[]): Promise<void> {
	await environment.withSecurityRulesDisabled(async (context) => {
		await Promise.all(
			entries.map((entry) =>
				setDoc(doc(context.firestore(), `users/${ownerId}/entries/${entry.id}`), entry.data)
			)
		);
	});
}

test('captures, retrieves, revises, resurfaces, archives, restores, and deletes an entry', async ({
	page
}) => {
	await page.goto('/');
	await expect(
		page.locator('.noema-card.card').getByRole('heading', { name: 'Noema' })
	).toBeVisible();
	await expect(page.locator('section.signin-card')).toHaveCount(0);
	await page.getByRole('button', { name: 'Enter' }).click();
	await expect(page.locator('aside nav')).toHaveCount(0);
	await expect(page.getByRole('radio')).toHaveCount(0);
	await expect(page.getByLabel('Entry', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
	await expect(page.getByText('Empty', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Check' }).click();
	await expect(page.getByText('OK · mock')).toBeVisible();

	const thought = 'Replace the Dakota oxygen sensors before the autumn photography trip';
	await page.getByLabel('Entry', { exact: true }).fill(thought);
	await page.getByRole('button', { name: 'Details' }).click();
	await page.getByLabel('URL', { exact: true }).fill('https://example.com/sensors');
	await page.getByLabel('Amount').fill('240');
	await page.getByLabel('Date').fill('This autumn');
	await page.getByLabel('Notes').fill('Avoid losing continuity before travel.');
	await page.getByRole('button', { name: 'Add' }).click();

	const entryCard = page.locator('.entry-card').filter({ hasText: thought });
	await expect(entryCard).toBeVisible();
	await expect(entryCard).toContainText('$240.00');
	await expect(page.locator('aside nav').getByRole('button')).toHaveText(['Inbox']);

	await page.getByLabel('Search').fill('Dakota autumn');
	await expect(entryCard).toBeVisible();
	await page.getByLabel('Search').fill('earbuds');
	await expect(entryCard).not.toBeVisible();
	await expect(page.getByText('Empty', { exact: true })).toBeVisible();
	await page.getByLabel('Search').fill('');

	await entryCard.getByRole('button', { name: 'Repeat' }).click();

	await entryCard.locator('.card-main').click();
	const editor = page.getByRole('dialog', { name: 'Edit' });
	await expect(editor).toBeVisible();
	await expect(editor.getByText('Repeated', { exact: true })).toBeVisible();

	await editor.getByLabel('Entry').fill(`${thought} — check part numbers`);
	await editor.getByRole('button', { name: 'Save' }).click();

	const editedCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await editedCard.locator('.card-main').click();
	await page
		.getByRole('dialog', { name: 'Edit' })
		.getByRole('button', { name: 'Archive', exact: true })
		.click();
	await page
		.locator('aside nav')
		.getByRole('button', { name: /Archive/ })
		.click();
	await expect(page.locator('.entry-card').filter({ hasText: 'check part numbers' })).toBeVisible();

	const archivedCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await archivedCard.locator('.card-main').click();
	await page.getByRole('dialog', { name: 'Edit' }).getByRole('button', { name: 'Restore' }).click();
	await page.locator('aside nav').getByRole('button', { name: /Inbox/ }).click();

	const restoredCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await restoredCard.locator('.card-main').click();
	await page.getByRole('dialog', { name: 'Edit' }).getByRole('button', { name: 'Delete' }).click();
	await page.locator('aside nav').getByRole('button', { name: /Trash/ }).click();

	const trashedCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await trashedCard.locator('.card-main').click();
	const trashEditor = page.getByRole('dialog', { name: 'Edit' });
	await trashEditor.getByRole('button', { name: 'Delete' }).click();
	await trashEditor.getByRole('button', { name: 'Delete' }).click();
	await expect(trashedCard).not.toBeVisible();
});

test('renders placed and unplaced life events from stored records', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Enter' }).click();
	await expect(page.getByLabel('Entry', { exact: true })).toBeVisible();
	const ownerId = await currentOwnerId(page);
	await seedEntries(ownerId, [
		{
			id: 'unplaced-event',
			data: entryDocument(ownerId, 'Moved out of the camper', {
				captureIntent: 'life-event'
			})
		},
		{
			id: 'placed-event',
			data: entryDocument(ownerId, 'Started the Rapid City lease', {
				captureIntent: 'life-event',
				temporal: {
					rawText: 'Sometime during winter 2023',
					earliest: '2023-12-01',
					latest: '2024-02-29',
					precision: 'season',
					source: 'human',
					reviewedByUser: true
				}
			})
		}
	]);
	await expect(
		page.locator('.entry-card').filter({ hasText: 'Started the Rapid City lease' })
	).toBeVisible();
	await expect(page.locator('aside nav').getByRole('button')).toHaveText([
		'Inbox',
		'Life Events',
		'Needs Verification'
	]);

	await page.locator('aside nav').getByRole('button', { name: 'Life Events' }).click();
	await expect(page.getByRole('heading', { name: 'Life Events' })).toBeVisible();
	await expect(page.getByText('Unplaced', { exact: true })).toBeVisible();
	await expect(page.getByText('Moved out of the camper', { exact: true })).toBeVisible();
	await expect(page.getByText('Sometime during winter 2023', { exact: true })).toBeVisible();
	await expect(page.getByText('season', { exact: true })).toBeVisible();
});

test('derives financial, subscription, and verification views from shared entries', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Enter' }).click();
	await expect(page.getByLabel('Entry', { exact: true })).toBeVisible();
	const ownerId = await currentOwnerId(page);
	await seedEntries(ownerId, [
		{
			id: 'salary',
			data: entryDocument(ownerId, 'Current annual salary', {
				captureIntent: 'standing-record',
				money: { minorUnits: 12_000_000, currency: 'USD' },
				standingRecord: {
					subjectHint: 'salary',
					verificationStatus: 'confirmed',
					state: 'current'
				}
			})
		},
		{
			id: 'pay-frequency',
			data: entryDocument(ownerId, 'Current pay frequency', {
				captureIntent: 'standing-record',
				standingRecord: {
					subjectHint: 'pay-frequency',
					valueText: 'Biweekly',
					verificationStatus: 'confirmed',
					state: 'current'
				}
			})
		},
		{
			id: 'rent',
			data: entryDocument(ownerId, 'Current rent', {
				captureIntent: 'standing-record',
				money: { minorUnits: 150_000, currency: 'USD' },
				standingRecord: {
					subjectHint: 'rent',
					verificationStatus: 'confirmed',
					state: 'current'
				},
				recurrence: {
					recurringKind: 'rent',
					cadence: 'monthly',
					verificationStatus: 'confirmed',
					activeState: 'active'
				}
			})
		},
		{
			id: 'adobe',
			data: entryDocument(ownerId, 'I may still be paying for Adobe', {
				captureIntent: 'recurring-commitment',
				recurrence: {
					recurringKind: 'subscription',
					cadence: 'unknown',
					verificationStatus: 'suspected',
					activeState: 'possibly-active'
				}
			})
		},
		{
			id: 'cloud',
			data: entryDocument(ownerId, 'Cloud storage', {
				captureIntent: 'recurring-commitment',
				money: { minorUnits: 2_000, currency: 'USD' },
				recurrence: {
					recurringKind: 'subscription',
					cadence: 'monthly',
					verificationStatus: 'confirmed',
					activeState: 'active'
				}
			})
		}
	]);
	await expect(page.locator('.entry-card').filter({ hasText: 'Cloud storage' })).toBeVisible();
	await expect(page.locator('aside nav').getByRole('button')).toHaveText([
		'Inbox',
		'Financial Baseline',
		'Subscriptions',
		'Needs Verification'
	]);

	const rentCard = page.locator('.entry-card').filter({ hasText: 'Current rent' });
	await rentCard.locator('.card-main').click();
	const editor = page.getByRole('dialog', { name: 'Edit' });
	await expect(editor.getByRole('group', { name: 'Standing' }).getByLabel('Subject')).toHaveValue(
		'rent'
	);
	await expect(editor.getByRole('group', { name: 'Recurring' }).getByLabel('Kind')).toHaveValue(
		'rent'
	);
	await editor.getByLabel('Notes').fill('Lease record');
	await editor.getByRole('button', { name: 'Save' }).click();

	await page.locator('aside nav').getByRole('button', { name: 'Financial Baseline' }).click();
	await expect(page.getByRole('heading', { name: 'Financial Baseline' })).toBeVisible();
	await expect(page.getByText('$120,000.00', { exact: true })).toBeVisible();
	await expect(page.getByText('$1,520.00', { exact: true })).toBeVisible();
	await expect(page.getByText('Biweekly', { exact: true })).toBeVisible();

	await page.locator('aside nav').getByRole('button', { name: 'Subscriptions' }).click();
	await expect(page.locator('.entry-card').filter({ hasText: 'Cloud storage' })).toBeVisible();
	await expect(
		page.locator('.entry-card').filter({ hasText: 'I may still be paying for Adobe' })
	).toBeVisible();
	const filter = page.getByLabel('Filter');
	await expect(filter.locator('option')).toHaveText([
		'All',
		'Active',
		'Possibly Active',
		'Confirmed',
		'Suspected',
		'Missing Amount',
		'Missing Cadence'
	]);
	await filter.selectOption('missing-amount');
	await expect(
		page.locator('.entry-card').filter({ hasText: 'I may still be paying for Adobe' })
	).toBeVisible();
	await expect(page.locator('.entry-card').filter({ hasText: 'Cloud storage' })).not.toBeVisible();

	await page.locator('aside nav').getByRole('button', { name: 'Needs Verification' }).click();
	await expect(
		page.locator('.entry-card').filter({ hasText: 'I may still be paying for Adobe' })
	).toContainText('Missing Amount');
	await expect(
		page.locator('.entry-card').filter({ hasText: 'I may still be paying for Adobe' })
	).toContainText('Missing Cadence');
});

test('downloads a portable corpus ZIP', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Enter' }).click();
	await page.getByLabel('Entry', { exact: true }).fill('Exported thought');
	await page.getByRole('button', { name: 'Add' }).click();

	const downloadPromise = page.waitForEvent('download');
	await page.locator('aside').getByRole('button', { name: 'Export' }).click();
	const download = await downloadPromise;
	const path = await download.path();
	expect(download.suggestedFilename()).toMatch(/^noema-export-\d{4}-\d{2}-\d{2}\.zip$/);
	expect(path).not.toBeNull();
	const bytes = await readFile(path!);
	expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
});

test('keeps capture and navigation usable on a phone viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Enter' }).click();

	await expect(page.getByRole('combobox', { name: 'View' })).toHaveCount(0);
	await expect(page.getByLabel('Entry', { exact: true })).toBeVisible();
	await expect(page.getByRole('radio')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Details' })).toBeVisible();
	await page.getByLabel('Entry', { exact: true }).fill('Phone capture');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.locator('.entry-card').filter({ hasText: 'Phone capture' })).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'View' })).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
