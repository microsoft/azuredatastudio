/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotificationType, RequestType } from 'vscode-languageclient';
import * as telemetry from '@microsoft/ads-extension-telemetry';
import * as azdata from 'azdata';
import { ConnectParams } from 'dataprotocol-client/lib/protocol';
import * as mssql from 'mssql';
import { DatabaseFileData } from 'mssql';
import { BackupResponse } from 'azdata';
import { CredentialInfo } from 'azdata';

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
		properties: telemetry.TelemetryEventProperties;
		measures: telemetry.TelemetryEventMeasures;
	};
}

// ------------------------------- </ Telemetry Sent Event > ----------------------------------

// ------------------------------- < Security Token Request > ------------------------------------------
export interface RequestSecurityTokenParams {
	provider: string;
	authority: string;
	resource: string;
	scopes: string[];
}

export interface RequestSecurityTokenResponse {
	accountKey: string;
	token: string;
}

export namespace SecurityTokenRequest {
	export const type = new RequestType<RequestSecurityTokenParams, RequestSecurityTokenResponse, void, void>('account/securityTokenRequest');
}
// ------------------------------- </ Security Token Request > ------------------------------------------

// ------------------------------- < Refresh Token Notification > ---------------------------------

/**
 * Parameters for a refresh token notification sent from STS to ADS
 */
export interface RefreshTokenParams {
	/**
	 * The tenant ID
	 */
	tenantId: string;
	/**
	 * The provider that indicates the type of linked account to query
	 */
	provider: string;
	/**
	 * The identifier of the target resource of the requested token
	 */
	resource: string;
	/**
	 * The account ID
	 */
	accountId: string;
	/**
	 * The URI for the editor that needs a token refresh
	 */
	uri: string;
}

export namespace RefreshTokenNotification {
	export const type = new NotificationType<RefreshTokenParams, void>('account/refreshToken');
}



// ------------------------------- </ Refresh Token Notification > -------------------------------

// ------------------------------- < Token Refreshed Notification > ---------------------------------

/**
 * Parameters for a new refresh token sent from ADS to STS
 */
export interface TokenRefreshedParams {
	/**
	 * The refresh token
	 */
	token: string;
	/**
	 * The token expiration, a Unix epoch
	 */
	expiresOn: Number;
	/**
	 * The URI for the editor that needs a token refresh
	 */
	uri: string;
}

export namespace TokenRefreshedNotification {
	export const type = new NotificationType<TokenRefreshedParams, void>('account/tokenRefreshed');
}

// ------------------------------- </ Token Refreshed Notification > -------------------------------


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
	export const type = new RequestType<AgentNotebookTemplateParams, azdata.AgentNotebookTemplateResult, void, void>('agent/notebooktemplate');
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
	includePermissions?: boolean;
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

export interface ValidateStreamingJobParams {
	packageFilePath: string,
	createStreamingJobTsql: string
}

export interface ParseTSqlScriptParams {
	filePath: string;
	databaseSchemaProvider: string;
}

export interface SavePublishProfileParams {
	profilePath: string;
	databaseName: string;
	connectionString: string;
	sqlCommandVariableValues?: Record<string, string>;
	deploymentOptions?: mssql.DeploymentOptions;
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

export namespace ValidateStreamingJobRequest {
	export const type = new RequestType<ValidateStreamingJobParams, mssql.ValidateStreamingJobResult, void, void>('dacfx/validateStreamingJob');
}

export namespace ParseTSqlScriptRequest {
	export const type = new RequestType<ParseTSqlScriptParams, mssql.ParseTSqlScriptResult, void, void>('dacfx/parseTSqlScript');
}

export namespace SavePublishProfileRequest {
	export const type = new RequestType<SavePublishProfileParams, azdata.ResultStatus, void, void>('dacfx/savePublishProfile');
}

// ------------------------------- </ DacFx > ------------------------------------

// ------------------------------- < Sql Projects > ------------------------------------
//#region SqlProjects

//#region Functions

//#region Project-level functions

export namespace CreateSqlProjectRequest {
	export const type = new RequestType<CreateSqlProjectParams, azdata.ResultStatus, void, void>('sqlProjects/createProject');
}

export namespace OpenSqlProjectRequest {
	export const type = new RequestType<SqlProjectParams, azdata.ResultStatus, void, void>('sqlProjects/openProject');
}

export namespace CloseSqlProjectRequest {
	export const type = new RequestType<SqlProjectParams, azdata.ResultStatus, void, void>('sqlProjects/closeProject');
}

export namespace GetCrossPlatformCompatibilityRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetCrossPlatformCompatibilityResult, void, void>('sqlProjects/getCrossPlatformCompatibility');
}

export namespace UpdateProjectForCrossPlatformRequest {
	export const type = new RequestType<SqlProjectParams, azdata.ResultStatus, void, void>('sqlProjects/updateProjectForCrossPlatform');
}

export namespace GetProjectPropertiesRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetProjectPropertiesResult, void, void>('sqlProjects/getProjectProperties');
}

export namespace SetDatabaseSourceRequest {
	export const type = new RequestType<SetDatabaseSourceParams, azdata.ResultStatus, void, void>('sqlProjects/setDatabaseSource');
}

export namespace SetDatabaseSchemaProviderRequest {
	export const type = new RequestType<SetDatabaseSchemaProviderParams, azdata.ResultStatus, void, void>('sqlProjects/setDatabaseSchemaProvider');
}

//#endregion

//#region File/folder functions

//#region SQL object script functions

export namespace AddSqlObjectScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/addSqlObjectScript');
}

export namespace DeleteSqlObjectScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/deleteSqlObjectScript');
}

export namespace ExcludeSqlObjectScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/excludeSqlObjectScript');
}

export namespace MoveSqlObjectScriptRequest {
	export const type = new RequestType<MoveItemParams, azdata.ResultStatus, void, void>('sqlProjects/moveSqlObjectScript');
}

export namespace GetSqlObjectScriptsRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetScriptsResult, void, void>('sqlProjects/getSqlObjectScripts');
}


export namespace ExcludeFolderRequest {
	export const type = new RequestType<FolderParams, azdata.ResultStatus, void, void>('sqlProjects/excludeFolder');
}

export namespace MoveFolderRequest {
	export const type = new RequestType<MoveFolderParams, azdata.ResultStatus, void, void>('sqlProjects/moveFolder');
}


//#endregion

//#endregion

//#region Folder functions

export namespace AddFolderRequest {
	export const type = new RequestType<FolderParams, azdata.ResultStatus, void, void>('sqlProjects/addFolder');
}

export namespace DeleteFolderRequest {
	export const type = new RequestType<FolderParams, azdata.ResultStatus, void, void>('sqlProjects/deleteFolder');
}

export namespace GetFoldersRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetFoldersResult, void, void>('sqlProjects/getFolders');
}

//#endregion

//#region Pre/Post-deployment script functions

export namespace AddPostDeploymentScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/addPostDeploymentScript');
}

export namespace AddPreDeploymentScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/addPreDeploymentScript');
}

export namespace DeletePostDeploymentScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/deletePostDeploymentScript');
}

export namespace DeletePreDeploymentScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/deletePreDeploymentScript');
}

export namespace ExcludePostDeploymentScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/excludePostDeploymentScript');
}

export namespace GetPostDeploymentScriptsRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetScriptsResult, void, void>('sqlProjects/getPostDeploymentScripts');
}

export namespace ExcludePreDeploymentScriptRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/excludePreDeploymentScript');
}

export namespace MovePostDeploymentScriptRequest {
	export const type = new RequestType<MoveItemParams, azdata.ResultStatus, void, void>('sqlProjects/movePostDeploymentScript');
}

export namespace MovePreDeploymentScriptRequest {
	export const type = new RequestType<MoveItemParams, azdata.ResultStatus, void, void>('sqlProjects/movePreDeploymentScript');
}

export namespace GetPreDeploymentScriptsRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetScriptsResult, void, void>('sqlProjects/getPreDeploymentScripts');
}

//#endregion

//#region None functions

export namespace AddNoneItemRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/addNoneItem');
}

export namespace DeleteNoneItemRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/deleteNoneItem');
}

export namespace ExcludeNoneItemRequest {
	export const type = new RequestType<SqlProjectScriptParams, azdata.ResultStatus, void, void>('sqlProjects/excludeNoneItem');
}

export namespace GetNoneItemsRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetScriptsResult, void, void>('sqlProjects/getNoneItems');
}

export namespace MoveNoneItemRequest {
	export const type = new RequestType<MoveItemParams, azdata.ResultStatus, void, void>('sqlProjects/moveNoneItem');
}

//#endregion

//#endregion

//#region SQLCMD variable functions

export namespace AddSqlCmdVariableRequest {
	export const type = new RequestType<AddSqlCmdVariableParams, azdata.ResultStatus, void, void>('sqlProjects/addSqlCmdVariable');
}

export namespace DeleteSqlCmdVariableRequest {
	export const type = new RequestType<DeleteSqlCmdVariableParams, azdata.ResultStatus, void, void>('sqlProjects/deleteSqlCmdVariable');
}

export namespace UpdateSqlCmdVariableRequest {
	export const type = new RequestType<AddSqlCmdVariableParams, azdata.ResultStatus, void, void>('sqlProjects/updateSqlCmdVariable');
}

export namespace GetSqlCmdVariablesRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetSqlCmdVariablesResult, void, void>('sqlProjects/getSqlCmdVariables');
}

//#endregion

//#region Database reference functions

export namespace AddDacpacReferenceRequest {
	export const type = new RequestType<AddDacpacReferenceParams, azdata.ResultStatus, void, void>('sqlprojects/addDacpacReference');
}

export namespace AddSqlProjectReferenceRequest {
	export const type = new RequestType<AddSqlProjectReferenceParams, azdata.ResultStatus, void, void>('sqlprojects/addSqlProjectReference');
}

export namespace AddSystemDatabaseReferenceRequest {
	export const type = new RequestType<AddSystemDatabaseReferenceParams, azdata.ResultStatus, void, void>('sqlprojects/addSystemDatabaseReference');
}

export namespace AddNugetPackageReferenceRequest {
	export const type = new RequestType<AddNugetPackageReferenceParams, azdata.ResultStatus, void, void>('sqlprojects/addNugetPackageReference');
}

export namespace DeleteDatabaseReferenceRequest {
	export const type = new RequestType<DeleteDatabaseReferenceParams, azdata.ResultStatus, void, void>('sqlprojects/deleteDatabaseReference');
}

export namespace GetDatabaseReferencesRequest {
	export const type = new RequestType<SqlProjectParams, mssql.GetDatabaseReferencesResult, void, void>('sqlProjects/getDatabaseReferences');
}

//#endregion

//#endregion

//#region Parameters

export interface SqlProjectParams {
	/**
	 * Absolute path of the project, including .sqlproj
	 */
	projectUri: string;
}

export interface SqlProjectScriptParams extends SqlProjectParams {
	/**
	 * Path of the script, including .sql, relative to the .sqlproj
	 */
	path: string;
}

export interface SetDatabaseSourceParams extends SqlProjectParams {
	/**
	 * Source of the database schema, used in telemetry
	 */
	databaseSource: string;
}

export interface SetDatabaseSchemaProviderParams extends SqlProjectParams {
	/**
	 * New DatabaseSchemaProvider value, in the form "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider"
	 */
	databaseSchemaProvider: string;
}

export interface AddDacpacReferenceParams extends AddUserDatabaseReferenceParams {
	/**
	 * Path to the .dacpac file
	 */
	dacpacPath: string;
}

export interface AddNugetPackageReferenceParams extends AddUserDatabaseReferenceParams {
	/**
	 * NuGet package name
	 */
	packageName: string;

	/**
	 * NuGet package version
	 */
	packageVersion: string;
}

export interface AddDatabaseReferenceParams extends SqlProjectParams {
	/**
	 * Whether to suppress missing dependencies
	 */
	suppressMissingDependencies: boolean;
	/**
	 * Literal name used to reference another database in the same server, if not using SQLCMD variables
	 */
	databaseLiteral?: string;
}

export interface AddSqlProjectReferenceParams extends AddUserDatabaseReferenceParams {
	/**
	 * Path to the referenced .sqlproj file
	 */
	projectPath: string;
	/**
	 * GUID for the referenced SQL project
	 */
	projectGuid: string;
}

export interface AddSystemDatabaseReferenceParams extends AddDatabaseReferenceParams {
	/**
	 * Type of system database
	 */
	systemDatabase: mssql.SystemDatabase;

	/**
	 * Type of reference - ArtifactReference or PackageReference
	 */
	referenceType: mssql.SystemDbReferenceType;
}

export interface AddUserDatabaseReferenceParams extends AddDatabaseReferenceParams {
	/**
	 * SQLCMD variable name for specifying the other database this reference is to, if different from that of the current project
	 */
	databaseVariable?: string;
	/**
	 * SQLCMD variable name for specifying the other server this reference is to, if different from that of the current project.
	 * If this is set, DatabaseVariable must also be set.
	 */
	serverVariable?: string;
}

export interface DeleteDatabaseReferenceParams extends SqlProjectParams {
	/**
	 * Name of the reference to be deleted.  Name of the System DB, path of the sqlproj, or path of the dacpac
	 */
	name: string;
}

export interface FolderParams extends SqlProjectParams {
	/**
	 * Path of the folder, typically relative to the .sqlproj file
	 */
	path: string;
}

export interface MoveFolderParams extends FolderParams {
	/**
	 * Path of the folder, typically relative to the .sqlproj file
	 */
	destinationPath: string;
}

export interface CreateSqlProjectParams extends SqlProjectParams {
	/**
	 * Type of SQL Project: SDK-style or Legacy
	 */
	sqlProjectType: mssql.ProjectType;
	/**
	 * Database schema provider for the project, in the format
	 * "Microsoft.Data.Tools.Schema.Sql.SqlXYZDatabaseSchemaProvider".
	 * Case sensitive.
	 */
	databaseSchemaProvider?: string;
	/**
	 * Version of the Microsoft.Build.Sql SDK for the project, if overriding the default
	 */
	buildSdkVersion?: string;
}

export interface AddSqlCmdVariableParams extends SqlProjectParams {
	/**
	 * Name of the SQLCMD variable
	 */
	name: string;
	/**
	 * Default value of the SQLCMD variable
	 */
	defaultValue: string;
}

export interface DeleteSqlCmdVariableParams extends SqlProjectParams {
	/**
	 * Name of the SQLCMD variable to be deleted
	 */
	name?: string;
}

export interface MoveItemParams extends SqlProjectScriptParams {
	/**
	 * Destination path of the file or folder, relative to the .sqlproj
	 */
	destinationPath: string;
}

//#endregion

//#endregion

// ------------------------------- </ Sql Projects > -----------------------------------

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

export interface SchemaComparePublishDatabaseChangesParams {
	operationId: string;
	targetServerName: string;
	targetDatabaseName: string;
	taskExecutionMode: TaskExecutionMode;
}

export interface SchemaComparePublishProjectChangesParams {
	operationId: string;
	targetProjectPath: string;
	targetFolderStructure: mssql.ExtractTarget;
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

export namespace SchemaComparePublishDatabaseChangesRequest {
	export const type = new RequestType<SchemaComparePublishDatabaseChangesParams, azdata.ResultStatus, void, void>('schemaCompare/publishDatabase');
}

export namespace SchemaComparePublishProjectChangesRequest {
	export const type = new RequestType<SchemaComparePublishProjectChangesParams, mssql.SchemaComparePublishProjectResult, void, void>('schemaCompare/publishProject');
}

export namespace SchemaCompareGetDefaultOptionsRequest {
	export const type = new RequestType<SchemaCompareGetOptionsParams, mssql.SchemaCompareOptionsResult, void, void>('schemaCompare/getDefaultOptions');
}

export namespace SchemaCompareIncludeExcludeNodeRequest {
	export const type = new RequestType<SchemaCompareNodeParams, mssql.SchemaCompareIncludeExcludeResult, void, void>('schemaCompare/includeExcludeNode');
}

export namespace SchemaCompareOpenScmpRequest {
	export const type = new RequestType<SchemaCompareOpenScmpParams, mssql.SchemaCompareOpenScmpResult, void, void>('schemaCompare/openScmp');
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
	targetType: azdata.sqlAssessment.SqlAssessmentTargetType;
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

// ------------------------------- < SQL Profiler > ------------------------------------

/**
 * Parameters to start a profiler session
 */
export interface CreateXEventSessionParams {
	/**
	 * Session Owner URI
	 */
	ownerUri: string;

	/**
	 * Session name
	 */
	sessionName: string;

	/**
	 * Profiler Session template
	 */
	template: ProfilerSessionTemplate;
}

export interface CreateXEventSessionResponse { }

/**
 * Parameters to start a profiler session
 */
export interface StartProfilingParams {
	/**
	 * Session Owner URI
	 */
	ownerUri: string;

	/**
	 * Session name or full path of XEL file to open
	 */
	sessionName: string;

	/**
	 * Identifies which type of target session name identifies
	 */
	sessionType: azdata.ProfilingSessionType;
}

export interface StartProfilingResponse { }

/**
 * Parameters to stop a profiler session
 */
export interface StopProfilingParams {
	/**
	 * Session Owner URI
	 */
	ownerUri: string;
}

export interface StopProfilingResponse { }

/**
 * Parameters to pause a profiler session
 */
export interface PauseProfilingParams {
	/**
	 * Session Owner URI
	 */
	ownerUri: string;
}

export interface PauseProfilingResponse { }

/**
 * Parameters to get a list of XEvent sessions
 */
export interface GetXEventSessionsParams {
	/**
	 * Session Owner URI
	 */
	ownerUri: string;
}

export interface GetXEventSessionsResponse {
	/**
	 * List of all running XEvent Sessions on target server
	 */
	sessions: string[];
}

export interface DisconnectSessionParams {
	/**
	 * Session Owner URI
	 */
	ownerUri: string;
}

export interface DisconnectSessionResponse { }

/**
 * Profiler Event
 */
export interface ProfilerEvent {
	/**
	 * Event class name
	 */
	name: string;

	/**
	 * Event timestamp
	 */
	timestamp: string;

	/**
	 * Event values
	 */
	values: {};
}

/**
 * Profiler Session Template
 */
export interface ProfilerSessionTemplate {
	/**
	 * Template name
	 */
	name: string;

	/**
	 * Default view for template
	 */
	defaultView: string;

	/**
	 * TSQL for creating a session
	 */
	createStatement: string;
}

/**
 * Profiler events available notification parameters
 */
export interface ProfilerEventsAvailableParams {
	/**
	 * Session owner URI
	 */
	ownerUri: string;

	/**
	 * New profiler events available
	 */
	events: ProfilerEvent[];

	/**
	 * If events may have been dropped
	 */
	eventsLost: boolean;
}

/**
 * Profiler events available notification parameters
 */
export interface ProfilerSessionStoppedParams {
	/**
	 * Session owner URI
	 */
	ownerUri: string;

	/**
	 * Stopped session Id
	 */
	sessionId: number;
}

/**
 * Profiler session created notification parameters
 */
export interface ProfilerSessionCreatedParams {
	/**
	 * Session owner URI
	 */
	ownerUri: string;

	/**
	 * Created session name
	 */
	sessionName: string;

	/**
	 * Template used to create session
	 */
	templateName: string;
}

export namespace CreateXEventSessionRequest {
	export const type = new RequestType<CreateXEventSessionParams, CreateXEventSessionResponse, void, void>('profiler/createsession');
}

export namespace StartProfilingRequest {
	export const type = new RequestType<StartProfilingParams, StartProfilingResponse, void, void>('profiler/start');
}

export namespace StopProfilingRequest {
	export const type = new RequestType<StopProfilingParams, StopProfilingResponse, void, void>('profiler/stop');
}

export namespace PauseProfilingRequest {
	export const type = new RequestType<PauseProfilingParams, PauseProfilingResponse, void, void>('profiler/pause');
}

export namespace GetXEventSessionsRequest {
	export const type = new RequestType<GetXEventSessionsParams, GetXEventSessionsResponse, void, void>('profiler/getsessions');
}

export namespace DisconnectSessionRequest {
	export const type = new RequestType<DisconnectSessionParams, DisconnectSessionResponse, void, void>('profiler/disconnect');
}

export namespace ProfilerEventsAvailableNotification {
	export const type = new NotificationType<ProfilerEventsAvailableParams, void>('profiler/eventsavailable');
}

export namespace ProfilerSessionStoppedNotification {
	export const type = new NotificationType<ProfilerSessionStoppedParams, void>('profiler/sessionstopped');
}

export namespace ProfilerSessionCreatedNotification {
	export const type = new NotificationType<ProfilerSessionCreatedParams, void>('profiler/sessioncreated');
}

// ------------------------------- < SQL Profiler > ------------------------------------

// ------------------------------- < Table Designer > ------------------------------------

export interface TableDesignerEditRequestParams {
	tableInfo: azdata.designers.TableInfo,
	tableChangeInfo: azdata.designers.DesignerEdit
}

export namespace InitializeTableDesignerRequest {
	export const type = new RequestType<azdata.designers.TableInfo, azdata.designers.TableDesignerInfo, void, void>('tabledesigner/initialize');
}

export namespace ProcessTableDesignerEditRequest {
	export const type = new RequestType<TableDesignerEditRequestParams, azdata.designers.DesignerEditResult<azdata.designers.TableDesignerView>, void, void>('tabledesigner/processedit');
}

export namespace PublishTableDesignerChangesRequest {
	export const type = new RequestType<azdata.designers.TableInfo, azdata.designers.PublishChangesResult, void, void>('tabledesigner/publish');
}

export namespace TableDesignerGenerateScriptRequest {
	export const type = new RequestType<azdata.designers.TableInfo, string, void, void>('tabledesigner/script');
}

export namespace TableDesignerGenerateChangePreviewReportRequest {
	export const type = new RequestType<azdata.designers.TableInfo, azdata.designers.GeneratePreviewReportResult, void, void>('tabledesigner/generatepreviewreport');
}
export namespace DisposeTableDesignerRequest {
	export const type = new RequestType<azdata.designers.TableInfo, void, void, void>('tabledesigner/dispose');
}
// ------------------------------- < Table Designer > ------------------------------------

// ------------------------------- < Azure Blob > ------------------------------------
export interface CreateSasParams {
	ownerUri: string;
	blobContainerUri: string;
	blobContainerKey: string;
	storageAccountName: string;
	expirationDate: string;
}

export namespace CreateSasRequest {
	export const type = new RequestType<CreateSasParams, mssql.CreateSasResponse, void, void>('blob/createSas');
}

// ------------------------------- < Azure Blob > ------------------------------------

// ------------------------------- < Execution Plan > ------------------------------------

export interface GetExecutionPlanParams {
	graphInfo: azdata.executionPlan.ExecutionPlanGraphInfo,
}

export namespace GetExecutionPlanRequest {
	export const type = new RequestType<GetExecutionPlanParams, azdata.executionPlan.GetExecutionPlanResult, void, void>('queryExecutionPlan/getExecutionPlan');
}

export interface ExecutionPlanComparisonParams {
	firstExecutionPlanGraphInfo: azdata.executionPlan.ExecutionPlanGraphInfo;
	secondExecutionPlanGraphInfo: azdata.executionPlan.ExecutionPlanGraphInfo;
}

export namespace ExecutionPlanComparisonRequest {
	export const type = new RequestType<ExecutionPlanComparisonParams, azdata.executionPlan.ExecutionPlanComparisonResult, void, void>('queryExecutionPlan/compareExecutionPlanGraph');
}

// ------------------------------- < Execution Plan > ------------------------------------

// ------------------------------- < Server Contextualization API > ------------------------------------

export interface ServerContextualizationParams {
	ownerUri: string;
}

export namespace GetServerContextualizationRequest {
	export const type = new RequestType<ServerContextualizationParams, azdata.contextualization.GetServerContextualizationResult, void, void>('metadata/getServerContext');
}

// ------------------------------- < Server Contextualization API > ------------------------------------

// ------------------------------- < Object Management > ------------------------------------
export interface InitializeViewRequestParams {
	connectionUri: string;
	database: string;
	contextId: string;
	isNewObject: boolean;
	objectType: string;
	parentUrn: string;
	objectUrn?: string;
}

export namespace InitializeViewRequest {
	export const type = new RequestType<InitializeViewRequestParams, mssql.ObjectManagement.ObjectViewInfo<mssql.ObjectManagement.SqlObject>, void, void>('objectManagement/initializeView');
}

export interface SaveObjectRequestParams {
	contextId: string;
	object: mssql.ObjectManagement.SqlObject;
}

export namespace SaveObjectRequest {
	export const type = new RequestType<SaveObjectRequestParams, void, void, void>('objectManagement/save');
}

export interface ScriptObjectRequestParams {
	contextId: string;
	object: mssql.ObjectManagement.SqlObject;
}

export namespace ScriptObjectRequest {
	export const type = new RequestType<ScriptObjectRequestParams, string, void, void>('objectManagement/script');
}

export interface DisposeViewRequestParams {
	contextId: string;
}

export namespace DisposeViewRequest {
	export const type = new RequestType<DisposeViewRequestParams, void, void, void>('objectManagement/disposeView');
}

export interface RenameObjectRequestParams {
	connectionUri: string;
	newName: string;
	objectUrn: string;
	objectType: mssql.ObjectManagement.NodeType;
}

export namespace RenameObjectRequest {
	export const type = new RequestType<RenameObjectRequestParams, void, void, void>('objectManagement/rename');
}

export interface DropObjectRequestParams {
	connectionUri: string;
	objectUrn: string;
	objectType: mssql.ObjectManagement.NodeType;
}

export namespace DropObjectRequest {
	export const type = new RequestType<DropObjectRequestParams, void, void, void>('objectManagement/drop');
}

export interface SearchObjectRequestParams {
	contextId: string;
	searchText: string | undefined;
	schema: string | undefined;
	objectTypes: mssql.ObjectManagement.NodeType[];
}

export namespace SearchObjectRequest {
	export const type = new RequestType<SearchObjectRequestParams, mssql.ObjectManagement.SearchResultItem[], void, void>('objectManagement/search');
}

export interface DetachDatabaseRequestParams {
	connectionUri: string;
	database: string;
	dropConnections: boolean;
	updateStatistics: boolean;
	generateScript: boolean;
}

export namespace DetachDatabaseRequest {
	export const type = new RequestType<DetachDatabaseRequestParams, string, void, void>('objectManagement/detachDatabase');
}

export interface DropDatabaseRequestParams {
	connectionUri: string;
	database: string;
	dropConnections: boolean;
	deleteBackupHistory: boolean;
	generateScript: boolean;
}

export namespace DropDatabaseRequest {
	export const type = new RequestType<DropDatabaseRequestParams, string, void, void>('objectManagement/dropDatabase');
}

export interface AttachDatabaseRequestParams {
	connectionUri: string;
	databases: DatabaseFileData[];
	generateScript: boolean;
}

export namespace AttachDatabaseRequest {
	export const type = new RequestType<AttachDatabaseRequestParams, string, void, void>('objectManagement/attachDatabase');
}

export interface GetDataFolderRequestParams {
	connectionUri: string;
}

export namespace GetDataFolderRequest {
	export const type = new RequestType<GetDataFolderRequestParams, string, void, void>('admin/getdatafolder');
}

export interface GetBackupFolderRequestParams {
	connectionUri: string;
}

export namespace GetBackupFolderRequest {
	export const type = new RequestType<GetBackupFolderRequestParams, string, void, void>('admin/getbackupfolder');
}

export interface BackupDatabaseRequestParams {
	ownerUri: string;
	backupInfo: mssql.BackupInfo;
	taskExecutionMode: azdata.TaskExecutionMode;
}

export namespace BackupDatabaseRequest {
	export const type = new RequestType<BackupDatabaseRequestParams, BackupResponse, void, void>('backup/backup');
}

export interface GetAssociatedFilesRequestParams {
	connectionUri: string;
	primaryFilePath: string;
}

export namespace GetAssociatedFilesRequest {
	export const type = new RequestType<GetAssociatedFilesRequestParams, string[], void, void>('admin/getassociatedfiles');
}

export namespace PurgeQueryStoreDataRequest {
	export const type = new RequestType<PurgeQueryStoreDataRequestParams, void, void, void>('objectManagement/purgeQueryStoreData');
}

export interface PurgeQueryStoreDataRequestParams {
	connectionUri: string;
	database: string;
}

export namespace CreateCredentialRequest {
	export const type = new RequestType<CreateCredentialRequestParams, void, void, void>('objectManagement/createCredentialRequest');
}

export interface CreateCredentialRequestParams {
	credentialInfo: CredentialInfo;
	connectionUri: string;
}

export namespace GetCredentialNamesRequest {
	export const type = new RequestType<GetCredentialNamesRequestParams, string[], void, void>('objectManagement/getCredentialNamesRequest');
}

export interface GetCredentialNamesRequestParams {
	connectionUri: string;
}

// ------------------------------- < Object Management > ------------------------------------

// ------------------------------- < Encryption IV/KEY updation Event > ------------------------------------
/**
 * Parameters for the MSAL cache encryption key notification
 */
export class DidChangeEncryptionIVKeyParams {
	/**
	 * Buffer encoded IV string for MSAL cache encryption
	 */
	public iv: string;
	/**
	 * Buffer encoded Key string for MSAL cache encryption
	 */
	public key: string;
}

/**
 * Notification sent when the encryption keys are changed.
 */
export namespace EncryptionKeysChangedNotification {
	export const type = new NotificationType<DidChangeEncryptionIVKeyParams, void>('connection/encryptionKeysChanged');
}

// ------------------------------- < Clear Pooled Connections Request > ---------------------------------------

export namespace ClearPooledConnectionsRequest {
	export const type = new RequestType<object, void, void, void>('connection/clearpooledconnections');
}
// ------------------------------- < Query Store > ------------------------------------
//#region Query Store

//#region Functions

export namespace GetRegressedQueriesSummaryRequest {
	export const type = new RequestType<GetRegressedQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getRegressedQueriesSummary');
}

export namespace GetRegressedQueriesDetailedSummaryRequest {
	export const type = new RequestType<GetRegressedQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getRegressedQueriesDetailedSummary');
}

export namespace GetTrackedQueriesReportRequest {
	export const type = new RequestType<GetTrackedQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getTrackedQueriesReport');
}

export namespace GetHighVariationQueriesSummaryRequest {
	export const type = new RequestType<GetHighVariationQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getHighVariationQueriesSummary');
}

export namespace GetHighVariationQueriesDetailedSummaryRequest {
	export const type = new RequestType<GetHighVariationQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getHighVariationQueriesDetailedSummary');
}

export namespace GetHighVariationQueriesDetailedSummaryWithWaitStatsRequest {
	export const type = new RequestType<GetHighVariationQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getHighVariationQueriesDetailedSummaryWithWaitStats');
}

export namespace GetTopResourceConsumersSummaryRequest {
	export const type = new RequestType<GetTopResourceConsumersReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getTopResourceConsumersSummary');
}

export namespace GetTopResourceConsumersDetailedSummaryRequest {
	export const type = new RequestType<GetTopResourceConsumersReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getTopResourceConsumersDetailedSummary');
}

export namespace GetTopResourceConsumersDetailedSummaryWithWaitStatsRequest {
	export const type = new RequestType<GetTopResourceConsumersReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getTopResourceConsumersDetailedSummaryWithWaitStats');
}

export namespace GetPlanSummaryChartViewRequest {
	export const type = new RequestType<GetPlanSummaryParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getPlanSummaryChartView');
}

export namespace GetPlanSummaryGridViewRequest {
	export const type = new RequestType<GetPlanSummaryGridViewParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getPlanSummaryGridView');
}

export namespace GetForcedPlanRequest {
	export const type = new RequestType<GetForcedPlanParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getForcedPlan');
}

export namespace GetForcedPlanQueriesReportRequest {
	export const type = new RequestType<GetForcedPlanQueriesReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getForcedPlanQueriesReport');
}

export namespace GetOverallResourceConsumptionReportRequest {
	export const type = new RequestType<GetOverallResourceConsumptionReportParams, mssql.QueryStoreQueryResult, void, void>('queryStore/getOverallResourceConsumptionReport');
}

//#endregion

//#region Parameters

/**
 * Base class for a Query Store report parameters
 */
export interface QueryStoreReportParams {
	/**
	 * Connection URI for the database
	 */
	connectionOwnerUri: string;
}

/**
 * Base class for parameters for a report type that uses QueryConfigurationBase for its configuration
 */
export interface QueryConfigurationParams extends QueryStoreReportParams {
	/**
	 * Metric to summarize
	 */
	selectedMetric: mssql.Metric;
	/**
	 * Statistic to calculate on SelecticMetric
	 */
	selectedStatistic: mssql.Statistic;
	/**
	 * Number of queries to return if ReturnAllQueries is not set
	 */
	topQueriesReturned: number;
	/**
	 * True to include all queries in the report; false to only include the top queries, up to the value specified by TopQueriesReturned
	 */
	returnAllQueries: boolean;
	/**
	 * Minimum number of query plans for a query to included in the report
	 */
	minNumberOfQueryPlans: number;
}

/**
 * Parameters for getting a Regressed Queries report
 */
export interface GetRegressedQueriesReportParams extends QueryConfigurationParams {
	/**
	 * Time interval during which to look for performance regressions for the report
	 */
	timeIntervalRecent: mssql.TimeInterval;
	/**
	 * Time interval during which to establish baseline performance for the report
	 */
	timeIntervalHistory: mssql.TimeInterval;
	/**
	 * Minimum number of executions for a query to be included
	 */
	minExecutionCount: number;
}

/**
 * Base class for parameters for a report that can be ordered by a specified column
 */
export interface OrderableQueryConfigurationParams extends QueryConfigurationParams {
	/**
	 * Name of the column to order results by
	 */
	orderByColumnId: string;
	/**
	 * Direction of the result ordering
	 */
	descending: boolean;
}

/**
 * Parameters for getting a Tracked Queries report
 */
export interface GetTrackedQueriesReportParams {
	/**
	 * Search text for a query
	 */
	querySearchText: string;
}

/**
 * Parameters for getting a High Variation Queries report
 */
export interface GetHighVariationQueriesReportParams extends OrderableQueryConfigurationParams {
	/**
	 * Time interval for the report
	 */
	timeInterval: mssql.TimeInterval;
}

/**
 * Parameters for getting a Top Resource Consumers report
 */
export interface GetTopResourceConsumersReportParams extends OrderableQueryConfigurationParams {
	/**
	 * Time interval for the report
	 */
	timeInterval: mssql.TimeInterval;
}

/**
 * Parameters for getting a Plan Summary
 */
export interface GetPlanSummaryParams extends QueryStoreReportParams {
	/**
	 * Query ID to view a summary of plans for
	 */
	queryId: number;
	/**
	 * Mode of the time interval search
	 */
	timeIntervalMode: mssql.PlanTimeIntervalMode;
	/**
	 * Time interval for the report
	 */
	timeInterval: mssql.TimeInterval;
	/**
	 * Metric to summarize
	 */
	selectedMetric: mssql.Metric;
	/**
	 * Statistic to calculate on SelecticMetric
	 */
	selectedStatistic: mssql.Statistic;
}

/**
 * Parameters for getting the grid view of a Plan Summary
 */
export interface GetPlanSummaryGridViewParams extends GetPlanSummaryParams {
	/**
	 * Name of the column to order results by
	 */
	orderByColumnId: string;
	/**
	 * Direction of the result ordering
	 */
	descending: boolean;
}

/**
 * Parameters for getting the forced plan for a query
 */
export interface GetForcedPlanParams extends QueryStoreReportParams {
	/**
	 * Query ID to view the plan for
	 */
	queryId: number;
	/**
	 * Plan ID to view
	 */
	planId: number;
}

/**
 * Parameters for getting a Forced Plan Queries report
 */
export interface GetForcedPlanQueriesReportParams extends OrderableQueryConfigurationParams {
	/**
	 * Time interval for the report
	 */
	timeInterval: mssql.TimeInterval;
}

/**
 * Parameters for getting an Overall Resource Consumption report
 */
export interface GetOverallResourceConsumptionReportParams extends QueryConfigurationParams {
	/**
	 * Time interval for the report
	 */
	specifiedTimeInterval: mssql.TimeInterval;
	/**
	 * Bucket interval for the report
	 */
	specifiedBucketInterval: mssql.BucketInterval;
}

//#endregion

//#endregion
// ------------------------------- </ Query Store > -----------------------------------
