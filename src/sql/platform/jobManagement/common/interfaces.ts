/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { JobCacheObject, AlertsCacheObject, ProxiesCacheObject, OperatorsCacheObject, NotebookCacheObject } from './jobManagementService';
import { Event } from 'vs/base/common/event';

export const SERVICE_ID = 'jobManagementService';

export const IJobManagementService = createDecorator<IJobManagementService>(SERVICE_ID);

export interface IJobManagementService {
	_serviceBrand: undefined;
	onDidChange: Event<void>;

	registerProvider(providerId: string, provider: azdata.AgentServicesProvider): void;
	fireOnDidChange(): void;

	getJobs(connectionUri: string): Thenable<azdata.AgentJobsResult>;
	getJobHistory(connectionUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult>;
	deleteJob(connectionUri: string, job: azdata.AgentJobInfo): Thenable<azdata.ResultStatus>;

	deleteJobStep(connectionUri: string, step: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus>;

	getNotebooks(connectionUri: string): Thenable<azdata.AgentNotebooksResult>;
	getNotebookHistory(connectionUri: string, jobId: string, jobName: string, targetDatabase: string): Thenable<azdata.AgentNotebookHistoryResult>;
	getMaterialziedNotebook(connectionUri: string, targetDatabase: string, notebookMaterializedId: number): Thenable<azdata.AgentNotebookMaterializedResult>;
	getTemplateNotebook(connectionUri: string, targetDatabase: string, jobId: string): Thenable<azdata.AgentNotebookTemplateResult>;
	deleteNotebook(connectionUri: string, notebook: azdata.AgentNotebookInfo): Thenable<azdata.ResultStatus>;
	deleteMaterializedNotebook(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string): Thenable<azdata.ResultStatus>;
	updateNotebookMaterializedName(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, name: string);
	updateNotebookMaterializedPin(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, pin: boolean);

	getAlerts(connectionUri: string): Thenable<azdata.AgentAlertsResult>;
	deleteAlert(connectionUri: string, alert: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus>;

	getOperators(connectionUri: string): Thenable<azdata.AgentOperatorsResult>;
	deleteOperator(connectionUri: string, operator: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus>;

	getProxies(connectionUri: string): Thenable<azdata.AgentProxiesResult>;
	deleteProxy(connectionUri: string, proxy: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus>;

	getCredentials(connectionUri: string): Thenable<azdata.GetCredentialsResult>;

	jobAction(connectionUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus>;
	addToCache(server: string, cache: JobCacheObject | OperatorsCacheObject | NotebookCacheObject);
	jobCacheObjectMap: { [server: string]: JobCacheObject; };
	notebookCacheObjectMap: { [server: string]: NotebookCacheObject; };
	operatorsCacheObjectMap: { [server: string]: OperatorsCacheObject; };
	alertsCacheObjectMap: { [server: string]: AlertsCacheObject; };
	proxiesCacheObjectMap: { [server: string]: ProxiesCacheObject };
	addToCache(server: string, cache: JobCacheObject | ProxiesCacheObject | AlertsCacheObject | OperatorsCacheObject | NotebookCacheObject);
}
