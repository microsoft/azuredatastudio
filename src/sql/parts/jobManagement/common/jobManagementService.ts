/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { Event, Emitter } from 'vs/base/common/event';

export class JobManagementService implements IJobManagementService {
	_serviceBrand: any;

	private _onDidChange = new Emitter<void>();
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private _providers: { [handle: string]: sqlops.AgentServicesProvider; } = Object.create(null);
	private _jobCacheObject : {[server: string]: JobCacheObject; } = {};

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	public fireOnDidChange(): void {
		this._onDidChange.fire(void 0);
	}

	public getJobs(connectionUri: string): Thenable<sqlops.AgentJobsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getJobs(connectionUri);
		});
	}

	public deleteJob(connectionUri: string, job: sqlops.AgentJobInfo): Thenable<sqlops.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteJob(connectionUri, job);
		});
	}

	public getAlerts(connectionUri: string): Thenable<sqlops.AgentAlertsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getAlerts(connectionUri);
		});
	}

	public deleteAlert(connectionUri: string, alert: sqlops.AgentAlertInfo): Thenable<sqlops.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteAlert(connectionUri, alert);
		});
	}

	public getOperators(connectionUri: string): Thenable<sqlops.AgentOperatorsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getOperators(connectionUri);
		});
	}

	public deleteOperator(connectionUri: string, operator: sqlops.AgentOperatorInfo): Thenable<sqlops.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteOperator(connectionUri, operator);
		});
	}

	public getProxies(connectionUri: string): Thenable<sqlops.AgentProxiesResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getProxies(connectionUri);
		});
	}

	public deleteProxy(connectionUri: string, proxy: sqlops.AgentProxyInfo): Thenable<sqlops.ResultStatus>  {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteProxy(connectionUri, proxy);
		});
	}

	public getJobHistory(connectionUri: string, jobID: string): Thenable<sqlops.AgentJobHistoryResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getJobHistory(connectionUri, jobID);
		});
	}

	public jobAction(connectionUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus> {
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

	public get jobCacheObjectMap(): {[server: string]: JobCacheObject;} {
		return this._jobCacheObject;
	}

	public addToCache(server: string, cacheObject: JobCacheObject) {
		this._jobCacheObject[server] = cacheObject;
	}
}

/**
 * Server level caching of jobs/job histories
 */
export class JobCacheObject {
	_serviceBrand: any;
	private _jobs: sqlops.AgentJobInfo[] = [];
	private _jobHistories: { [jobID: string]: sqlops.AgentJobHistoryInfo[]; } = {};
	private _runCharts: { [jobID: string]: string[]; } = {};
	private _prevJobID: string;
	private _serverName: string;
	private _dataView: Slick.Data.DataView<any>;

		/* Getters */
		public get jobs(): sqlops.AgentJobInfo[] {
			return this._jobs;
		}

		public get jobHistories(): { [jobID: string]: sqlops.AgentJobHistoryInfo[] } {
			return this._jobHistories;
		}

		public get prevJobID(): string {
			return this._prevJobID;
		}

		public getJobHistory(jobID: string): sqlops.AgentJobHistoryInfo[] {
			return this._jobHistories[jobID];
		}

		public get serverName(): string {
			return this._serverName;
		}

		public get dataView(): Slick.Data.DataView<any> {
			return this._dataView;
		}

		public getRunChart(jobID: string): string[] {
			return this._runCharts[jobID];
		}

		/* Setters */
		public set jobs(value: sqlops.AgentJobInfo[]) {
			this._jobs = value;
		}

		public set jobHistories(value: { [jobID: string]: sqlops.AgentJobHistoryInfo[]; }) {
			this._jobHistories = value;
		}

		public set prevJobID(value: string) {
			this._prevJobID = value;
		}

		public setJobHistory(jobID:string, value: sqlops.AgentJobHistoryInfo[]) {
			this._jobHistories[jobID] = value;
		}

		public setRunChart(jobID: string, value: string[]) {
			this._runCharts[jobID] = value;
		}

		public set serverName(value: string) {
			this._serverName = value;
		}

		public set dataView(value: Slick.Data.DataView<any>) {
			this._dataView = value;
		}
}