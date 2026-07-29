import type { Entry, Money, RecurrenceCadence, StandingSubjectHint } from '$lib/domain/entry';

export interface LifeEventProjection {
	placed: readonly Entry[];
	unplaced: readonly Entry[];
}

export interface FinancialBaseline {
	salary: Entry | null;
	payFrequency: Entry | null;
	rent: Entry | null;
	confirmedRecurring: readonly Entry[];
	possibleRecurring: readonly Entry[];
	confirmedSubscriptions: readonly Entry[];
	unverifiedSubscriptions: readonly Entry[];
	confirmedMonthlyTotals: Readonly<Record<string, number>>;
	possibleMonthlyTotals: Readonly<Record<string, number>>;
	missingValueEntryIds: readonly string[];
	verificationEntryIds: readonly string[];
}

function temporalSortValue(entry: Entry): string {
	return entry.temporal?.latest ?? entry.temporal?.earliest ?? '';
}

export function projectLifeEvents(entries: readonly Entry[]): LifeEventProjection {
	const events = entries.filter(
		(entry) => entry.status !== 'trashed' && entry.captureIntent === 'life-event'
	);
	const placed = events
		.filter((entry) => Boolean(entry.temporal?.earliest || entry.temporal?.latest))
		.sort(
			(left, right) =>
				temporalSortValue(right).localeCompare(temporalSortValue(left)) ||
				right.createdAt.valueOf() - left.createdAt.valueOf() ||
				left.id.localeCompare(right.id)
		);
	const placedIds = new Set(placed.map((entry) => entry.id));
	return {
		placed,
		unplaced: events
			.filter((entry) => !placedIds.has(entry.id))
			.sort(
				(left, right) =>
					right.createdAt.valueOf() - left.createdAt.valueOf() || left.id.localeCompare(right.id)
			)
	};
}

export function normalizeMonthlyAmount(
	money: Money | null,
	cadence: RecurrenceCadence,
	interval = 1
): Money | null {
	if (!money || !Number.isInteger(interval) || interval <= 0) return null;
	const factor =
		cadence === 'weekly'
			? 52 / 12
			: cadence === 'biweekly'
				? 26 / 12
				: cadence === 'semimonthly'
					? 2
					: cadence === 'monthly'
						? 1
						: cadence === 'quarterly'
							? 1 / 3
							: cadence === 'yearly'
								? 1 / 12
								: null;
	if (factor === null) return null;
	return {
		minorUnits: Math.round((money.minorUnits * factor) / interval),
		currency: money.currency
	};
}

function effectiveStart(entry: Entry): string {
	return (
		entry.standingRecord?.effectiveFrom?.latest ??
		entry.standingRecord?.effectiveFrom?.earliest ??
		''
	);
}

export function selectCurrentStandingRecord(
	entries: readonly Entry[],
	subjectHint: StandingSubjectHint
): Entry | null {
	return (
		entries
			.filter(
				(entry) =>
					entry.status === 'active' &&
					entry.standingRecord?.subjectHint === subjectHint &&
					entry.standingRecord.state === 'current'
			)
			.sort(
				(left, right) =>
					effectiveStart(right).localeCompare(effectiveStart(left)) ||
					right.updatedAt.valueOf() - left.updatedAt.valueOf() ||
					left.id.localeCompare(right.id)
			)[0] ?? null
	);
}

function isOutflow(entry: Entry): boolean {
	const kind = entry.recurrence?.recurringKind;
	return kind !== 'income' && kind !== 'transfer';
}

function isConfirmedRecurrence(entry: Entry): boolean {
	return (
		entry.status === 'active' &&
		entry.recurrence?.activeState === 'active' &&
		entry.recurrence.verificationStatus === 'confirmed'
	);
}

function isPossibleRecurrence(entry: Entry): boolean {
	return (
		entry.status === 'active' &&
		Boolean(entry.recurrence) &&
		entry.recurrence?.activeState !== 'ended' &&
		!isConfirmedRecurrence(entry)
	);
}

function addTotals(entries: readonly Entry[]): Readonly<Record<string, number>> {
	const totals: Record<string, number> = {};
	for (const entry of entries) {
		if (!entry.recurrence) continue;
		const monthly = normalizeMonthlyAmount(
			entry.money,
			entry.recurrence.cadence,
			entry.recurrence.interval
		);
		if (!monthly) continue;
		totals[monthly.currency] = (totals[monthly.currency] ?? 0) + monthly.minorUnits;
	}
	return Object.fromEntries(
		Object.entries(totals).sort(([left], [right]) => left.localeCompare(right))
	);
}

function conflictingStandingIds(entries: readonly Entry[]): Set<string> {
	const bySubject = new Map<string, Entry[]>();
	for (const entry of entries) {
		const standing = entry.standingRecord;
		if (
			entry.status !== 'active' ||
			standing?.state !== 'current' ||
			!standing.subjectHint ||
			standing.subjectHint === 'other'
		) {
			continue;
		}
		const group = bySubject.get(standing.subjectHint) ?? [];
		group.push(entry);
		bySubject.set(standing.subjectHint, group);
	}
	return new Set(
		[...bySubject.values()]
			.filter((group) => group.length > 1)
			.flatMap((group) => group.map((entry) => entry.id))
	);
}

export function verificationReasons(
	entry: Entry,
	conflictingIds: ReadonlySet<string> = new Set()
): readonly string[] {
	const reasons = new Set<string>();
	const standing = entry.standingRecord;
	const recurrence = entry.recurrence;
	if (standing && ['remembered', 'suspected', 'disputed'].includes(standing.verificationStatus)) {
		reasons.add('Verification');
	}
	if (
		recurrence &&
		['remembered', 'suspected', 'disputed'].includes(recurrence.verificationStatus)
	) {
		reasons.add('Verification');
	}
	if (recurrence?.activeState === 'possibly-active' || recurrence?.activeState === 'unknown') {
		reasons.add('Active State');
	}
	if (recurrence && isOutflow(entry) && !entry.money) reasons.add('Missing Amount');
	if (recurrence?.cadence === 'unknown') reasons.add('Missing Cadence');
	if (
		entry.captureIntent === 'life-event' &&
		(!entry.temporal ||
			(['relative', 'unknown'].includes(entry.temporal.precision) &&
				!entry.temporal.reviewedByUser))
	) {
		reasons.add('Time');
	}
	if (standing?.state === 'current' && !standing.effectiveFrom) reasons.add('Missing Start');
	if (conflictingIds.has(entry.id)) reasons.add('Conflict');
	return [...reasons];
}

export function projectUnverified(entries: readonly Entry[]): readonly Entry[] {
	const active = entries.filter((entry) => entry.status === 'active');
	const conflicts = conflictingStandingIds(active);
	return active
		.filter((entry) => verificationReasons(entry, conflicts).length > 0)
		.sort(
			(left, right) =>
				verificationReasons(right, conflicts).length -
					verificationReasons(left, conflicts).length ||
				right.updatedAt.valueOf() - left.updatedAt.valueOf() ||
				left.id.localeCompare(right.id)
		);
}

export function verificationReasonsForCorpus(
	entries: readonly Entry[],
	entry: Entry
): readonly string[] {
	return verificationReasons(entry, conflictingStandingIds(entries));
}

export function buildFinancialBaseline(entries: readonly Entry[]): FinancialBaseline {
	const active = entries.filter((entry) => entry.status === 'active');
	const recurringOutflows = active.filter((entry) => entry.recurrence && isOutflow(entry));
	const confirmedRecurring = recurringOutflows.filter(isConfirmedRecurrence);
	const possibleRecurring = recurringOutflows.filter(isPossibleRecurrence);
	const subscriptions = recurringOutflows.filter(
		(entry) => entry.recurrence?.recurringKind === 'subscription'
	);
	const unverified = projectUnverified(active);
	const missingValueEntryIds = recurringOutflows
		.filter(
			(entry) =>
				!entry.money ||
				entry.recurrence?.cadence === 'unknown' ||
				entry.recurrence?.cadence === 'irregular'
		)
		.map((entry) => entry.id)
		.sort();

	return {
		salary: selectCurrentStandingRecord(active, 'salary'),
		payFrequency: selectCurrentStandingRecord(active, 'pay-frequency'),
		rent: selectCurrentStandingRecord(active, 'rent'),
		confirmedRecurring,
		possibleRecurring,
		confirmedSubscriptions: subscriptions.filter(isConfirmedRecurrence),
		unverifiedSubscriptions: subscriptions.filter((entry) => !isConfirmedRecurrence(entry)),
		confirmedMonthlyTotals: addTotals(confirmedRecurring),
		possibleMonthlyTotals: addTotals(possibleRecurring),
		missingValueEntryIds,
		verificationEntryIds: unverified.map((entry) => entry.id)
	};
}

export function projectSubscriptions(entries: readonly Entry[]): readonly Entry[] {
	return entries
		.filter(
			(entry) => entry.status !== 'trashed' && entry.recurrence?.recurringKind === 'subscription'
		)
		.sort(
			(left, right) =>
				right.updatedAt.valueOf() - left.updatedAt.valueOf() || left.id.localeCompare(right.id)
		);
}
