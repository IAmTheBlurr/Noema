<script lang="ts">
	import type { EntryDraft } from '$lib/domain/entry';

	let {
		draft = $bindable(),
		errors
	}: {
		draft: EntryDraft;
		errors: Readonly<Record<string, string>>;
	} = $props();
</script>

<div class="optional-grid">
	<label class="field wide">
		<span>URL</span>
		<input type="url" bind:value={draft.url} aria-invalid={Boolean(errors.url)} />
		{#if errors.url}<small class="field-error">{errors.url}</small>{/if}
	</label>
	<label class="field">
		<span>Amount</span>
		<input
			type="text"
			inputmode="decimal"
			bind:value={draft.amount}
			aria-invalid={Boolean(errors.amount)}
		/>
		{#if errors.amount}<small class="field-error">{errors.amount}</small>{/if}
	</label>
	<label class="field currency">
		<span>Currency</span>
		<input
			maxlength="3"
			autocomplete="off"
			bind:value={draft.currency}
			oninput={() => (draft.currency = draft.currency.toUpperCase())}
			aria-invalid={Boolean(errors.currency)}
		/>
		{#if errors.currency}<small class="field-error">{errors.currency}</small>{/if}
	</label>

	{#if draft.captureIntent === 'thought'}
		<label class="field wide">
			<span>Date</span>
			<input
				type="text"
				bind:value={draft.timeHorizon}
				aria-invalid={Boolean(errors.timeHorizon)}
			/>
			{#if errors.timeHorizon}<small class="field-error">{errors.timeHorizon}</small>{/if}
		</label>
	{/if}

	{#if draft.captureIntent === 'life-event'}
		<fieldset class="capability-fields">
			<legend>Time</legend>
			<label class="field full">
				<span>When</span>
				<input
					type="text"
					bind:value={draft.temporalRawText}
					aria-invalid={Boolean(errors.temporalRawText)}
				/>
				{#if errors.temporalRawText}
					<small class="field-error">{errors.temporalRawText}</small>
				{/if}
			</label>
			<label class="field">
				<span>Earliest</span>
				<input
					type="date"
					bind:value={draft.temporalEarliest}
					aria-invalid={Boolean(errors.temporalEarliest)}
				/>
				{#if errors.temporalEarliest}
					<small class="field-error">{errors.temporalEarliest}</small>
				{/if}
			</label>
			<label class="field">
				<span>Latest</span>
				<input
					type="date"
					bind:value={draft.temporalLatest}
					aria-invalid={Boolean(errors.temporalLatest)}
				/>
				{#if errors.temporalLatest}
					<small class="field-error">{errors.temporalLatest}</small>
				{/if}
			</label>
			<label class="field">
				<span>Precision</span>
				<select bind:value={draft.temporalPrecision}>
					<option value="exact">Exact</option>
					<option value="day">Day</option>
					<option value="month">Month</option>
					<option value="season">Season</option>
					<option value="year">Year</option>
					<option value="range">Range</option>
					<option value="relative">Relative</option>
					<option value="unknown">Unknown</option>
				</select>
			</label>
			<label class="check-field">
				<input type="checkbox" bind:checked={draft.temporalReviewed} />
				<span>Reviewed</span>
			</label>
		</fieldset>
	{/if}

	{#if draft.captureIntent === 'recurring-commitment'}
		<label class="check-field capability-switch">
			<input type="checkbox" bind:checked={draft.enableStanding} />
			<span>Standing</span>
		</label>
	{/if}

	{#if draft.enableStanding || draft.captureIntent === 'standing-record'}
		<fieldset class="capability-fields">
			<legend>Standing</legend>
			<label class="field">
				<span>Subject</span>
				<select bind:value={draft.standingSubjectHint}>
					<option value="">Unknown</option>
					<option value="salary">Salary</option>
					<option value="pay-frequency">Pay Frequency</option>
					<option value="rent">Rent</option>
					<option value="employment">Employment</option>
					<option value="bank">Bank</option>
					<option value="vehicle">Vehicle</option>
					<option value="housing">Housing</option>
					<option value="insurance">Insurance</option>
					<option value="other">Other</option>
				</select>
			</label>
			<label class="field">
				<span>Value</span>
				<input
					bind:value={draft.standingValueText}
					aria-invalid={Boolean(errors.standingValueText)}
				/>
				{#if errors.standingValueText}
					<small class="field-error">{errors.standingValueText}</small>
				{/if}
			</label>
			<label class="field">
				<span>Standing Start</span>
				<input
					type="date"
					bind:value={draft.standingEffectiveFrom}
					aria-invalid={Boolean(errors.standingEffectiveFrom)}
				/>
				{#if errors.standingEffectiveFrom}
					<small class="field-error">{errors.standingEffectiveFrom}</small>
				{/if}
			</label>
			<label class="field">
				<span>Standing End</span>
				<input
					type="date"
					bind:value={draft.standingEffectiveUntil}
					aria-invalid={Boolean(errors.standingEffectiveUntil)}
				/>
				{#if errors.standingEffectiveUntil}
					<small class="field-error">{errors.standingEffectiveUntil}</small>
				{/if}
			</label>
			<label class="field">
				<span>Verification</span>
				<select bind:value={draft.standingVerificationStatus}>
					<option value="remembered">Remembered</option>
					<option value="suspected">Suspected</option>
					<option value="confirmed">Confirmed</option>
					<option value="changed">Changed</option>
					<option value="ended">Ended</option>
					<option value="disputed">Disputed</option>
				</select>
			</label>
			<label class="field">
				<span>State</span>
				<select bind:value={draft.standingState}>
					<option value="current">Current</option>
					<option value="ended">Ended</option>
					<option value="unknown">Unknown</option>
				</select>
			</label>
		</fieldset>
	{/if}

	{#if draft.captureIntent === 'standing-record'}
		<label class="check-field capability-switch">
			<input type="checkbox" bind:checked={draft.enableRecurrence} />
			<span>Recurring</span>
		</label>
	{/if}

	{#if draft.enableRecurrence || draft.captureIntent === 'recurring-commitment'}
		<fieldset class="capability-fields">
			<legend>Recurring</legend>
			<label class="field">
				<span>Kind</span>
				<select bind:value={draft.recurringKind}>
					<option value="">Unknown</option>
					<option value="subscription">Subscription</option>
					<option value="rent">Rent</option>
					<option value="utility">Utility</option>
					<option value="insurance">Insurance</option>
					<option value="membership">Membership</option>
					<option value="debt-payment">Debt Payment</option>
					<option value="income">Income</option>
					<option value="transfer">Transfer</option>
					<option value="other">Other</option>
				</select>
			</label>
			<label class="field">
				<span>Cadence</span>
				<select bind:value={draft.recurrenceCadence}>
					<option value="weekly">Weekly</option>
					<option value="biweekly">Biweekly</option>
					<option value="semimonthly">Semimonthly</option>
					<option value="monthly">Monthly</option>
					<option value="quarterly">Quarterly</option>
					<option value="yearly">Yearly</option>
					<option value="irregular">Irregular</option>
					<option value="unknown">Unknown</option>
				</select>
			</label>
			<label class="field">
				<span>Interval</span>
				<input
					type="number"
					min="1"
					step="1"
					bind:value={draft.recurrenceInterval}
					aria-invalid={Boolean(errors.recurrenceInterval)}
				/>
				{#if errors.recurrenceInterval}
					<small class="field-error">{errors.recurrenceInterval}</small>
				{/if}
			</label>
			<label class="field">
				<span>Due</span>
				<input bind:value={draft.dueDescription} aria-invalid={Boolean(errors.dueDescription)} />
				{#if errors.dueDescription}
					<small class="field-error">{errors.dueDescription}</small>
				{/if}
			</label>
			<label class="field">
				<span>Recurring Start</span>
				<input
					type="date"
					bind:value={draft.recurrenceEffectiveFrom}
					aria-invalid={Boolean(errors.recurrenceEffectiveFrom)}
				/>
				{#if errors.recurrenceEffectiveFrom}
					<small class="field-error">{errors.recurrenceEffectiveFrom}</small>
				{/if}
			</label>
			<label class="field">
				<span>Recurring End</span>
				<input
					type="date"
					bind:value={draft.recurrenceEffectiveUntil}
					aria-invalid={Boolean(errors.recurrenceEffectiveUntil)}
				/>
				{#if errors.recurrenceEffectiveUntil}
					<small class="field-error">{errors.recurrenceEffectiveUntil}</small>
				{/if}
			</label>
			<label class="field">
				<span>Verification</span>
				<select bind:value={draft.recurrenceVerificationStatus}>
					<option value="remembered">Remembered</option>
					<option value="suspected">Suspected</option>
					<option value="confirmed">Confirmed</option>
					<option value="changed">Changed</option>
					<option value="ended">Ended</option>
					<option value="disputed">Disputed</option>
				</select>
			</label>
			<label class="field">
				<span>Active State</span>
				<select bind:value={draft.recurrenceActiveState}>
					<option value="active">Active</option>
					<option value="possibly-active">Possibly Active</option>
					<option value="ended">Ended</option>
					<option value="unknown">Unknown</option>
				</select>
			</label>
			<label class="check-field">
				<input type="checkbox" bind:checked={draft.autoRenew} />
				<span>Auto Renew</span>
			</label>
			<label class="field">
				<span>Payment Source</span>
				<input
					bind:value={draft.paymentSourceText}
					aria-invalid={Boolean(errors.paymentSourceText)}
				/>
				{#if errors.paymentSourceText}
					<small class="field-error">{errors.paymentSourceText}</small>
				{/if}
			</label>
			<label class="field wide">
				<span>Cancel URL</span>
				<input
					type="url"
					bind:value={draft.cancellationUrl}
					aria-invalid={Boolean(errors.cancellationUrl)}
				/>
				{#if errors.cancellationUrl}
					<small class="field-error">{errors.cancellationUrl}</small>
				{/if}
			</label>
			<label class="field">
				<span>Last Charge</span>
				<input
					type="date"
					bind:value={draft.lastKnownCharge}
					aria-invalid={Boolean(errors.lastKnownCharge)}
				/>
				{#if errors.lastKnownCharge}
					<small class="field-error">{errors.lastKnownCharge}</small>
				{/if}
			</label>
		</fieldset>
	{/if}

	<label class="field full">
		<span>Notes</span>
		<textarea rows="3" bind:value={draft.notes} aria-invalid={Boolean(errors.notes)}></textarea>
		{#if errors.notes}<small class="field-error">{errors.notes}</small>{/if}
	</label>
</div>
