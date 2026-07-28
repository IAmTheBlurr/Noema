export const ENTRY_SCHEMA_VERSION = 2 as const;

export type StoredEntrySchemaVersion = 1 | typeof ENTRY_SCHEMA_VERSION;
export type EntryStatus = 'active' | 'archived' | 'trashed';
export type CaptureIntent = 'thought' | 'life-event' | 'standing-record' | 'recurring-commitment';
export type TemporalPrecision =
	'exact' | 'day' | 'month' | 'season' | 'year' | 'range' | 'relative' | 'unknown';
export type TemporalSource = 'human' | 'llm-inferred' | 'document-derived' | 'system-derived';
export type VerificationStatus =
	'remembered' | 'suspected' | 'confirmed' | 'changed' | 'ended' | 'disputed';
export type StandingSubjectHint =
	| 'salary'
	| 'pay-frequency'
	| 'rent'
	| 'employment'
	| 'bank'
	| 'vehicle'
	| 'housing'
	| 'insurance'
	| 'other';
export type RecurrenceCadence =
	| 'weekly'
	| 'biweekly'
	| 'semimonthly'
	| 'monthly'
	| 'quarterly'
	| 'yearly'
	| 'irregular'
	| 'unknown';
export type RecurringKind =
	| 'subscription'
	| 'rent'
	| 'utility'
	| 'insurance'
	| 'membership'
	| 'debt-payment'
	| 'income'
	| 'transfer'
	| 'other';

export interface Money {
	minorUnits: number;
	currency: string;
}

export interface TemporalExpression {
	rawText?: string;
	earliest?: string;
	latest?: string;
	precision: TemporalPrecision;
	source: TemporalSource;
	confidence?: number;
	reviewedByUser: boolean;
}

export interface StandingRecordDetails {
	subjectHint?: StandingSubjectHint;
	valueText?: string;
	effectiveFrom?: TemporalExpression;
	effectiveUntil?: TemporalExpression;
	verificationStatus: VerificationStatus;
	state: 'current' | 'ended' | 'unknown';
}

export interface RecurrenceDetails {
	recurringKind?: RecurringKind;
	cadence: RecurrenceCadence;
	interval?: number;
	dueDescription?: string;
	effectiveFrom?: TemporalExpression;
	effectiveUntil?: TemporalExpression;
	verificationStatus: VerificationStatus;
	activeState: 'active' | 'possibly-active' | 'ended' | 'unknown';
	autoRenew?: boolean;
	paymentSourceText?: string;
	cancellationUrl?: string;
	lastKnownCharge?: TemporalExpression;
}

export interface Entry {
	id: string;
	ownerId: string;
	rawText: string;
	captureIntent: CaptureIntent;
	url: string | null;
	money: Money | null;
	notes: string | null;
	timeHorizon: string | null;
	temporal: TemporalExpression | null;
	standingRecord: StandingRecordDetails | null;
	recurrence: RecurrenceDetails | null;
	status: EntryStatus;
	recurrenceCount: number;
	createdAt: Date;
	updatedAt: Date;
	archivedAt: Date | null;
	trashedAt: Date | null;
	schemaVersion: StoredEntrySchemaVersion;
}

export interface EntryDraft {
	rawText: string;
	captureIntent: CaptureIntent;
	url: string;
	amount: string | number;
	currency: string;
	notes: string;
	timeHorizon: string;
	temporalRawText: string;
	temporalEarliest: string;
	temporalLatest: string;
	temporalPrecision: TemporalPrecision;
	temporalReviewed: boolean;
	enableStanding: boolean;
	standingSubjectHint: StandingSubjectHint | '';
	standingValueText: string;
	standingEffectiveFrom: string;
	standingEffectiveUntil: string;
	standingVerificationStatus: VerificationStatus;
	standingState: StandingRecordDetails['state'];
	enableRecurrence: boolean;
	recurringKind: RecurringKind | '';
	recurrenceCadence: RecurrenceCadence;
	recurrenceInterval: string | number;
	dueDescription: string;
	recurrenceEffectiveFrom: string;
	recurrenceEffectiveUntil: string;
	recurrenceVerificationStatus: VerificationStatus;
	recurrenceActiveState: RecurrenceDetails['activeState'];
	autoRenew: boolean;
	paymentSourceText: string;
	cancellationUrl: string;
	lastKnownCharge: string;
}

export type EntryEventType =
	| 'created'
	| 'edited'
	| 'resurfaced'
	| 'archived'
	| 'restored'
	| 'trashed'
	| 'restored_from_trash'
	| 'capture_intent_changed'
	| 'temporal_details_changed'
	| 'standing_record_changed'
	| 'recurrence_changed'
	| 'verification_changed'
	| 'record_ended'
	| 'record_reactivated';

export interface EntryEvent {
	id: string;
	ownerId: string;
	entryId: string;
	type: EntryEventType;
	occurredAt: Date;
	schemaVersion: StoredEntrySchemaVersion;
	changedFields: readonly string[];
	revision: EntryRevision | null;
}

export interface EntryRevision {
	rawText: string;
	url: string | null;
	money: Money | null;
	notes: string | null;
	timeHorizon: string | null;
}

export function emptyEntryDraft(captureIntent: CaptureIntent = 'thought'): EntryDraft {
	return {
		rawText: '',
		captureIntent,
		url: '',
		amount: '',
		currency: 'USD',
		notes: '',
		timeHorizon: '',
		temporalRawText: '',
		temporalEarliest: '',
		temporalLatest: '',
		temporalPrecision: 'unknown',
		temporalReviewed: false,
		enableStanding: captureIntent === 'standing-record',
		standingSubjectHint: '',
		standingValueText: '',
		standingEffectiveFrom: '',
		standingEffectiveUntil: '',
		standingVerificationStatus: 'remembered',
		standingState: 'current',
		enableRecurrence: captureIntent === 'recurring-commitment',
		recurringKind: '',
		recurrenceCadence: 'unknown',
		recurrenceInterval: '',
		dueDescription: '',
		recurrenceEffectiveFrom: '',
		recurrenceEffectiveUntil: '',
		recurrenceVerificationStatus: 'remembered',
		recurrenceActiveState: 'unknown',
		autoRenew: false,
		paymentSourceText: '',
		cancellationUrl: '',
		lastKnownCharge: ''
	};
}

function amountInput(money: Money | null): string {
	if (!money) return '';
	return (money.minorUnits / 100).toFixed(2).replace(/\.?0+$/, '');
}

function dateFromTemporal(value: TemporalExpression | undefined): string {
	return value?.earliest ?? '';
}

export function draftFromEntry(entry: Entry): EntryDraft {
	return {
		...emptyEntryDraft(entry.captureIntent),
		rawText: entry.rawText,
		url: entry.url ?? '',
		amount: amountInput(entry.money),
		currency: entry.money?.currency ?? 'USD',
		notes: entry.notes ?? '',
		timeHorizon: entry.timeHorizon ?? '',
		temporalRawText: entry.temporal?.rawText ?? '',
		temporalEarliest: entry.temporal?.earliest ?? '',
		temporalLatest: entry.temporal?.latest ?? '',
		temporalPrecision: entry.temporal?.precision ?? 'unknown',
		temporalReviewed: entry.temporal?.reviewedByUser ?? false,
		enableStanding: entry.standingRecord !== null,
		standingSubjectHint: entry.standingRecord?.subjectHint ?? '',
		standingValueText: entry.standingRecord?.valueText ?? '',
		standingEffectiveFrom: dateFromTemporal(entry.standingRecord?.effectiveFrom),
		standingEffectiveUntil: dateFromTemporal(entry.standingRecord?.effectiveUntil),
		standingVerificationStatus: entry.standingRecord?.verificationStatus ?? 'remembered',
		standingState: entry.standingRecord?.state ?? 'current',
		enableRecurrence: entry.recurrence !== null,
		recurringKind: entry.recurrence?.recurringKind ?? '',
		recurrenceCadence: entry.recurrence?.cadence ?? 'unknown',
		recurrenceInterval: entry.recurrence?.interval ?? '',
		dueDescription: entry.recurrence?.dueDescription ?? '',
		recurrenceEffectiveFrom: dateFromTemporal(entry.recurrence?.effectiveFrom),
		recurrenceEffectiveUntil: dateFromTemporal(entry.recurrence?.effectiveUntil),
		recurrenceVerificationStatus: entry.recurrence?.verificationStatus ?? 'remembered',
		recurrenceActiveState: entry.recurrence?.activeState ?? 'unknown',
		autoRenew: entry.recurrence?.autoRenew ?? false,
		paymentSourceText: entry.recurrence?.paymentSourceText ?? '',
		cancellationUrl: entry.recurrence?.cancellationUrl ?? '',
		lastKnownCharge: dateFromTemporal(entry.recurrence?.lastKnownCharge)
	};
}
