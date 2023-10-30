/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { inputLatency } from 'vs/base/browser/performance';
import { RunOnceScheduler } from 'vs/base/common/async';
import { Event } from 'vs/base/common/event';
import { Disposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class InputLatencyContrib extends Disposable implements IWorkbenchContribution {
	private readonly _listener = this._register(new MutableDisposable());
	private readonly _scheduler: RunOnceScheduler;

	constructor(
		@IEditorService private readonly _editorService: IEditorService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService
	) {
		super();

		// The current sampling strategy is when the active editor changes, start sampling and
		// report the results after 60 seconds. It's done this way as we don't want to sample
		// everything, just somewhat randomly, and using an interval would utilize CPU when the
		// application is inactive.
		this._scheduler = this._register(new RunOnceScheduler(() => {
			this._logSamples();
			this._setupListener();
		}, 60000));

		this._setupListener();
	}

	private _setupListener(): void {
		this._listener.value = Event.once(this._editorService.onDidActiveEditorChange)(() => this._scheduler.schedule());
	}

	private _logSamples(): void {
		const measurements = inputLatency.getAndClearMeasurements();
		if (!measurements) {
			return;
		}

		type InputLatencyStatisticFragment = {
			owner: 'tyriar';
			comment: 'Represents a set of statistics collected about input latencies';
			average: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The average time it took to execute.'; isMeasurement: true };
			max: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The maximum time it took to execute.'; isMeasurement: true };
			min: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The minimum time it took to execute.'; isMeasurement: true };
		};

		type PerformanceInputLatencyClassification = {
			owner: 'tyriar';
			comment: 'This is a set of samples of the time (in milliseconds) that various events took when typing in the editor';
			keydown: InputLatencyStatisticFragment;
			input: InputLatencyStatisticFragment;
			render: InputLatencyStatisticFragment;
			total: InputLatencyStatisticFragment;
			sampleCount: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'The number of samples measured.' };
		};

		type PerformanceInputLatencyEvent = inputLatency.IInputLatencyMeasurements;

		this._telemetryService.publicLog2<PerformanceInputLatencyEvent, PerformanceInputLatencyClassification>('performance.inputLatency', {
			keydown: measurements.keydown,
			input: measurements.input,
			render: measurements.render,
			total: measurements.total,
			sampleCount: measurements.sampleCount
		});
	}
}
