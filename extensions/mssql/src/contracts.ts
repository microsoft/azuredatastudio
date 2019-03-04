/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { NotificationType, RequestType } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from './telemetry';
import * as azdata from 'azdata';

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

// ------------------------------- < Agent Management > ------------------------------------
// Job management parameters
export interface AgentJobsParams {
	ownerUri: string;
	jobId: string;
}

export interface AgentJobHistoryParams {
	ownerUri: string;
	jobId: string;
	jobName: string;
}

export interface AgentJobActionParams {
	ownerUri: string;
	jobName: string;
	action: string;
}

export interface CreateAgentJobParams {
	ownerUri: string;
	job: azdata.AgentJobInfo;
}

export interface UpdateAgentJobParams {
	ownerUri: string;
	originalJobName: string;
	job: azdata.AgentJobInfo;
}

export interface DeleteAgentJobParams {
	ownerUri: string;
	job: azdata.AgentJobInfo;
}

export interface AgentJobDefaultsParams {
	ownerUri: string;
}

// Job Step management parameters
export interface CreateAgentJobStepParams {
	ownerUri: string;
	step: azdata.AgentJobStepInfo;
}

export interface UpdateAgentJobStepParams {
	ownerUri: string;
	originalJobStepName: string;
	step: azdata.AgentJobStepInfo;
}

export interface DeleteAgentJobStepParams {
	ownerUri: string;
	step: azdata.AgentJobStepInfo;
}

// Alert management parameters
export interface AgentAlertsParams {
	ownerUri: string;
}

export interface CreateAgentAlertParams {
	ownerUri: string;
	alert: azdata.AgentAlertInfo;
}

export interface UpdateAgentAlertParams {
	ownerUri: string;
	originalAlertName: string;
	alert: azdata.AgentAlertInfo;
}

export interface DeleteAgentAlertParams {
	ownerUri: string;
	alert: azdata.AgentAlertInfo;
}

// Operator management parameters
export interface AgentOperatorsParams {
	ownerUri: string;
}

export interface CreateAgentOperatorParams {
	ownerUri: string;
	operator: azdata.AgentOperatorInfo;
}

export interface UpdateAgentOperatorParams {
	ownerUri: string;
	originalOperatorName: string;
	operator: azdata.AgentOperatorInfo;
}

export interface DeleteAgentOperatorParams {
	ownerUri: string;
	operator: azdata.AgentOperatorInfo;
}

// Proxy management parameters
export interface AgentProxiesParams {
	ownerUri: string;
}

export interface CreateAgentProxyParams {
	ownerUri: string;
	proxy: azdata.AgentProxyInfo;
}

export interface UpdateAgentProxyParams {
	ownerUri: string;
	originalProxyName: string;
	proxy: azdata.AgentProxyInfo;
}

export interface DeleteAgentProxyParams {
	ownerUri: string;
	proxy: azdata.AgentProxyInfo;
}

// Agent Credentials parameters
export interface GetCredentialsParams {
	ownerUri: string;
}

// Job Schedule management parameters
export interface AgentJobScheduleParams {
	ownerUri: string;
}

export interface CreateAgentJobScheduleParams {
	ownerUri: string;
	schedule: azdata.AgentJobScheduleInfo;
}

export interface UpdateAgentJobScheduleParams {
	ownerUri: string;
	originalScheduleName: string;
	schedule: azdata.AgentJobScheduleInfo;
}

export interface DeleteAgentJobScheduleParams {
	ownerUri: string;
	schedule: azdata.AgentJobScheduleInfo;
}

// Agent Job management requests
export namespace AgentJobsRequest {
	export const type = new RequestType<AgentJobsParams, azdata.AgentJobsResult, void, void>('agent/jobs');
}

export namespace AgentJobHistoryRequest {
	export const type = new RequestType<AgentJobHistoryParams, azdata.AgentJobHistoryResult, void, void>('agent/jobhistory');
}

export namespace AgentJobActionRequest {
	export const type = new RequestType<AgentJobActionParams, azdata.ResultStatus, void, void>('agent/jobaction');
}

export namespace CreateAgentJobRequest {
	export const type = new RequestType<CreateAgentJobParams, azdata.CreateAgentJobResult, void, void>('agent/createjob');
}

export namespace UpdateAgentJobRequest {
	export const type = new RequestType<UpdateAgentJobParams, azdata.UpdateAgentJobResult, void, void>('agent/updatejob');
}

export namespace DeleteAgentJobRequest {
	export const type = new RequestType<DeleteAgentJobParams, azdata.ResultStatus, void, void>('agent/deletejob');
}

export namespace AgentJobDefaultsRequest {
	export const type = new RequestType<AgentJobDefaultsParams, azdata.AgentJobDefaultsResult, void, void>('agent/jobdefaults');
}

// Job Step requests
export namespace CreateAgentJobStepRequest {
	export const type = new RequestType<CreateAgentJobStepParams, azdata.CreateAgentJobStepResult, void, void>('agent/createjobstep');
}

export namespace UpdateAgentJobStepRequest {
	export const type = new RequestType<UpdateAgentJobStepParams, azdata.UpdateAgentJobStepResult, void, void>('agent/updatejobstep');
}

export namespace DeleteAgentJobStepRequest {
	export const type = new RequestType<DeleteAgentJobStepParams, azdata.ResultStatus, void, void>('agent/deletejobstep');
}

// Alerts requests
export namespace AgentAlertsRequest {
	export const type = new RequestType<CreateAgentAlertParams, azdata.AgentAlertsResult, void, void>('agent/alerts');
}

export namespace CreateAgentAlertRequest {
	export const type = new RequestType<CreateAgentAlertParams, azdata.CreateAgentAlertResult, void, void>('agent/createalert');
}

export namespace UpdateAgentAlertRequest {
	export const type = new RequestType<UpdateAgentAlertParams, azdata.UpdateAgentAlertResult, void, void>('agent/updatealert');
}

export namespace DeleteAgentAlertRequest {
	export const type = new RequestType<DeleteAgentAlertParams, azdata.ResultStatus, void, void>('agent/deletealert');
}

// Operators requests
export namespace AgentOperatorsRequest {
	export const type = new RequestType<CreateAgentOperatorParams, azdata.AgentOperatorsResult, void, void>('agent/operators');
}

export namespace CreateAgentOperatorRequest {
	export const type = new RequestType<CreateAgentOperatorParams, azdata.CreateAgentOperatorResult, void, void>('agent/createoperator');
}

export namespace UpdateAgentOperatorRequest {
	export const type = new RequestType<UpdateAgentOperatorParams, azdata.UpdateAgentOperatorResult, void, void>('agent/updateoperator');
}

export namespace DeleteAgentOperatorRequest {
	export const type = new RequestType<DeleteAgentOperatorParams, azdata.ResultStatus, void, void>('agent/deleteoperator');
}

// Proxies requests
export namespace AgentProxiesRequest {
	export const type = new RequestType<CreateAgentProxyParams, azdata.AgentProxiesResult, void, void>('agent/proxies');
}

export namespace CreateAgentProxyRequest {
	export const type = new RequestType<CreateAgentProxyParams, azdata.CreateAgentProxyResult, void, void>('agent/createproxy');
}

export namespace UpdateAgentProxyRequest {
	export const type = new RequestType<UpdateAgentProxyParams, azdata.UpdateAgentProxyResult, void, void>('agent/updateproxy');
}

export namespace DeleteAgentProxyRequest {
	export const type = new RequestType<DeleteAgentProxyParams, azdata.ResultStatus, void, void>('agent/deleteproxy');
}

// Agent Credentials request
export namespace AgentCredentialsRequest {
	export const type = new RequestType<GetCredentialsParams, azdata.GetCredentialsResult, void, void>('security/credentials');
}

// Job Schedules requests
export namespace AgentJobSchedulesRequest {
	export const type = new RequestType<AgentJobScheduleParams, azdata.AgentJobSchedulesResult, void, void>('agent/schedules');
}

export namespace CreateAgentJobScheduleRequest {
	export const type = new RequestType<CreateAgentJobScheduleParams, azdata.CreateAgentJobScheduleResult, void, void>('agent/createschedule');
}

export namespace UpdateAgentJobScheduleRequest {
	export const type = new RequestType<UpdateAgentJobScheduleParams, azdata.UpdateAgentJobScheduleResult, void, void>('agent/updateschedule');
}

export namespace DeleteAgentJobScheduleRequest {
	export const type = new RequestType<DeleteAgentJobScheduleParams, azdata.ResultStatus, void, void>('agent/deleteschedule');
}

// ------------------------------- < Agent Management > ------------------------------------

// ------------------------------- < DacFx > ------------------------------------

export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}
export interface ExportParams {
	databaseName: string;
	packageFilePath: string;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface ImportParams {
	packageFilePath: string;
	databaseName: string;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}


export interface ExtractParams {
	databaseName: string;
	packageFilePath: string;
	applicationName: string;
	applicationVersion: string;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface DeployParams {
	packageFilePath: string;
	databaseName: string;
	upgradeExisting: boolean;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface GenerateDeployScriptParams {
	packageFilePath: string;
	databaseName: string;
	scriptFilePath: string;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface GenerateDeployPlanParams {
	packageFilePath: string;
	databaseName: string;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface SchemaCompareParams {
	sourceEndpointInfo: azdata.SchemaCompareEndpointInfo;
	targetEndpointInfo: azdata.SchemaCompareEndpointInfo;
	taskExecutionMode: TaskExecutionMode;
}

export interface SchemaCompareGenerateScriptParams {
	operationId: string;
	targetDatabaseName: string;
	scriptFilePath: string;
	taskExecutionMode: TaskExecutionMode;
}

export namespace ExportRequest {
	export const type = new RequestType<ExportParams, azdata.DacFxResult, void, void>('dacfx/export');
}

export namespace ImportRequest {
	export const type = new RequestType<ImportParams, azdata.DacFxResult, void, void>('dacfx/import');
}

export namespace ExtractRequest {
	export const type = new RequestType<ExtractParams, azdata.DacFxResult, void, void>('dacfx/extract');
}

export namespace DeployRequest {
	export const type = new RequestType<DeployParams, azdata.DacFxResult, void, void>('dacfx/deploy');
}

export namespace GenerateDeployScriptRequest {
	export const type = new RequestType<GenerateDeployScriptParams, azdata.DacFxResult, void, void>('dacfx/generateDeploymentScript');
}

export namespace GenerateDeployPlanRequest {
	export const type = new RequestType<GenerateDeployPlanParams, azdata.GenerateDeployPlanResult, void, void>('dacfx/generateDeployPlan');
}

export namespace SchemaCompareRequest {
	export const type = new RequestType<SchemaCompareParams, azdata.SchemaCompareResult, void, void>('schemaCompare/compare');
}

export namespace SchemaCompareGenerateScriptRequest {
	export const type = new RequestType<SchemaCompareGenerateScriptParams, azdata.DacFxResult, void, void>('schemaCompare/generateScript');
}
// ------------------------------- < DacFx > ------------------------------------