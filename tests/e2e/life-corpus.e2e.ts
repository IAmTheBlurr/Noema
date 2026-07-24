import { expect, test } from '@playwright/test';

test('captures, retrieves, revises, resurfaces, archives, restores, and deletes an entry', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Enter local vault' }).click();
	await expect(
		page.getByRole('heading', { name: 'What is asking to be remembered?' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Run health check' }).click();
	await expect(page.getByText('Ready · mock')).toBeVisible();

	const thought = 'Replace the Dakota oxygen sensors before the autumn photography trip';
	await page.getByLabel('Capture a thought').fill(thought);
	await page.getByRole('button', { name: 'Optional details' }).click();
	await page.getByLabel('URL', { exact: true }).fill('https://example.com/sensors');
	await page.getByLabel('Approximate amount').fill('240');
	await page.getByLabel('Date or time horizon').fill('This autumn');
	await page.getByLabel('Notes or justification').fill('Avoid losing continuity before travel.');
	await page.getByRole('button', { name: 'Keep thought' }).click();

	const entryCard = page.locator('.entry-card').filter({ hasText: thought });
	await expect(entryCard).toBeVisible();
	await expect(entryCard).toContainText('$240.00');
	await expect(page.getByRole('status')).toContainText('Thought kept safely');

	await page.getByPlaceholder('Search your entries').fill('Dakota autumn');
	await expect(entryCard).toBeVisible();
	await page.getByPlaceholder('Search your entries').fill('earbuds');
	await expect(page.getByText('Nothing matches that search')).toBeVisible();
	await page.getByRole('button', { name: 'Clear search' }).click();

	await entryCard.getByRole('button', { name: /Remembered again/ }).click();
	await expect(entryCard.getByRole('button', { name: /Current recurrence count 1/ })).toBeVisible();

	await entryCard.locator('.card-main').click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByText('1 resurfacing', { exact: true })).toBeVisible();
	await expect(
		page.getByRole('region', { name: 'History' }).getByText('Remembered again', { exact: true })
	).toBeVisible();

	await page.getByLabel('Original thought').fill(`${thought} — check part numbers`);
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByText('Changes saved with history.')).toBeVisible();

	const editedCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await editedCard.locator('.card-main').click();
	await page.getByRole('button', { name: 'Archive', exact: true }).click();
	await page
		.locator('aside nav')
		.getByRole('button', { name: /Archive/ })
		.click();
	await expect(page.locator('.entry-card').filter({ hasText: 'check part numbers' })).toBeVisible();

	const archivedCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await archivedCard.locator('.card-main').click();
	await page.getByRole('button', { name: 'Restore to inbox' }).click();
	await page.locator('aside nav').getByRole('button', { name: /Inbox/ }).click();

	const restoredCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await restoredCard.locator('.card-main').click();
	await page.getByRole('button', { name: 'Move to trash' }).click();
	await page.locator('aside nav').getByRole('button', { name: /Trash/ }).click();

	const trashedCard = page.locator('.entry-card').filter({ hasText: 'check part numbers' });
	await trashedCard.locator('.card-main').click();
	await page.getByRole('button', { name: 'Permanently delete' }).click();
	await page.getByRole('button', { name: 'Yes, permanently delete' }).click();
	await expect(page.getByText('Entry and its history were permanently deleted.')).toBeVisible();
	await expect(trashedCard).not.toBeVisible();
});
