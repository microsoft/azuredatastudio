/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from 'vs/platform/log/common/log';
import { BottomUpSample } from 'vs/platform/profiling/common/profilingModel';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { errorHandler } from 'vs/base/common/errors';

type TelemetrySampleData = {
	selfTime: number;
	totalTime: number;
	percentage: number;
	perfBaseline: number;
	functionName: string;
	callers: string;
	callersAnnotated: string;
	source: string;
};

type TelemetrySampleDataClassification = {
	owner: 'jrieken';
	comment: 'A callstack that took a long time to execute';
	selfTime: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Self time of the sample' };
	totalTime: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Total time of the sample' };
	percentage: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Relative time (percentage) of the sample' };
	perfBaseline: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Performance baseline for the machine' };
	functionName: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The name of the sample' };
	callers: { classification: 'CallstackOrException'; purpose: 'PerformanceAndHealth'; comment: 'The heaviest call trace into this sample' };
	callersAnnotated: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The heaviest call trace into this sample annotated with respective costs' };
	source: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The source - either renderer or an extension' };
};

export interface SampleData {
	perfBaseline: number;
	sample: BottomUpSample;
	source: string;
}

export function reportSample(data: SampleData, telemetryService: ITelemetryService, logService: ILogService, sendAsErrorTelemtry: boolean): void {

	const { sample, perfBaseline, source } = data;

	// send telemetry event
	telemetryService.publicLog2<TelemetrySampleData, TelemetrySampleDataClassification>(`unresponsive.sample`, {
		perfBaseline,
		selfTime: sample.selfTime,
		totalTime: sample.totalTime,
		percentage: sample.percentage,
		functionName: sample.location,
		callers: sample.caller.map(c => c.location).join('<'),
		callersAnnotated: sample.caller.map(c => `${c.percentage}|${c.location}`).join('<'),
		source
	});

	// log a fake error with a clearer stack
	const fakeError = new PerformanceError(data);
	if (sendAsErrorTelemtry) {
		errorHandler.onUnexpectedError(fakeError);
	} else {
		logService.error(fakeError);
	}
}

class PerformanceError extends Error {
	readonly selfTime: number;

	constructor(data: SampleData) {
		super(`PerfSampleError: by ${data.source} in ${data.sample.location}`);
		this.name = 'PerfSampleError';
		this.selfTime = data.sample.selfTime;

		const trace = [data.sample.absLocation, ...data.sample.caller.map(c => c.absLocation)];
		this.stack = `\n\t at ${trace.join('\n\t at ')}`;
	}
}
