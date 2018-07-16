/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NotificationType, RequestType } from 'vscode-languageclient';
import * as sqlops from 'sqlops';

import { ITelemetryEventProperties, ITelemetryEventMeasures } from './telemetry';

// ------------------------------- < Telemetry Sent Event > ------------------------------------

/**
 * Event sent when the language service send a telemetry event
 */
export namespace TelemetryNotification {
	export const type = new NotificationType<TelemetryParams, void>('telemetry/sqlevent');
}

/**
 * Update event parameters
 */
export class TelemetryParams {
	public params: {
		eventName: string;
		properties: ITelemetryEventProperties;
		measures: ITelemetryEventMeasures;
	};
}

// ------------------------------- </ Telemetry Sent Event > ----------------------------------


// Job Management types
export interface AgentJobsParams {
	ownerUri: string;
	jobId: string;
}

export interface AgentJobsResult {
	succeeded: boolean;
	errorMessage: string;
	jobs: sqlops.AgentJobInfo[];
}

export interface AgentJobHistoryParams {
	ownerUri: string;
	jobId: string;
}

export interface AgentJobHistoryResult {
	succeeded: boolean;
	errorMessage: string;
	jobs: sqlops.AgentJobHistoryInfo[];
}

export interface AgentJobActionParams {
	ownerUri: string;
	jobName: string;
	action: string;
}

export interface AgentJobActionResult {
	succeeded: boolean;
	errorMessage: string;
}

export namespace AgentJobsRequest {
	export const type = new RequestType<AgentJobsParams, AgentJobsResult, void, void>('agent/jobs');
}

export namespace AgentJobHistoryRequest {
	export const type = new RequestType<AgentJobHistoryParams, AgentJobHistoryResult, void, void>('agent/jobhistory');
}


export namespace AgentJobActionRequest {
	export const type = new RequestType<AgentJobActionParams, AgentJobActionResult, void, void>('agent/jobaction');
}
