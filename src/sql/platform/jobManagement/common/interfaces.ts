/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { JobCacheObject, AlertsCacheObject, ProxiesCacheObject, OperatorsCacheObject } from './jobManagementService';
import { Event } from 'vs/base/common/event';

export const SERVICE_ID = 'jobManagementService';

export const IJobManagementService = createDecorator<IJobManagementService>(SERVICE_ID);

export interface IJobManagementService {
	_serviceBrand: any;
	onDidChange: Event<void>;

	registerProvider(providerId: string, provider: sqlops.AgentServicesProvider): void;
	fireOnDidChange(): void;

	getJobs(connectionUri: string): Thenable<sqlops.AgentJobsResult>;
	getJobHistory(connectionUri: string, jobID: string, jobName: string): Thenable<sqlops.AgentJobHistoryResult>;
	deleteJob(connectionUri: string, job: sqlops.AgentJobInfo): Thenable<sqlops.ResultStatus>;

	deleteJobStep(connectionUri: string, step: sqlops.AgentJobStepInfo): Thenable<sqlops.ResultStatus>;

	getAlerts(connectionUri: string): Thenable<sqlops.AgentAlertsResult>;
	deleteAlert(connectionUri: string, alert: sqlops.AgentAlertInfo): Thenable<sqlops.ResultStatus>;

	getOperators(connectionUri: string): Thenable<sqlops.AgentOperatorsResult>;
	deleteOperator(connectionUri: string, operator: sqlops.AgentOperatorInfo): Thenable<sqlops.ResultStatus>;

	getProxies(connectionUri: string): Thenable<sqlops.AgentProxiesResult>;
	deleteProxy(connectionUri: string, proxy: sqlops.AgentProxyInfo): Thenable<sqlops.ResultStatus>;

	getCredentials(connectionUri: string): Thenable<sqlops.GetCredentialsResult>;

	jobAction(connectionUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus>;
	addToCache(server: string, cache: JobCacheObject | OperatorsCacheObject);
	jobCacheObjectMap: { [server: string]: JobCacheObject; };
	operatorsCacheObjectMap: { [server: string]: OperatorsCacheObject; };
	alertsCacheObjectMap: { [server: string]: AlertsCacheObject; };
	proxiesCacheObjectMap: { [server: string]: ProxiesCacheObject };
	addToCache(server: string, cache: JobCacheObject | ProxiesCacheObject | AlertsCacheObject | OperatorsCacheObject);
}