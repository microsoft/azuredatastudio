/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { TPromise } from 'vs/base/common/winjs.base';

import * as sqlops from 'sqlops';

export class JobManagementService implements IJobManagementService {
	_serviceBrand: any;

	private _providers: { [handle: string]: sqlops.AgentServicesProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
	}

	public getJobs(connectionUri: string): Thenable<sqlops.AgentJobsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getJobs(connectionUri);
		});
	}

	public getJobHistory(connectionUri: string, jobID: string): Thenable<sqlops.AgentJobHistoryResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getJobHistory(connectionUri, jobID);
		});
	}

	public jobAction(connectionUri: string, jobName: string, action: string): Thenable<sqlops.AgentJobActionResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.jobAction(connectionUri, jobName, action);
		});
	}


	private _runAction<T>(uri: string, action: (handler: sqlops.AgentServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return TPromise.wrapError(new Error(localize('providerIdNotValidError', "Connection is required in order to interact with JobManagementService")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}

	public registerProvider(providerId: string, provider: sqlops.AgentServicesProvider): void {
		this._providers[providerId] = provider;
	}
}
