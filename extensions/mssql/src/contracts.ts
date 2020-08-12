/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotificationType, RequestType } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from './telemetry';
import * as azdata from 'azdata';
import { ConnectParams } from 'dataprotocol-client/lib/protocol';
import * as mssql from './mssql';

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

// ------------------------------- < Security Token Request > ------------------------------------------
export interface RequestSecurityTokenParams {
	authority: string;
	provider: string;
	resource: string;
	scope: string;
}

export interface RequestSecurityTokenResponse {
	accountKey: string;
	token: string;
}

export namespace SecurityTokenRequest {
	export const type = new RequestType<RequestSecurityTokenParams, RequestSecurityTokenResponse, void, void>('account/securityTokenRequest');
}
// ------------------------------- </ Security Token Request > ------------------------------------------

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

// Notebook management parameters
export interface AgentNotebookParams {
	ownerUri: string;
}

export interface AgentNotebookHistoryParams {
	ownerUri: string;
	jobId: string;
	jobName: string;
	targetDatabase: string;
}

export interface AgentNotebookMaterializedParams {
	ownerUri: string;
	targetDatabase: string;
	notebookMaterializedId: number;
}

export interface AgentNotebookTemplateParams {
	ownerUri: string;
	targetDatabase: string;
	jobId: string;
}

export interface CreateAgentNotebookParams {
	ownerUri: string;
	notebook: azdata.AgentNotebookInfo;
	templateFilePath: string;
}

export interface UpdateAgentNotebookParams {
	ownerUri: string;
	originalNotebookName: string;
	notebook: azdata.AgentJobInfo;
	templateFilePath: string;
}

export interface UpdateAgentNotebookRunPinParams {
	ownerUri: string;
	targetDatabase: string;
	agentNotebookHistory: azdata.AgentNotebookHistoryInfo;
	materializedNotebookPin: boolean;
}

export interface UpdateAgentNotebookRunNameParams {
	ownerUri: string;
	targetDatabase: string;
	agentNotebookHistory: azdata.AgentNotebookHistoryInfo;
	materializedNotebookName: string;
}

export interface DeleteAgentNotebookParams {
	ownerUri: string;
	notebook: azdata.AgentNotebookInfo;
}

export interface DeleteAgentMaterializedNotebookParams {
	ownerUri: string;
	targetDatabase: string;
	agentNotebookHistory: azdata.AgentNotebookHistoryInfo;
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

// Notebooks request
export namespace AgentNotebooksRequest {
	export const type = new RequestType<AgentNotebookParams, azdata.AgentNotebooksResult, void, void>('agent/notebooks');
}

export namespace AgentNotebookHistoryRequest {
	export const type = new RequestType<AgentNotebookHistoryParams, azdata.AgentNotebookHistoryResult, void, void>('agent/notebookhistory');
}

export namespace AgentNotebookMaterializedRequest {
	export const type = new RequestType<AgentNotebookMaterializedParams, azdata.AgentNotebookMaterializedResult, void, void>('agent/notebookmaterialized');
}

export namespace UpdateAgentNotebookRunNameRequest {
	export const type = new RequestType<UpdateAgentNotebookRunNameParams, azdata.UpdateAgentNotebookResult, void, void>('agent/updatenotebookname');
}

export namespace DeleteMaterializedNotebookRequest {
	export const type = new RequestType<DeleteAgentMaterializedNotebookParams, azdata.ResultStatus, void, void>('agent/deletematerializednotebook');
}

export namespace UpdateAgentNotebookRunPinRequest {
	export const type = new RequestType<UpdateAgentNotebookRunPinParams, azdata.ResultStatus, void, void>('agent/updatenotebookpin');
}

export namespace AgentNotebookTemplateRequest {
	export const type = new RequestType<AgentNotebookTemplateParams, azdata.ResultStatus, void, void>('agent/notebooktemplate');
}

export namespace CreateAgentNotebookRequest {
	export const type = new RequestType<CreateAgentNotebookParams, azdata.CreateAgentNotebookResult, void, void>('agent/createnotebook');
}

export namespace DeleteAgentNotebookRequest {
	export const type = new RequestType<DeleteAgentNotebookParams, azdata.ResultStatus, void, void>('agent/deletenotebook');
}

export namespace UpdateAgentNotebookRequest {
	export const type = new RequestType<UpdateAgentNotebookParams, azdata.UpdateAgentNotebookResult, void, void>('agent/updatenotebook');
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
	extractTarget?: mssql.ExtractTarget;
	taskExecutionMode: TaskExecutionMode;
}

export interface DeployParams {
	packageFilePath: string;
	databaseName: string;
	upgradeExisting: boolean;
	sqlCommandVariableValues?: Record<string, string>;
	deploymentOptions?: mssql.DeploymentOptions;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface GenerateDeployScriptParams {
	packageFilePath: string;
	databaseName: string;
	sqlCommandVariableValues?: Record<string, string>;
	deploymentOptions?: mssql.DeploymentOptions
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface GenerateDeployPlanParams {
	packageFilePath: string;
	databaseName: string;
	ownerUri: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface GetOptionsFromProfileParams {
	profilePath: string;
}
export namespace ExportRequest {
	export const type = new RequestType<ExportParams, mssql.DacFxResult, void, void>('dacfx/export');
}

export namespace ImportRequest {
	export const type = new RequestType<ImportParams, mssql.DacFxResult, void, void>('dacfx/import');
}

export namespace ExtractRequest {
	export const type = new RequestType<ExtractParams, mssql.DacFxResult, void, void>('dacfx/extract');
}

export namespace DeployRequest {
	export const type = new RequestType<DeployParams, mssql.DacFxResult, void, void>('dacfx/deploy');
}

export namespace GenerateDeployScriptRequest {
	export const type = new RequestType<GenerateDeployScriptParams, mssql.DacFxResult, void, void>('dacfx/generateDeploymentScript');
}

export namespace GenerateDeployPlanRequest {
	export const type = new RequestType<GenerateDeployPlanParams, mssql.GenerateDeployPlanResult, void, void>('dacfx/generateDeployPlan');
}

export namespace GetOptionsFromProfileRequest {
	export const type = new RequestType<GetOptionsFromProfileParams, mssql.DacFxOptionsResult, void, void>('dacfx/getOptionsFromProfile');
}
// ------------------------------- < DacFx > ------------------------------------

// ------------------------------- <CMS> ----------------------------------------


export interface CreateCentralManagementServerParams {
	registeredServerName: string;
	registeredServerDescription: string;
	connectParams: ConnectParams;
}

export interface ListRegisteredServersParams extends RegisteredServerParamsBase {
	// same as base
}

export interface AddRegisteredServerParams extends RegisteredServerParamsBase {
	registeredServerName: string;
	registeredServerDescription: string;
	registeredServerConnectionDetails: azdata.ConnectionInfo;
}

export interface RemoveRegisteredServerParams extends RegisteredServerParamsBase {
	registeredServerName: string;
}

export interface AddServerGroupParams extends RegisteredServerParamsBase {
	groupName: string;
	groupDescription: string;
}

export interface RemoveServerGroupParams extends RegisteredServerParamsBase {
	groupName: string;
}

export interface RegisteredServerParamsBase {
	parentOwnerUri: string;
	relativePath: string;
}

export namespace CreateCentralManagementServerRequest {
	export const type = new RequestType<CreateCentralManagementServerParams, mssql.ListRegisteredServersResult, void, void>('cms/createCms');
}

export namespace ListRegisteredServersRequest {
	export const type = new RequestType<ListRegisteredServersParams, mssql.ListRegisteredServersResult, void, void>('cms/listRegisteredServers');
}

export namespace AddRegisteredServerRequest {
	export const type = new RequestType<AddRegisteredServerParams, boolean, void, void>('cms/addRegisteredServer');
}

export namespace RemoveRegisteredServerRequest {
	export const type = new RequestType<RemoveRegisteredServerParams, boolean, void, void>('cms/removeRegisteredServer');
}

export namespace AddServerGroupRequest {
	export const type = new RequestType<AddServerGroupParams, boolean, void, void>('cms/addCmsServerGroup');
}

export namespace RemoveServerGroupRequest {
	export const type = new RequestType<RemoveServerGroupParams, boolean, void, void>('cms/removeCmsServerGroup');
}
// ------------------------------- <CMS> ----------------------------------------

// ------------------------------- <Language Extensibility> -----------------------------

export interface LanguageExtensionRequestParam {
	ownerUri: string;
}

export interface ExternalLanguageRequestParam extends LanguageExtensionRequestParam {
	languageName: string;
}

export interface ExternalLanguageUpdateRequestParam extends LanguageExtensionRequestParam {
	language: mssql.ExternalLanguage;
}

export interface LanguageExtensionListResponseParam {
	languages: mssql.ExternalLanguage[];
}


export interface ExternalLanguageResponseParam {
}

export namespace LanguageExtensibilityListRequest {
	export const type = new RequestType<LanguageExtensionRequestParam, LanguageExtensionListResponseParam, void, void>('languageExtension/list');
}

export namespace LanguageExtensibilityDeleteRequest {
	export const type = new RequestType<ExternalLanguageRequestParam, ExternalLanguageResponseParam, void, void>('languageExtension/delete');
}

export namespace LanguageExtensibilityUpdateRequest {
	export const type = new RequestType<ExternalLanguageUpdateRequestParam, ExternalLanguageResponseParam, void, void>('languageExtension/update');
}

// ------------------------------- <Schema Compare> -----------------------------
export interface SchemaCompareParams {
	operationId: string;
	sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	targetEndpointInfo: mssql.SchemaCompareEndpointInfo;
	taskExecutionMode: TaskExecutionMode;
	deploymentOptions: mssql.DeploymentOptions;
}

export interface SchemaCompareGenerateScriptParams {
	operationId: string;
	targetServerName: string;
	targetDatabaseName: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface SchemaComparePublishChangesParams {
	operationId: string;
	targetServerName: string;
	targetDatabaseName: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface SchemaCompareGetOptionsParams {

}

export interface SchemaCompareNodeParams {
	operationId: string;
	diffEntry: mssql.DiffEntry;
	includeRequest: boolean;
	taskExecutionMode: TaskExecutionMode;
}

export interface SchemaCompareOpenScmpParams {
	filePath: string;
}

export interface SchemaCompareSaveScmpParams {
	sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	targetEndpointInfo: mssql.SchemaCompareEndpointInfo;
	taskExecutionMode: TaskExecutionMode;
	deploymentOptions: mssql.DeploymentOptions;
	scmpFilePath: string;
	excludedSourceObjects: mssql.SchemaCompareObjectId[];
	excludedTargetObjects: mssql.SchemaCompareObjectId[];
}

export interface SchemaCompareCancelParams {
	operationId: string;
}

export namespace SchemaCompareRequest {
	export const type = new RequestType<SchemaCompareParams, mssql.SchemaCompareResult, void, void>('schemaCompare/compare');
}

export namespace SchemaCompareGenerateScriptRequest {
	export const type = new RequestType<SchemaCompareGenerateScriptParams, azdata.ResultStatus, void, void>('schemaCompare/generateScript');
}

export namespace SchemaComparePublishChangesRequest {
	export const type = new RequestType<SchemaComparePublishChangesParams, azdata.ResultStatus, void, void>('schemaCompare/publish');
}

export namespace SchemaCompareGetDefaultOptionsRequest {
	export const type = new RequestType<SchemaCompareGetOptionsParams, mssql.SchemaCompareOptionsResult, void, void>('schemaCompare/getDefaultOptions');
}

export namespace SchemaCompareIncludeExcludeNodeRequest {
	export const type = new RequestType<SchemaCompareNodeParams, azdata.ResultStatus, void, void>('schemaCompare/includeExcludeNode');
}

export namespace SchemaCompareOpenScmpRequest {
	export const type = new RequestType<SchemaCompareOpenScmpParams, azdata.ResultStatus, void, void>('schemaCompare/openScmp');
}

export namespace SchemaCompareSaveScmpRequest {
	export const type = new RequestType<SchemaCompareSaveScmpParams, azdata.ResultStatus, void, void>('schemaCompare/saveScmp');
}

export namespace SchemaCompareCancellationRequest {
	export const type = new RequestType<SchemaCompareCancelParams, azdata.ResultStatus, void, void>('schemaCompare/cancel');
}

// ------------------------------- <Schema Compare> -----------------------------

/// ------------------------------- <Sql Assessment> -----------------------------

export interface SqlAssessmentParams {
	ownerUri: string;
	targetType: azdata.sqlAssessment.SqlAssessmentTargetType
}

export interface GenerateSqlAssessmentScriptParams {
	items: azdata.SqlAssessmentResultItem[];
	taskExecutionMode: azdata.TaskExecutionMode;
	targetServerName: string;
	targetDatabaseName: string;
}

export namespace SqlAssessmentInvokeRequest {
	export const type = new RequestType<SqlAssessmentParams, azdata.SqlAssessmentResult, void, void>('assessment/invoke');
}

export namespace GetSqlAssessmentItemsRequest {
	export const type = new RequestType<SqlAssessmentParams, azdata.SqlAssessmentResult, void, void>('assessment/getAssessmentItems');
}

export namespace GenerateSqlAssessmentScriptRequest {
	export const type = new RequestType<GenerateSqlAssessmentScriptParams, azdata.ResultStatus, void, void>('assessment/generateScript');
}

// ------------------------------- <Sql Assessment> -----------------------------

// ------------------------------- <Serialization> -----------------------------
export namespace SerializeDataStartRequest {
	export const type = new RequestType<azdata.SerializeDataStartRequestParams, azdata.SerializeDataResult, void, void>('serialize/start');
}

export namespace SerializeDataContinueRequest {
	export const type = new RequestType<azdata.SerializeDataContinueRequestParams, azdata.SerializeDataResult, void, void>('serialize/continue');
}
// ------------------------------- <Serialization> -----------------------------

// ------------------------------- < Load Completion Extension Request > ------------------------------------
/**
 * Completion extension load parameters
 */
export class CompletionExtensionParams {
	/// <summary>
	/// Absolute path for the assembly containing the completion extension
	/// </summary>
	public assemblyPath: string;
	/// <summary>
	/// The type name for the completion extension
	/// </summary>
	public typeName: string;
	/// <summary>
	/// Property bag for initializing the completion extension
	/// </summary>
	public properties: {};
}

export namespace CompletionExtLoadRequest {
	export const type = new RequestType<CompletionExtensionParams, boolean, void, void>('completion/extLoad');
}

// ------------------------------- < Load Completion Extension Request > ------------------------------------

/// ------------------------------- <Convert Notebook> -----------------------------

export interface ConvertNotebookToSqlParams {
	content: string;
}

export namespace ConvertNotebookToSqlRequest {
	export const type = new RequestType<ConvertNotebookToSqlParams, ConvertNotebookToSqlResult, void, void>('notebookconvert/convertnotebooktosql');
}

export interface ConvertNotebookToSqlResult extends azdata.ResultStatus {
	content: string;
}

export interface ConvertSqlToNotebookParams {
	clientUri: string;
}

export namespace ConvertSqlToNotebookRequest {
	export const type = new RequestType<ConvertSqlToNotebookParams, ConvertSqlToNotebookResult, void, void>('notebookconvert/convertsqltonotebook');
}

export interface ConvertSqlToNotebookResult extends azdata.ResultStatus {
	content: string;
}

// ------------------------------- <Convert Notebook> -----------------------------
