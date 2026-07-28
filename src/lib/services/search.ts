import type { Entry } from '$lib/domain/entry';

export interface EntrySearchService {
	search(entries: readonly Entry[], query: string): readonly Entry[];
}

function normalize(value: string): string {
	return value.normalize('NFKD').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export const boundedClientSearch: EntrySearchService = {
	search(entries, query) {
		const terms = normalize(query).split(' ').filter(Boolean);
		if (terms.length === 0) return entries;

		return entries.filter((entry) => {
			const haystack = normalize(
				[
					entry.rawText,
					entry.notes ?? '',
					entry.url ?? '',
					entry.timeHorizon ?? '',
					entry.temporal?.rawText ?? '',
					entry.standingRecord?.subjectHint ?? '',
					entry.standingRecord?.valueText ?? '',
					entry.recurrence?.recurringKind ?? '',
					entry.recurrence?.paymentSourceText ?? '',
					entry.money ? `${entry.money.minorUnits / 100} ${entry.money.currency}` : ''
				].join(' ')
			);
			return terms.every((term) => haystack.includes(term));
		});
	}
};
