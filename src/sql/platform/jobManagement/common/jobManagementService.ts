/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as azdata from 'azdata';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { Event, Emitter } from 'vs/base/common/event';

export class JobManagementService implements IJobManagementService {
	_serviceBrand: undefined;

	private _onDidChange = new Emitter<void>();
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private _providers: { [handle: string]: azdata.AgentServicesProvider; } = Object.create(null);
	private _jobCacheObjectMap: { [server: string]: JobCacheObject; } = {};
	private _operatorsCacheObjectMap: { [server: string]: OperatorsCacheObject; } = {};
	private _alertsCacheObject: { [server: string]: AlertsCacheObject; } = {};
	private _proxiesCacheObjectMap: { [server: string]: ProxiesCacheObject; } = {};
	private _notebookCacheObjectMap: { [server: string]: NotebookCacheObject; } = {};
	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	public fireOnDidChange(): void {
		this._onDidChange.fire(void 0);
	}

	// Jobs
	public getJobs(connectionUri: string): Thenable<azdata.AgentJobsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getJobs(connectionUri);
		});
	}

	public deleteJob(connectionUri: string, job: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteJob(connectionUri, job);
		});
	}

	public getJobHistory(connectionUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getJobHistory(connectionUri, jobID, jobName);
		});
	}

	public jobAction(connectionUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.jobAction(connectionUri, jobName, action);
		});
	}

	// Steps
	public deleteJobStep(connectionUri: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteJobStep(connectionUri, stepInfo);
		});
	}

	// Notebooks
	public getNotebooks(connectionUri: string): Thenable<azdata.AgentNotebooksResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getNotebooks(connectionUri);
		});
	}

	public getNotebookHistory(connectionUri: string, jobID: string, jobName: string, targetDatabase: string): Thenable<azdata.AgentNotebookHistoryResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getNotebookHistory(connectionUri, jobID, jobName, targetDatabase);
		});
	}

	public getMaterialziedNotebook(connectionUri: string, targetDatabase: string, notebookMaterializedId: number): Thenable<azdata.AgentNotebookMaterializedResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getMaterializedNotebook(connectionUri, targetDatabase, notebookMaterializedId);
		});
	}

	public getTemplateNotebook(connectionUri: string, targetDatabase: string, jobId: string): Thenable<azdata.AgentNotebookTemplateResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getTemplateNotebook(connectionUri, targetDatabase, jobId);
		});
	}

	public deleteNotebook(connectionUri: string, notebook: azdata.AgentNotebookInfo): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteNotebook(connectionUri, notebook);
		});
	}

	public deleteMaterializedNotebook(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteMaterializedNotebook(connectionUri, agentNotebookHistory, targetDatabase);
		});
	}

	public updateNotebookMaterializedName(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, name: string): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.updateNotebookMaterializedName(connectionUri, agentNotebookHistory, targetDatabase, name);
		});
	}

	public updateNotebookMaterializedPin(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, pin: boolean): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.updateNotebookMaterializedPin(connectionUri, agentNotebookHistory, targetDatabase, pin);
		});
	}

	// Alerts
	public getAlerts(connectionUri: string): Thenable<azdata.AgentAlertsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getAlerts(connectionUri);
		});
	}

	public deleteAlert(connectionUri: string, alert: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteAlert(connectionUri, alert);
		});
	}

	// Operators
	public getOperators(connectionUri: string): Thenable<azdata.AgentOperatorsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getOperators(connectionUri);
		});
	}

	public deleteOperator(connectionUri: string, operator: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteOperator(connectionUri, operator);
		});
	}

	// Proxies
	public getProxies(connectionUri: string): Thenable<azdata.AgentProxiesResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getProxies(connectionUri);
		});
	}

	public deleteProxy(connectionUri: string, proxy: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.deleteProxy(connectionUri, proxy);
		});
	}

	public getCredentials(connectionUri: string): Thenable<azdata.GetCredentialsResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getCredentials(connectionUri);
		});
	}

	private _runAction<T>(uri: string, action: (handler: azdata.AgentServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return Promise.reject(new Error(localize('providerIdNotValidError', "Connection is required in order to interact with JobManagementService")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}

	public registerProvider(providerId: string, provider: azdata.AgentServicesProvider): void {
		this._providers[providerId] = provider;
	}

	public get jobCacheObjectMap(): { [server: string]: JobCacheObject; } {
		return this._jobCacheObjectMap;
	}

	public get alertsCacheObjectMap(): { [server: string]: AlertsCacheObject; } {
		return this._alertsCacheObject;
	}

	public get notebookCacheObjectMap(): { [server: string]: NotebookCacheObject; } {
		return this._notebookCacheObjectMap;
	}

	public get proxiesCacheObjectMap(): { [server: string]: ProxiesCacheObject; } {
		return this._proxiesCacheObjectMap;
	}

	public get operatorsCacheObjectMap(): { [server: string]: OperatorsCacheObject } {
		return this._operatorsCacheObjectMap;
	}

	public addToCache(server: string, cacheObject: JobCacheObject | OperatorsCacheObject | ProxiesCacheObject | AlertsCacheObject | NotebookCacheObject) {
		if (cacheObject instanceof JobCacheObject) {
			this._jobCacheObjectMap[server] = cacheObject;
		} else if (cacheObject instanceof OperatorsCacheObject) {
			this._operatorsCacheObjectMap[server] = cacheObject;
		} else if (cacheObject instanceof AlertsCacheObject) {
			this._alertsCacheObject[server] = cacheObject;
		} else if (cacheObject instanceof ProxiesCacheObject) {
			this._proxiesCacheObjectMap[server] = cacheObject;
		} else if (cacheObject instanceof NotebookCacheObject) {
			this._notebookCacheObjectMap[server] = cacheObject;
		}
	}
}

/**
 * Server level caching of jobs/job histories and their views
 */
export class JobCacheObject {
	_serviceBrand: undefined;
	private _jobs: azdata.AgentJobInfo[] = [];
	private _jobHistories: { [jobID: string]: azdata.AgentJobHistoryInfo[]; } = {};
	private _jobSteps: { [jobID: string]: azdata.AgentJobStepInfo[]; } = {};
	private _jobAlerts: { [jobID: string]: azdata.AgentAlertInfo[]; } = {};
	private _jobSchedules: { [jobID: string]: azdata.AgentJobScheduleInfo[]; } = {};
	private _runCharts: { [jobID: string]: string[]; } = {};
	private _prevJobID: string;
	private _serverName: string;
	private _dataView: Slick.Data.DataView<any>;

	/* Getters */
	public get jobs(): azdata.AgentJobInfo[] {
		return this._jobs;
	}

	public get jobHistories(): { [jobID: string]: azdata.AgentJobHistoryInfo[] } {
		return this._jobHistories;
	}

	public get prevJobID(): string {
		return this._prevJobID;
	}

	public getJobHistory(jobID: string): azdata.AgentJobHistoryInfo[] {
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

	public getJobSteps(jobID: string): azdata.AgentJobStepInfo[] {
		return this._jobSteps[jobID];
	}

	public getJobAlerts(jobID: string): azdata.AgentAlertInfo[] {
		return this._jobAlerts[jobID];
	}

	public getJobSchedules(jobID: string): azdata.AgentJobScheduleInfo[] {
		return this._jobSchedules[jobID];
	}

	/* Setters */
	public set jobs(value: azdata.AgentJobInfo[]) {
		this._jobs = value;
	}

	public set jobHistories(value: { [jobID: string]: azdata.AgentJobHistoryInfo[]; }) {
		this._jobHistories = value;
	}

	public set prevJobID(value: string) {
		this._prevJobID = value;
	}

	public setJobHistory(jobID: string, value: azdata.AgentJobHistoryInfo[]) {
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

	public setJobSteps(jobID: string, value: azdata.AgentJobStepInfo[]) {
		this._jobSteps[jobID] = value;
	}

	public setJobAlerts(jobID: string, value: azdata.AgentAlertInfo[]) {
		this._jobAlerts[jobID] = value;
	}

	public setJobSchedules(jobID: string, value: azdata.AgentJobScheduleInfo[]) {
		this._jobSchedules[jobID] = value;
	}
}
/**
 * Server level caching of Operators
 */
export class NotebookCacheObject {
	_serviceBrand: any;
	private _notebooks: azdata.AgentNotebookInfo[] = [];
	private _notebookHistories: { [jobID: string]: azdata.AgentNotebookHistoryInfo[]; } = {};
	private _jobSteps: { [jobID: string]: azdata.AgentJobStepInfo[]; } = {};
	private _jobSchedules: { [jobID: string]: azdata.AgentJobScheduleInfo[]; } = {};
	private _runCharts: { [jobID: string]: string[]; } = {};
	private _prevJobID: string;
	private _serverName: string;
	private _dataView: Slick.Data.DataView<any>;

	/* Getters */
	public get notebooks(): azdata.AgentNotebookInfo[] {
		return this._notebooks;
	}

	public get notebookHistories(): { [jobID: string]: azdata.AgentNotebookHistoryInfo[] } {
		return this._notebookHistories;
	}

	public get prevJobID(): string {
		return this._prevJobID;
	}

	public getNotebookHistory(jobID: string): azdata.AgentNotebookHistoryInfo[] {
		return this._notebookHistories[jobID];
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

	public getJobSteps(jobID: string): azdata.AgentJobStepInfo[] {
		return this._jobSteps[jobID];
	}

	public getJobSchedules(jobID: string): azdata.AgentJobScheduleInfo[] {
		return this._jobSchedules[jobID];
	}

	/* Setters */
	public set notebooks(value: azdata.AgentNotebookInfo[]) {
		this._notebooks = value;
	}

	public set notebookHistories(value: { [jobID: string]: azdata.AgentNotebookHistoryInfo[]; }) {
		this._notebookHistories = value;
	}

	public set prevJobID(value: string) {
		this._prevJobID = value;
	}

	public setNotebookHistory(jobID: string, value: azdata.AgentNotebookHistoryInfo[]) {
		this._notebookHistories[jobID] = value;
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

	public setJobSteps(jobID: string, value: azdata.AgentJobStepInfo[]) {
		this._jobSteps[jobID] = value;
	}

	public setJobSchedules(jobID: string, value: azdata.AgentJobScheduleInfo[]) {
		this._jobSchedules[jobID] = value;
	}
}

/**
 * Server level caching of Operators
 */
export class OperatorsCacheObject {
	_serviceBrand: undefined;
	private _operators: azdata.AgentOperatorInfo[];
	private _dataView: Slick.Data.DataView<any>;
	private _serverName: string;

	/** Getters */
	public get operators(): azdata.AgentOperatorInfo[] {
		return this._operators;
	}

	public get dataview(): Slick.Data.DataView<any> {
		return this._dataView;
	}

	public get serverName(): string {
		return this._serverName;
	}

	/** Setters */
	public set operators(value: azdata.AgentOperatorInfo[]) {
		this._operators = value;
	}

	public set dataview(value: Slick.Data.DataView<any>) {
		this._dataView = value;
	}

	public set serverName(value: string) {
		this._serverName = value;
	}

}

/*
* Server level caching of job alerts and the alerts view
*/
export class AlertsCacheObject {
	_serviceBrand: undefined;
	private _alerts: azdata.AgentAlertInfo[];
	private _dataView: Slick.Data.DataView<any>;
	private _serverName: string;

	/** Getters */
	public get alerts(): azdata.AgentAlertInfo[] {
		return this._alerts;
	}

	public get dataview(): Slick.Data.DataView<any> {
		return this._dataView;
	}

	public get serverName(): string {
		return this._serverName;
	}

	/** Setters */
	public set alerts(value: azdata.AgentAlertInfo[]) {
		this._alerts = value;
	}

	public set dataview(value: Slick.Data.DataView<any>) {
		this._dataView = value;
	}

	public set serverName(value: string) {
		this._serverName = value;
	}
}


/**
 * Server level caching of job proxies and proxies view
 */
export class ProxiesCacheObject {
	_serviceBrand: undefined;
	private _proxies: azdata.AgentProxyInfo[];
	private _dataView: Slick.Data.DataView<any>;
	private _serverName: string;

	/**
	 * Getters
	 */
	public get proxies(): azdata.AgentProxyInfo[] {
		return this._proxies;
	}

	public get dataview(): Slick.Data.DataView<any> {
		return this._dataView;
	}

	public get serverName(): string {
		return this._serverName;
	}

	/** Setters */

	public set proxies(value: azdata.AgentProxyInfo[]) {
		this._proxies = value;
	}

	public set dataview(value: Slick.Data.DataView<any>) {
		this._dataView = value;
	}

	public set serverName(value: string) {
		this._serverName = value;
	}
}
