<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Archive,
		BrainCircuit,
		Inbox,
		LockKeyhole,
		LogOut,
		Search,
		ShieldCheck,
		Trash2,
		X
	} from '@lucide/svelte';
	import type { User } from 'firebase/auth';

	import CaptureComposer from '$lib/components/CaptureComposer.svelte';
	import EntryCard from '$lib/components/EntryCard.svelte';
	import EntryEditor from '$lib/components/EntryEditor.svelte';
	import type { Entry, EntryEvent, EntryStatus } from '$lib/domain/entry';
	import {
		aiDevToolsEnabled,
		aiProvider,
		firebaseServices,
		type FirebaseServices
	} from '$lib/firebase/client';
	import { CallableAiClient, type AiHealthResult } from '$lib/services/ai-client';
	import { observeAuth, signInLocally, signInWithGoogle, signOutUser } from '$lib/services/auth';
	import { FirestoreEntryRepository } from '$lib/services/entry-repository';
	import { boundedClientSearch } from '$lib/services/search';
	import type { ValidatedEntryInput } from '$lib/validation/entry';

	type View = 'active' | 'archived' | 'trashed';

	let services: FirebaseServices | undefined = $state();
	let repository: FirestoreEntryRepository | undefined = $state();
	let aiClient: CallableAiClient | undefined = $state();
	let user: User | null = $state(null);
	let authReady = $state(false);
	let signingIn = $state(false);
	let entries: readonly Entry[] = $state([]);
	let entriesLoading = $state(true);
	let view: View = $state('active');
	let searchQuery = $state('');
	let selectedEntry: Entry | null = $state(null);
	let selectedEvents: readonly EntryEvent[] = $state([]);
	let eventsLoading = $state(false);
	let busyEntryId: string | null = $state(null);
	let toast = $state('');
	let appError = $state('');
	let aiHealth: AiHealthResult | null = $state(null);
	let aiChecking = $state(false);

	let stopEntries: (() => void) | undefined;
	let stopEvents: (() => void) | undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const counts = $derived({
		active: entries.filter((entry) => entry.status === 'active').length,
		archived: entries.filter((entry) => entry.status === 'archived').length,
		trashed: entries.filter((entry) => entry.status === 'trashed').length
	});
	const visibleEntries = $derived(
		boundedClientSearch.search(
			entries.filter((entry) => entry.status === view),
			searchQuery
		)
	);
	const aiEnabled = $derived(aiDevToolsEnabled());

	function errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Something unexpected happened.';
	}

	function announce(message: string): void {
		toast = message;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 3_200);
	}

	function report(error: unknown): void {
		appError = errorMessage(error);
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
				if (toastTimer) clearTimeout(toastTimer);
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
		if (!repository || !user) throw new Error('Sign in before capturing a thought.');
		appError = '';
		await repository.create(user.uid, input);
		view = 'active';
		searchQuery = '';
		announce('Thought kept safely.');
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
		announce('Another resurfacing was recorded.');
	}

	async function changeStatus(entry: Entry, status: EntryStatus): Promise<void> {
		if (!repository || !user) return;
		await withEntryBusy(entry, () =>
			repository!.changeStatus(user!.uid, entry.id, status, entry.status)
		);
		const labels: Record<EntryStatus, string> = {
			active: 'Restored to the inbox.',
			archived: 'Entry archived.',
			trashed: 'Entry moved to trash.'
		};
		announce(labels[status]);
		if (selectedEntry) closeEditor();
	}

	async function saveSelected(input: ValidatedEntryInput): Promise<void> {
		if (!repository || !user || !selectedEntry) return;
		await withEntryBusy(selectedEntry, () => repository!.update(user!.uid, selectedEntry!, input));
		announce('Changes saved with history.');
		closeEditor();
	}

	async function deleteSelected(): Promise<void> {
		if (!repository || !user || !selectedEntry) return;
		const entry = selectedEntry;
		await withEntryBusy(entry, () => repository!.permanentlyDelete(user!.uid, entry.id));
		closeEditor();
		announce('Entry and its history were permanently deleted.');
	}

	async function reflectSelected() {
		if (!aiClient || !selectedEntry) throw new Error('AI preview is unavailable.');
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
</script>

<svelte:head>
	<title>Life Corpus — Private capture</title>
	<meta name="description" content="A private, capture-first place for the thoughts that matter." />
	<meta name="theme-color" content="#142421" />
</svelte:head>

{#if !authReady}
	<main class="loading-screen">
		<div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
		<p>Opening your corpus…</p>
	</main>
{:else if !user}
	<main class="signin-screen">
		<section class="signin-card">
			<div class="brand-lockup">
				<div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
				<span>Life Corpus</span>
			</div>
			<div class="signin-copy">
				<p class="eyebrow">Private by design</p>
				<h1>A trusted place for every thought that should not be lost.</h1>
				<p>
					Capture first. Understand later. Your original words stay intact while the shape of your
					life becomes clearer over time.
				</p>
			</div>
			<div class="trust-list">
				<span><LockKeyhole size={17} aria-hidden="true" /> Signed-in access only</span>
				<span><ShieldCheck size={17} aria-hidden="true" /> Isolated personal records</span>
			</div>
			<button class="signin-button" type="button" onclick={handleSignIn} disabled={signingIn}>
				{#if services?.useEmulators}
					<LockKeyhole size={18} aria-hidden="true" />
					{signingIn ? 'Opening local vault…' : 'Enter local vault'}
				{:else}
					{signingIn ? 'Signing in…' : 'Continue with Google'}
				{/if}
			</button>
			{#if services?.useEmulators}
				<p class="local-only">Local emulator only · no production account or data</p>
			{/if}
			{#if appError}<p class="signin-error" role="alert">{appError}</p>{/if}
		</section>
		<p class="signin-footnote">A thought captured is a thought made safe to forget.</p>
	</main>
{:else}
	<div class="app-shell">
		<aside class="sidebar">
			<div class="brand-lockup">
				<div class="brand-mark small" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<span>Life Corpus</span>
			</div>

			<nav aria-label="Entry views">
				<button class:active={view === 'active'} type="button" onclick={() => (view = 'active')}>
					<Inbox size={18} aria-hidden="true" />
					<span>Inbox</span>
					<strong>{counts.active}</strong>
				</button>
				<button
					class:active={view === 'archived'}
					type="button"
					onclick={() => (view = 'archived')}
				>
					<Archive size={18} aria-hidden="true" />
					<span>Archive</span>
					<strong>{counts.archived}</strong>
				</button>
				<button class:active={view === 'trashed'} type="button" onclick={() => (view = 'trashed')}>
					<Trash2 size={18} aria-hidden="true" />
					<span>Trash</span>
					<strong>{counts.trashed}</strong>
				</button>
			</nav>

			<div class="sidebar-spacer"></div>

			{#if aiEnabled}
				<section class="ai-connectivity" aria-labelledby="ai-connectivity-title">
					<div>
						<BrainCircuit size={17} aria-hidden="true" />
						<strong id="ai-connectivity-title">AI boundary</strong>
					</div>
					<p>Developer-only connectivity. Responses are not saved.</p>
					<button type="button" onclick={checkAi} disabled={aiChecking}>
						{aiChecking ? 'Checking…' : aiHealth ? 'Check again' : 'Run health check'}
					</button>
					{#if aiHealth}
						<small class:healthy={aiHealth.ok}>
							{aiHealth.ok ? 'Ready' : 'Unavailable'} · {aiHealth.metadata.provider}
						</small>
					{/if}
				</section>
			{/if}

			<div class="account-row">
				<div>
					<span class="avatar">{user.isAnonymous ? 'L' : (user.displayName?.[0] ?? 'Y')}</span>
					<p>
						<strong>{user.isAnonymous ? 'Local vault' : (user.displayName ?? 'Your corpus')}</strong
						>
						<small>{user.isAnonymous ? 'Emulator identity' : user.email}</small>
					</p>
				</div>
				<button class="icon-button" type="button" aria-label="Sign out" onclick={handleSignOut}>
					<LogOut size={18} aria-hidden="true" />
				</button>
			</div>
		</aside>

		<main class="main-content">
			<header class="mobile-header">
				<div class="brand-lockup">
					<div class="brand-mark small" aria-hidden="true">
						<span></span><span></span><span></span>
					</div>
					<span>Life Corpus</span>
				</div>
				<div class="mobile-nav">
					<button
						class:active={view === 'active'}
						onclick={() => (view = 'active')}
						aria-label="Inbox"
					>
						<Inbox size={18} />
					</button>
					<button
						class:active={view === 'archived'}
						onclick={() => (view = 'archived')}
						aria-label="Archive"
					>
						<Archive size={18} />
					</button>
					<button
						class:active={view === 'trashed'}
						onclick={() => (view = 'trashed')}
						aria-label="Trash"
					>
						<Trash2 size={18} />
					</button>
				</div>
			</header>

			<CaptureComposer onCreate={createEntry} />

			<section class="inbox-section" aria-labelledby="inbox-heading">
				<div class="inbox-toolbar">
					<div>
						<p class="eyebrow">Your corpus</p>
						<h2 id="inbox-heading">
							{view === 'active' ? 'Inbox' : view === 'archived' ? 'Archive' : 'Trash'}
						</h2>
					</div>
					<label class="search-box">
						<Search size={17} aria-hidden="true" />
						<span class="sr-only">Search entries</span>
						<input type="search" placeholder="Search your entries" bind:value={searchQuery} />
						{#if searchQuery}
							<button type="button" aria-label="Clear search" onclick={() => (searchQuery = '')}>
								<X size={15} aria-hidden="true" />
							</button>
						{/if}
					</label>
				</div>

				{#if appError}
					<div class="error-banner" role="alert">
						<span>{appError}</span>
						<button type="button" aria-label="Dismiss error" onclick={() => (appError = '')}>
							<X size={17} aria-hidden="true" />
						</button>
					</div>
				{/if}

				{#if entriesLoading}
					<div class="entry-list" aria-label="Loading entries">
						{#each [1, 2, 3] as item (item)}
							<div class="entry-skeleton" aria-hidden="true" data-item={item}></div>
						{/each}
					</div>
				{:else if visibleEntries.length > 0}
					<div class="entry-list">
						{#each visibleEntries as entry (entry.id)}
							<EntryCard
								{entry}
								busy={busyEntryId === entry.id}
								onOpen={openEditor}
								onResurface={resurface}
								onArchive={(item) => changeStatus(item, 'archived')}
								onRestore={(item) => changeStatus(item, 'active')}
								onTrash={(item) => changeStatus(item, 'trashed')}
							/>
						{/each}
					</div>
					<p class="result-note">
						Showing {visibleEntries.length} of {counts[view]}
						{view === 'active' ? 'inbox' : view} entries · search runs locally over the latest 500
					</p>
				{:else}
					<div class="empty-state">
						<div class="empty-symbol" aria-hidden="true">
							{#if searchQuery}<Search size={24} />{:else if view === 'active'}<Inbox
									size={24}
								/>{:else if view === 'archived'}<Archive size={24} />{:else}<Trash2
									size={24}
								/>{/if}
						</div>
						<h3>
							{searchQuery
								? 'Nothing matches that search'
								: view === 'active'
									? 'Your inbox is quiet'
									: view === 'archived'
										? 'Nothing archived yet'
										: 'Trash is empty'}
						</h3>
						<p>
							{searchQuery
								? 'Try fewer words or search the original phrasing.'
								: view === 'active'
									? 'The next thought you keep will appear here immediately.'
									: view === 'archived'
										? 'Archived thoughts remain preserved and searchable.'
										: 'Entries in trash can be restored or permanently deleted.'}
						</p>
					</div>
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

	{#if toast}
		<div class="toast" role="status"><ShieldCheck size={17} aria-hidden="true" /> {toast}</div>
	{/if}
{/if}
