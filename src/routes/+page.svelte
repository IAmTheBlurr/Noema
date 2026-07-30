<script lang="ts">
	import { onMount } from 'svelte';
	import { LogOut, Search, X } from '@lucide/svelte';
	import type { User } from 'firebase/auth';

	import CaptureComposer from '$lib/components/CaptureComposer.svelte';
	import EntryCard from '$lib/components/EntryCard.svelte';
	import EntryEditor from '$lib/components/EntryEditor.svelte';
	import FinancialBaselineView from '$lib/components/FinancialBaselineView.svelte';
	import LifeEventsView from '$lib/components/LifeEventsView.svelte';
	import type { Entry, EntryEvent, EntryStatus } from '$lib/domain/entry';
	import {
		buildFinancialBaseline,
		projectLifeEvents,
		projectSubscriptions,
		projectUnverified,
		verificationReasonsForCorpus
	} from '$lib/domain/projections';
	import {
		aiDevToolsEnabled,
		aiProvider,
		firebaseServices,
		type FirebaseServices
	} from '$lib/firebase/client';
	import { CallableAiClient, type AiHealthResult } from '$lib/services/ai-client';
	import { observeAuth, signInLocally, signInWithGoogle, signOutUser } from '$lib/services/auth';
	import { FirestoreEntryRepository } from '$lib/services/entry-repository';
	import { buildExportBundle, downloadExport } from '$lib/services/export';
	import { boundedClientSearch } from '$lib/services/search';
	import type { ValidatedEntryInput } from '$lib/validation/entry';

	type View =
		'inbox' | 'events' | 'finances' | 'subscriptions' | 'verification' | 'archive' | 'trash';
	type SubscriptionFilter =
		| 'all'
		| 'active'
		| 'possibly-active'
		| 'ended'
		| 'unknown'
		| 'confirmed'
		| 'suspected'
		| 'missing-amount'
		| 'missing-cadence';

	const viewTitles: Record<View, string> = {
		inbox: 'Inbox',
		events: 'Life Events',
		finances: 'Financial Baseline',
		subscriptions: 'Subscriptions',
		verification: 'Needs Verification',
		archive: 'Archive',
		trash: 'Trash'
	};
	const viewOrder: readonly View[] = [
		'inbox',
		'events',
		'finances',
		'subscriptions',
		'verification',
		'archive',
		'trash'
	];
	const subscriptionFilterTitles: Record<SubscriptionFilter, string> = {
		all: 'All',
		active: 'Active',
		'possibly-active': 'Possibly Active',
		ended: 'Ended',
		unknown: 'Unknown',
		confirmed: 'Confirmed',
		suspected: 'Suspected',
		'missing-amount': 'Missing Amount',
		'missing-cadence': 'Missing Cadence'
	};
	const subscriptionFilterOrder: readonly SubscriptionFilter[] = [
		'all',
		'active',
		'possibly-active',
		'ended',
		'unknown',
		'confirmed',
		'suspected',
		'missing-amount',
		'missing-cadence'
	];
	const appVersion = '0.1.0';

	let services: FirebaseServices | undefined = $state();
	let repository: FirestoreEntryRepository | undefined = $state();
	let aiClient: CallableAiClient | undefined = $state();
	let user: User | null = $state(null);
	let authReady = $state(false);
	let signingIn = $state(false);
	let entries: readonly Entry[] = $state([]);
	let entriesLoading = $state(true);
	let view: View = $state('inbox');
	let searchQuery = $state('');
	let subscriptionFilter: SubscriptionFilter = $state('all');
	let selectedEntry: Entry | null = $state(null);
	let selectedEvents: readonly EntryEvent[] = $state([]);
	let eventsLoading = $state(false);
	let busyEntryId: string | null = $state(null);
	let appError = $state('');
	let aiHealth: AiHealthResult | null = $state(null);
	let aiChecking = $state(false);
	let exporting = $state(false);

	let stopEntries: (() => void) | undefined;
	let stopEvents: (() => void) | undefined;

	const activeEntries = $derived(entries.filter((entry) => entry.status === 'active'));
	const archivedEntries = $derived(entries.filter((entry) => entry.status === 'archived'));
	const trashedEntries = $derived(entries.filter((entry) => entry.status === 'trashed'));
	const allLifeEvents = $derived(projectLifeEvents(activeEntries));
	const lifeEvents = $derived(
		projectLifeEvents(boundedClientSearch.search(activeEntries, searchQuery))
	);
	const financialBaseline = $derived(buildFinancialBaseline(entries));
	const subscriptions = $derived(projectSubscriptions(activeEntries));
	const unverifiedEntries = $derived(projectUnverified(entries));
	const hasFinancialBaseline = $derived(
		Boolean(
			financialBaseline.salary ||
			financialBaseline.payFrequency ||
			financialBaseline.rent ||
			financialBaseline.confirmedRecurring.length > 0 ||
			financialBaseline.possibleRecurring.length > 0 ||
			financialBaseline.missingValueEntryIds.length > 0
		)
	);
	const availableViews = $derived(
		viewOrder.filter((candidate) => {
			if (candidate === 'inbox') return activeEntries.length > 0;
			if (candidate === 'events') {
				return allLifeEvents.placed.length + allLifeEvents.unplaced.length > 0;
			}
			if (candidate === 'finances') return hasFinancialBaseline;
			if (candidate === 'subscriptions') return subscriptions.length > 0;
			if (candidate === 'verification') return unverifiedEntries.length > 0;
			if (candidate === 'archive') return archivedEntries.length > 0;
			return trashedEntries.length > 0;
		})
	);
	const availableSubscriptionFilters = $derived(
		subscriptionFilterOrder.filter((candidate) => {
			if (subscriptions.length === 0) return false;
			if (candidate === 'all') return true;
			if (
				candidate === 'active' ||
				candidate === 'possibly-active' ||
				candidate === 'ended' ||
				candidate === 'unknown'
			) {
				return subscriptions.some((entry) => entry.recurrence?.activeState === candidate);
			}
			if (candidate === 'confirmed' || candidate === 'suspected') {
				return subscriptions.some((entry) => entry.recurrence?.verificationStatus === candidate);
			}
			if (candidate === 'missing-amount') {
				return subscriptions.some((entry) => entry.money === null);
			}
			return subscriptions.some((entry) => entry.recurrence?.cadence === 'unknown');
		})
	);
	const filteredSubscriptions = $derived(
		subscriptions.filter((entry) => {
			const recurrence = entry.recurrence;
			if (!recurrence || subscriptionFilter === 'all') return true;
			if (
				subscriptionFilter === 'active' ||
				subscriptionFilter === 'possibly-active' ||
				subscriptionFilter === 'ended' ||
				subscriptionFilter === 'unknown'
			) {
				return recurrence.activeState === subscriptionFilter;
			}
			if (subscriptionFilter === 'confirmed') {
				return recurrence.verificationStatus === 'confirmed';
			}
			if (subscriptionFilter === 'suspected') {
				return recurrence.verificationStatus === 'suspected';
			}
			if (subscriptionFilter === 'missing-amount') return entry.money === null;
			return recurrence.cadence === 'unknown';
		})
	);
	const listEntries = $derived.by((): readonly Entry[] => {
		if (view === 'inbox') return activeEntries;
		if (view === 'subscriptions') return filteredSubscriptions;
		if (view === 'verification') return unverifiedEntries;
		if (view === 'archive') return archivedEntries;
		if (view === 'trash') return trashedEntries;
		return [];
	});
	const visibleEntries = $derived(boundedClientSearch.search(listEntries, searchQuery));
	const aiEnabled = $derived(aiDevToolsEnabled());

	$effect(() => {
		if (availableViews.length === 0) {
			if (view !== 'inbox') setView('inbox');
			return;
		}
		if (!availableViews.includes(view)) setView(availableViews[0]);
	});

	$effect(() => {
		if (
			availableSubscriptionFilters.length === 0 ||
			!availableSubscriptionFilters.includes(subscriptionFilter)
		) {
			subscriptionFilter = 'all';
		}
	});

	function report(error: unknown): void {
		void error;
		appError = 'Failed. Retry.';
	}

	function setView(nextView: View): void {
		view = nextView;
		searchQuery = '';
	}

	function subscribeForUser(nextUser: User): void {
		if (!repository) return;
		stopEntries?.();
		entriesLoading = true;
		stopEntries = repository.subscribe(
			nextUser.uid,
			(nextEntries) => {
				entries = nextEntries;
				entriesLoading = false;
				if (selectedEntry) {
					selectedEntry =
						nextEntries.find((entry) => entry.id === selectedEntry?.id) ?? selectedEntry;
				}
			},
			(error) => {
				entriesLoading = false;
				report(error);
			}
		);
	}

	onMount(() => {
		try {
			services = firebaseServices();
			repository = new FirestoreEntryRepository(services.db, services.functions);
			aiClient = new CallableAiClient(services.functions, aiProvider());
			const stopAuth = observeAuth(
				services.auth,
				(nextUser) => {
					user = nextUser;
					authReady = true;
					if (nextUser) {
						subscribeForUser(nextUser);
					} else {
						stopEntries?.();
						entries = [];
						entriesLoading = false;
					}
				},
				(error) => {
					authReady = true;
					report(error);
				}
			);

			function keyboardShortcut(event: KeyboardEvent): void {
				if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
					event.preventDefault();
					document.querySelector<HTMLTextAreaElement>('#capture-text')?.focus();
				}
				if (event.key === 'Escape' && selectedEntry) closeEditor();
			}
			window.addEventListener('keydown', keyboardShortcut);

			return () => {
				stopAuth();
				stopEntries?.();
				stopEvents?.();
				window.removeEventListener('keydown', keyboardShortcut);
			};
		} catch (error) {
			authReady = true;
			report(error);
		}
	});

	async function handleSignIn(): Promise<void> {
		if (!services) return;
		signingIn = true;
		appError = '';
		try {
			if (services.useEmulators) {
				await signInLocally(services.auth);
			} else {
				await signInWithGoogle(services.auth);
			}
		} catch (error) {
			report(error);
		} finally {
			signingIn = false;
		}
	}

	async function handleSignOut(): Promise<void> {
		if (!services) return;
		await signOutUser(services.auth);
	}

	async function createEntry(input: ValidatedEntryInput): Promise<void> {
		if (!repository || !user) throw new Error('Add failed. Sign in.');
		appError = '';
		await repository.create(user.uid, input);
		setView('inbox');
	}

	function openEditor(entry: Entry): void {
		if (!repository || !user) return;
		stopEvents?.();
		selectedEntry = entry;
		selectedEvents = [];
		eventsLoading = true;
		stopEvents = repository.subscribeEvents(
			user.uid,
			entry.id,
			(events) => {
				selectedEvents = events;
				eventsLoading = false;
			},
			(error) => {
				eventsLoading = false;
				report(error);
			}
		);
	}

	function closeEditor(): void {
		stopEvents?.();
		stopEvents = undefined;
		selectedEntry = null;
		selectedEvents = [];
	}

	async function withEntryBusy(entry: Entry, action: () => Promise<void>): Promise<void> {
		busyEntryId = entry.id;
		appError = '';
		try {
			await action();
		} catch (error) {
			report(error);
			throw error;
		} finally {
			busyEntryId = null;
		}
	}

	async function resurface(entry: Entry): Promise<void> {
		if (!repository || !user) return;
		await withEntryBusy(entry, () => repository!.resurface(user!.uid, entry.id));
	}

	async function changeStatus(entry: Entry, status: EntryStatus): Promise<void> {
		if (!repository || !user) return;
		await withEntryBusy(entry, () =>
			repository!.changeStatus(user!.uid, entry.id, status, entry.status)
		);
		if (selectedEntry) closeEditor();
	}

	async function saveSelected(input: ValidatedEntryInput): Promise<void> {
		if (!repository || !user || !selectedEntry) return;
		await withEntryBusy(selectedEntry, () => repository!.update(user!.uid, selectedEntry!, input));
		closeEditor();
	}

	async function deleteSelected(): Promise<void> {
		if (!repository || !user || !selectedEntry) return;
		const entry = selectedEntry;
		await withEntryBusy(entry, () => repository!.permanentlyDelete(user!.uid, entry.id));
		closeEditor();
	}

	async function reflectSelected() {
		if (!aiClient || !selectedEntry) throw new Error('Preview failed. Retry.');
		return aiClient.reflectOnEntry(selectedEntry.rawText, selectedEntry.notes ?? undefined);
	}

	async function checkAi(): Promise<void> {
		if (!aiClient) return;
		aiChecking = true;
		appError = '';
		try {
			aiHealth = await aiClient.healthCheck();
		} catch (error) {
			report(error);
		} finally {
			aiChecking = false;
		}
	}

	async function exportCorpus(): Promise<void> {
		if (!repository || !user || exporting) return;
		exporting = true;
		appError = '';
		try {
			const allEntries = await repository.loadAll(user.uid);
			const allEvents = await repository.loadAllEvents(user.uid, allEntries);
			const now = new Date();
			const bundle = buildExportBundle(allEntries, allEvents, { now, appVersion });
			downloadExport(bundle, now);
		} catch (error) {
			report(error);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#142421" />
</svelte:head>

{#if authReady && !user}
	<main class="signin-screen">
		<div class="signin-stack">
			<div class="noema-card card">
				<h1>Noema</h1>
			</div>
			<button class="signin-button" type="button" onclick={handleSignIn} disabled={signingIn}>
				{signingIn ? 'Entering…' : 'Enter'}
			</button>
			{#if appError}<p class="signin-error" role="alert">{appError}</p>{/if}
		</div>
	</main>
{:else if user}
	<div class="app-shell">
		<aside class="sidebar">
			{#if availableViews.length > 0}
				<nav aria-label="Views">
					{#each availableViews as availableView (availableView)}
						<button
							class:active={view === availableView}
							type="button"
							onclick={() => setView(availableView)}
						>
							{viewTitles[availableView]}
						</button>
					{/each}
				</nav>
			{/if}

			<div class="sidebar-spacer"></div>

			{#if aiEnabled}
				<section class="ai-connectivity" aria-labelledby="ai-connectivity-title">
					<strong id="ai-connectivity-title">AI</strong>
					<button type="button" onclick={checkAi} disabled={aiChecking}>
						{aiChecking ? 'Checking…' : 'Check'}
					</button>
					{#if aiHealth}
						<small class:healthy={aiHealth.ok}>
							{aiHealth.ok ? 'OK' : 'Error'} · {aiHealth.metadata.provider}
						</small>
					{/if}
				</section>
			{/if}

			<div class="account-row">
				<button type="button" onclick={exportCorpus} disabled={exporting}>
					{exporting ? 'Exporting…' : 'Export'}
				</button>
				<button class="icon-button" type="button" aria-label="Sign out" onclick={handleSignOut}>
					<LogOut size={18} aria-hidden="true" />
				</button>
			</div>
		</aside>

		<main class="main-content">
			<header class="mobile-header">
				<div class="mobile-actions">
					<button type="button" onclick={exportCorpus} disabled={exporting}>Export</button>
					<button class="icon-button" type="button" aria-label="Sign out" onclick={handleSignOut}>
						<LogOut size={18} aria-hidden="true" />
					</button>
				</div>
			</header>

			<CaptureComposer onCreate={createEntry} />

			<section class="inbox-section" aria-labelledby="view-title">
				<div class="view-heading">
					<h2 id="view-title">{viewTitles[view]}</h2>
				</div>

				{#if view !== 'finances'}
					<div class="inbox-toolbar">
						<label class="search-box">
							<Search size={17} aria-hidden="true" />
							<span class="sr-only">Search</span>
							<input type="search" bind:value={searchQuery} />
							{#if searchQuery}
								<button type="button" aria-label="Clear" onclick={() => (searchQuery = '')}>
									<X size={15} aria-hidden="true" />
								</button>
							{/if}
						</label>
						{#if view === 'subscriptions' && availableSubscriptionFilters.length > 0}
							<label class="filter-field">
								<span class="sr-only">Filter</span>
								<select bind:value={subscriptionFilter}>
									{#each availableSubscriptionFilters as availableFilter (availableFilter)}
										<option value={availableFilter}
											>{subscriptionFilterTitles[availableFilter]}</option
										>
									{/each}
								</select>
							</label>
						{/if}
					</div>
				{/if}

				{#if appError}
					<div class="error-banner" role="alert">
						<span>{appError}</span>
						<button type="button" aria-label="Dismiss" onclick={() => (appError = '')}>
							<X size={17} aria-hidden="true" />
						</button>
					</div>
				{/if}

				{#if entriesLoading}
					<p class="empty-inline">Loading</p>
				{:else if view === 'events'}
					<LifeEventsView projection={lifeEvents} onOpen={openEditor} />
				{:else if view === 'finances'}
					<FinancialBaselineView baseline={financialBaseline} onOpen={openEditor} />
				{:else if visibleEntries.length > 0}
					<div class="entry-list">
						{#each visibleEntries as entry (entry.id)}
							<EntryCard
								{entry}
								markers={view === 'verification'
									? verificationReasonsForCorpus(entries, entry)
									: []}
								busy={busyEntryId === entry.id}
								onOpen={openEditor}
								onResurface={resurface}
								onArchive={(item) => changeStatus(item, 'archived')}
								onRestore={(item) => changeStatus(item, 'active')}
								onTrash={(item) => changeStatus(item, 'trashed')}
							/>
						{/each}
					</div>
				{:else}
					<div class="empty-state"><p>Empty</p></div>
				{/if}
			</section>
		</main>
	</div>

	{#if selectedEntry}
		<EntryEditor
			entry={selectedEntry}
			events={selectedEvents}
			{eventsLoading}
			{aiEnabled}
			onClose={closeEditor}
			onSave={saveSelected}
			onResurface={() => resurface(selectedEntry!)}
			onArchive={() => changeStatus(selectedEntry!, 'archived')}
			onRestore={() => changeStatus(selectedEntry!, 'active')}
			onTrash={() => changeStatus(selectedEntry!, 'trashed')}
			onDelete={deleteSelected}
			onReflect={reflectSelected}
		/>
	{/if}
{/if}
