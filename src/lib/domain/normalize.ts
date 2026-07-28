import {
	ENTRY_SCHEMA_VERSION,
	type CaptureIntent,
	type Entry,
	type EntryEvent,
	type EntryEventType,
	type EntryRevision,
	type Money,
	type RecurrenceCadence,
	type RecurrenceDetails,
	type RecurringKind,
	type StandingRecordDetails,
	type StandingSubjectHint,
	type TemporalExpression,
	type TemporalPrecision,
	type TemporalSource,
	type VerificationStatus
} from '$lib/domain/entry';

type UnknownRecord = Readonly<Record<string, unknown>>;

function asRecord(value: unknown): UnknownRecord | null {
	return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function asDate(value: unknown): Date | null {
	if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
	const record = asRecord(value);
	const toDate = record?.toDate;
	if (typeof toDate === 'function') {
		const result = Reflect.apply(toDate, value, []);
		return result instanceof Date && !Number.isNaN(result.valueOf()) ? result : null;
	}
	return null;
}

function asNullableString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
	return typeof value === 'string' && values.includes(value as T);
}

const captureIntents = [
	'thought',
	'life-event',
	'standing-record',
	'recurring-commitment'
] as const satisfies readonly CaptureIntent[];
const temporalPrecisions = [
	'exact',
	'day',
	'month',
	'season',
	'year',
	'range',
	'relative',
	'unknown'
] as const satisfies readonly TemporalPrecision[];
const temporalSources = [
	'human',
	'llm-inferred',
	'document-derived',
	'system-derived'
] as const satisfies readonly TemporalSource[];
const verificationStatuses = [
	'remembered',
	'suspected',
	'confirmed',
	'changed',
	'ended',
	'disputed'
] as const satisfies readonly VerificationStatus[];
const standingHints = [
	'salary',
	'pay-frequency',
	'rent',
	'employment',
	'bank',
	'vehicle',
	'housing',
	'insurance',
	'other'
] as const satisfies readonly StandingSubjectHint[];
const cadences = [
	'weekly',
	'biweekly',
	'semimonthly',
	'monthly',
	'quarterly',
	'yearly',
	'irregular',
	'unknown'
] as const satisfies readonly RecurrenceCadence[];
const recurringKinds = [
	'subscription',
	'rent',
	'utility',
	'insurance',
	'membership',
	'debt-payment',
	'income',
	'transfer',
	'other'
] as const satisfies readonly RecurringKind[];
const eventTypes = [
	'created',
	'edited',
	'resurfaced',
	'archived',
	'restored',
	'trashed',
	'restored_from_trash',
	'capture_intent_changed',
	'temporal_details_changed',
	'standing_record_changed',
	'recurrence_changed',
	'verification_changed',
	'record_ended',
	'record_reactivated'
] as const satisfies readonly EntryEventType[];

export function moneyFromUnknown(value: unknown): Money | null {
	const record = asRecord(value);
	if (!record || typeof record.currency !== 'string') return null;
	if (Number.isSafeInteger(record.minorUnits) && Number(record.minorUnits) >= 0) {
		return { minorUnits: Number(record.minorUnits), currency: record.currency };
	}
	if (typeof record.amount === 'number' && Number.isFinite(record.amount) && record.amount >= 0) {
		const minorUnits = Math.round(record.amount * 100);
		return Number.isSafeInteger(minorUnits) ? { minorUnits, currency: record.currency } : null;
	}
	return null;
}

export function temporalFromUnknown(value: unknown): TemporalExpression | null {
	const record = asRecord(value);
	if (!record || !isOneOf(record.precision, temporalPrecisions)) return null;
	const source = isOneOf(record.source, temporalSources) ? record.source : 'human';
	const confidence =
		typeof record.confidence === 'number' &&
		Number.isFinite(record.confidence) &&
		record.confidence >= 0 &&
		record.confidence <= 1
			? record.confidence
			: undefined;
	return {
		...(asNullableString(record.rawText) ? { rawText: String(record.rawText) } : {}),
		...(asNullableString(record.earliest) ? { earliest: String(record.earliest) } : {}),
		...(asNullableString(record.latest) ? { latest: String(record.latest) } : {}),
		precision: record.precision,
		source,
		...(confidence === undefined ? {} : { confidence }),
		reviewedByUser: record.reviewedByUser === true
	};
}

function standingFromUnknown(value: unknown): StandingRecordDetails | null {
	const record = asRecord(value);
	if (!record) return null;
	const subjectHint = isOneOf(record.subjectHint, standingHints) ? record.subjectHint : undefined;
	const effectiveFrom = temporalFromUnknown(record.effectiveFrom);
	const effectiveUntil = temporalFromUnknown(record.effectiveUntil);
	return {
		...(subjectHint ? { subjectHint } : {}),
		...(asNullableString(record.valueText) ? { valueText: String(record.valueText) } : {}),
		...(effectiveFrom ? { effectiveFrom } : {}),
		...(effectiveUntil ? { effectiveUntil } : {}),
		verificationStatus: isOneOf(record.verificationStatus, verificationStatuses)
			? record.verificationStatus
			: 'remembered',
		state:
			record.state === 'current' || record.state === 'ended' || record.state === 'unknown'
				? record.state
				: 'unknown'
	};
}

function recurrenceFromUnknown(value: unknown): RecurrenceDetails | null {
	const record = asRecord(value);
	if (!record) return null;
	const recurringKind = isOneOf(record.recurringKind, recurringKinds)
		? record.recurringKind
		: undefined;
	const effectiveFrom = temporalFromUnknown(record.effectiveFrom);
	const effectiveUntil = temporalFromUnknown(record.effectiveUntil);
	const lastKnownCharge = temporalFromUnknown(record.lastKnownCharge);
	const interval =
		Number.isInteger(record.interval) && Number(record.interval) > 0
			? Number(record.interval)
			: undefined;
	return {
		...(recurringKind ? { recurringKind } : {}),
		cadence: isOneOf(record.cadence, cadences) ? record.cadence : 'unknown',
		...(interval ? { interval } : {}),
		...(asNullableString(record.dueDescription)
			? { dueDescription: String(record.dueDescription) }
			: {}),
		...(effectiveFrom ? { effectiveFrom } : {}),
		...(effectiveUntil ? { effectiveUntil } : {}),
		verificationStatus: isOneOf(record.verificationStatus, verificationStatuses)
			? record.verificationStatus
			: 'remembered',
		activeState:
			record.activeState === 'active' ||
			record.activeState === 'possibly-active' ||
			record.activeState === 'ended' ||
			record.activeState === 'unknown'
				? record.activeState
				: 'unknown',
		...(typeof record.autoRenew === 'boolean' ? { autoRenew: record.autoRenew } : {}),
		...(asNullableString(record.paymentSourceText)
			? { paymentSourceText: String(record.paymentSourceText) }
			: {}),
		...(asNullableString(record.cancellationUrl)
			? { cancellationUrl: String(record.cancellationUrl) }
			: {}),
		...(lastKnownCharge ? { lastKnownCharge } : {})
	};
}

export function normalizeEntryDocument(id: string, value: unknown): Entry {
	const data = asRecord(value) ?? {};
	const createdAt = asDate(data.createdAt) ?? new Date(0);
	return {
		id,
		ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
		rawText: typeof data.rawText === 'string' ? data.rawText : '',
		captureIntent: isOneOf(data.captureIntent, captureIntents) ? data.captureIntent : 'thought',
		url: asNullableString(data.url),
		money: moneyFromUnknown(data.money),
		notes: asNullableString(data.notes),
		timeHorizon: asNullableString(data.timeHorizon),
		temporal: temporalFromUnknown(data.temporal),
		standingRecord: standingFromUnknown(data.standingRecord),
		recurrence: recurrenceFromUnknown(data.recurrence),
		status: data.status === 'archived' || data.status === 'trashed' ? data.status : 'active',
		recurrenceCount:
			typeof data.recurrenceCount === 'number' && Number.isInteger(data.recurrenceCount)
				? data.recurrenceCount
				: 0,
		createdAt,
		updatedAt: asDate(data.updatedAt) ?? createdAt,
		archivedAt: asDate(data.archivedAt),
		trashedAt: asDate(data.trashedAt),
		schemaVersion: data.schemaVersion === ENTRY_SCHEMA_VERSION ? ENTRY_SCHEMA_VERSION : 1
	};
}

function revisionFromUnknown(value: unknown): EntryRevision | null {
	const record = asRecord(value);
	if (!record || typeof record.rawText !== 'string' || record.rawText.length === 0) return null;
	return {
		rawText: record.rawText,
		url: asNullableString(record.url),
		money: moneyFromUnknown(record.money),
		notes: asNullableString(record.notes),
		timeHorizon: asNullableString(record.timeHorizon)
	};
}

export function normalizeEventDocument(id: string, value: unknown): EntryEvent {
	const data = asRecord(value) ?? {};
	return {
		id,
		ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
		entryId: typeof data.entryId === 'string' ? data.entryId : '',
		type: isOneOf(data.type, eventTypes) ? data.type : 'created',
		occurredAt: asDate(data.occurredAt) ?? new Date(0),
		schemaVersion: data.schemaVersion === ENTRY_SCHEMA_VERSION ? ENTRY_SCHEMA_VERSION : 1,
		changedFields: Array.isArray(data.changedFields)
			? data.changedFields.filter((item): item is string => typeof item === 'string')
			: [],
		revision: revisionFromUnknown(data.revision)
	};
}
