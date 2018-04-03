/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Table } from 'sql/base/browser/ui/table/table';

export const SERVICE_ID = 'jobManagementService';
export const CACHE_ID = 'jobCacheService';

export const IJobManagementService = createDecorator<IJobManagementService>(SERVICE_ID);
export const IAgentJobCacheService = createDecorator<IAgentJobCacheService>(CACHE_ID);

export interface IJobManagementService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.AgentServicesProvider): void;

	getJobs(connectionUri: string): Thenable<sqlops.AgentJobsResult>;

	getJobHistory(connectionUri: string, jobID: string): Thenable<sqlops.AgentJobHistoryResult>;

	jobAction(connectionUri: string, jobName: string, action: string): Thenable<sqlops.AgentJobActionResult>;
}

export interface IAgentJobCacheService {
	_serviceBrand: any;

	jobs: sqlops.AgentJobInfo[];

	jobHistories: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; };

	prevJobID: string;

	getJobHistory(jobID: string): sqlops.AgentJobHistoryInfo[];

	setJobHistory(jobID: string, value: sqlops.AgentJobHistoryInfo[]);
}