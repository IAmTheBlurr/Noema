<script lang="ts">
	import type { Entry, Money } from '$lib/domain/entry';
	import type { FinancialBaseline } from '$lib/domain/projections';

	let {
		baseline,
		onOpen
	}: {
		baseline: FinancialBaseline;
		onOpen: (entry: Entry) => void;
	} = $props();

	function moneyValue(money: Money): string {
		try {
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: money.currency
			}).format(money.minorUnits / 100);
		} catch {
			return `${(money.minorUnits / 100).toLocaleString('en-US')} ${money.currency}`;
		}
	}

	function recordValue(entry: Entry | null): string {
		if (!entry) return 'Missing';
		if (entry.money) return moneyValue(entry.money);
		return entry.standingRecord?.valueText ?? entry.rawText;
	}

	function totalsValue(totals: Readonly<Record<string, number>>): string {
		const values = Object.entries(totals).map(([currency, minorUnits]) =>
			moneyValue({ currency, minorUnits })
		);
		return values.length > 0 ? values.join(' · ') : 'Missing';
	}
</script>

<div class="baseline-grid">
	<button
		class="baseline-value"
		class:missing={!baseline.salary}
		type="button"
		disabled={!baseline.salary}
		onclick={() => baseline.salary && onOpen(baseline.salary)}
	>
		<span>Salary</span>
		<strong>{recordValue(baseline.salary)}</strong>
	</button>
	<button
		class="baseline-value"
		class:missing={!baseline.payFrequency}
		type="button"
		disabled={!baseline.payFrequency}
		onclick={() => baseline.payFrequency && onOpen(baseline.payFrequency)}
	>
		<span>Pay frequency</span>
		<strong>{recordValue(baseline.payFrequency)}</strong>
	</button>
	<button
		class="baseline-value"
		class:missing={!baseline.rent}
		type="button"
		disabled={!baseline.rent}
		onclick={() => baseline.rent && onOpen(baseline.rent)}
	>
		<span>Rent</span>
		<strong>{recordValue(baseline.rent)}</strong>
	</button>
	<div class="baseline-value">
		<span>Confirmed outflow</span>
		<strong>{totalsValue(baseline.confirmedMonthlyTotals)}</strong>
		<small>Estimate</small>
	</div>
	<div class="baseline-value">
		<span>Possible outflow</span>
		<strong>{totalsValue(baseline.possibleMonthlyTotals)}</strong>
		<small>Estimate</small>
	</div>
	<div class="baseline-value">
		<span>Confirmed recurring</span>
		<strong>{baseline.confirmedRecurring.length}</strong>
	</div>
	<div class="baseline-value">
		<span>Possible recurring</span>
		<strong>{baseline.possibleRecurring.length}</strong>
	</div>
	<div class="baseline-value">
		<span>Confirmed subscriptions</span>
		<strong>{baseline.confirmedSubscriptions.length}</strong>
	</div>
	<div class="baseline-value">
		<span>Suspected subscriptions</span>
		<strong>{baseline.unverifiedSubscriptions.length}</strong>
	</div>
	<div class="baseline-value">
		<span>Missing values</span>
		<strong>{baseline.missingValueEntryIds.length}</strong>
	</div>
	<div class="baseline-value">
		<span>Verification</span>
		<strong>{baseline.verificationEntryIds.length}</strong>
	</div>
</div>
