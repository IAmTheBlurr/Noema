import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('captures, retrieves, revises, resurfaces, archives, restores, and deletes an entry', async ({
	page
}) => {
	await page.goto('/');
	await expect(
		page.locator('.noema-card.card').getByRole('heading', { name: 'Noema' })
	).toBeVisible();
	await expect(page.locator('section.signin-card')).toHaveCount(0);
	await page.getByRole('button', { name: 'Enter' }).click();
	await expect(page.getByRole('heading', { name: 'Thought' })).toBeVisible();
	await expect(page.locator('aside nav')).toHaveCount(0);
	await expect(page.getByLabel('Entry', { exact: true })).toBeVisible();
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

test('captures placed and unplaced life events', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Enter' }).click();
	await page.getByRole('radio', { name: 'Life Event' }).click();
	await expect(page.getByRole('heading', { name: 'Life Event' })).toBeVisible();

	await page.getByLabel('Entry', { exact: true }).fill('Moved out of the camper');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(
		page.locator('.entry-card').filter({ hasText: 'Moved out of the camper' })
	).toBeVisible();

	await page.getByRole('radio', { name: 'Life Event' }).click();
	await page.getByLabel('Entry', { exact: true }).fill('Started the Rapid City lease');
	await page.getByRole('button', { name: 'Details' }).click();
	await page.getByLabel('When').fill('Sometime during winter 2023');
	await page.getByLabel('Earliest').fill('2023-12-01');
	await page.getByLabel('Latest').fill('2024-02-29');
	await page.getByLabel('Precision').selectOption('season');
	await page.getByLabel('Reviewed').check();
	await page.getByRole('button', { name: 'Add' }).click();
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

	await page.getByRole('radio', { name: 'Standing Record' }).click();
	await page.getByLabel('Entry', { exact: true }).fill('Current annual salary');
	await page.getByRole('button', { name: 'Details' }).click();
	await page.getByLabel('Amount').fill('120000');
	const salaryGroup = page.getByRole('group', { name: 'Standing' });
	await salaryGroup.getByLabel('Subject').selectOption('salary');
	await salaryGroup.getByLabel('Verification').selectOption('confirmed');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(
		page.locator('.entry-card').filter({ hasText: 'Current annual salary' })
	).toBeVisible();

	await page.getByLabel('Entry', { exact: true }).fill('Current pay frequency');
	await page.getByRole('button', { name: 'Details' }).click();
	const payGroup = page.getByRole('group', { name: 'Standing' });
	await payGroup.getByLabel('Subject').selectOption('pay-frequency');
	await payGroup.getByLabel('Value').fill('Biweekly');
	await payGroup.getByLabel('Verification').selectOption('confirmed');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(
		page.locator('.entry-card').filter({ hasText: 'Current pay frequency' })
	).toBeVisible();

	await page.getByLabel('Entry', { exact: true }).fill('Current rent');
	await page.getByRole('button', { name: 'Details' }).click();
	await page.getByLabel('Amount').fill('1500');
	const rentStanding = page.getByRole('group', { name: 'Standing' });
	await rentStanding.getByLabel('Subject').selectOption('rent');
	await rentStanding.getByLabel('Verification').selectOption('confirmed');
	await page.getByLabel('Recurring', { exact: true }).check();
	const rentRecurring = page.getByRole('group', { name: 'Recurring' });
	await rentRecurring.getByLabel('Kind').selectOption('rent');
	await rentRecurring.getByLabel('Cadence').selectOption('monthly');
	await rentRecurring.getByLabel('Verification').selectOption('confirmed');
	await rentRecurring.getByLabel('Active State').selectOption('active');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.locator('.entry-card').filter({ hasText: 'Current rent' })).toBeVisible();

	await page.getByRole('radio', { name: 'Recurring' }).click();
	await page.getByLabel('Entry', { exact: true }).fill('I may still be paying for Adobe');
	await page.getByRole('button', { name: 'Details' }).click();
	const suspected = page.getByRole('group', { name: 'Recurring' });
	await suspected.getByLabel('Kind').selectOption('subscription');
	await suspected.getByLabel('Verification').selectOption('suspected');
	await suspected.getByLabel('Active State').selectOption('possibly-active');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(
		page.locator('.entry-card').filter({ hasText: 'I may still be paying for Adobe' })
	).toBeVisible();

	await page.getByLabel('Entry', { exact: true }).fill('Cloud storage');
	await page.getByRole('button', { name: 'Details' }).click();
	await page.getByLabel('Amount').fill('20');
	const confirmed = page.getByRole('group', { name: 'Recurring' });
	await confirmed.getByLabel('Kind').selectOption('subscription');
	await confirmed.getByLabel('Cadence').selectOption('monthly');
	await confirmed.getByLabel('Verification').selectOption('confirmed');
	await confirmed.getByLabel('Active State').selectOption('active');
	await page.getByRole('button', { name: 'Add' }).click();
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
	await page.getByRole('radio', { name: 'Recurring' }).click();
	await page.getByLabel('Entry', { exact: true }).fill('Phone capture');
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.locator('.entry-card').filter({ hasText: 'Phone capture' })).toBeVisible();
	const view = page.getByRole('combobox', { name: 'View' });
	await expect(view).toBeVisible();
	await expect(view.locator('option')).toHaveText([
		'Inbox',
		'Financial Baseline',
		'Needs Verification'
	]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
