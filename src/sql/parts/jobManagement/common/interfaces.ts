/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Table } from 'sql/base/browser/ui/table/table';
import { JobCacheObject } from './jobManagementService';

export const SERVICE_ID = 'jobManagementService';

export const IJobManagementService = createDecorator<IJobManagementService>(SERVICE_ID);

export interface IJobManagementService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.AgentServicesProvider): void;

	getJobs(connectionUri: string): Thenable<sqlops.AgentJobsResult>;

	getJobHistory(connectionUri: string, jobID: string): Thenable<sqlops.AgentJobHistoryResult>;

	jobAction(connectionUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus>;

	addToCache(server: string, cache: JobCacheObject);

	jobCacheObjectMap:  { [server: string]: JobCacheObject; };
}