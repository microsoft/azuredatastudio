/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { getBdcStatus, getEndPoints } from '../controller/clusterControllerApi';
import { EndpointModel, BdcStatusModel } from '../controller/apiGenerated';
import { showErrorMessage } from '../utils';

export class BdcDashboardModel {

	private _bdcStatus: BdcStatusModel;
	private _endpoints: EndpointModel[] = [];
	private readonly _onDidUpdateEndpoints = new vscode.EventEmitter<EndpointModel[]>();
	private readonly _onDidUpdateBdcStatus = new vscode.EventEmitter<BdcStatusModel>();
	public onDidUpdateEndpoints = this._onDidUpdateEndpoints.event;
	public onDidUpdateBdcStatus = this._onDidUpdateBdcStatus.event;

	constructor(public clusterName: string, private url: string, private username: string, private password: string) {
		this.refresh();
	}

	public get bdcStatus(): BdcStatusModel | undefined {
		return this._bdcStatus;
	}

	public get serviceEndpoints(): EndpointModel[] {
		return this._endpoints || [];
	}

	public async refresh(): Promise<void> {
		await Promise.all([
			getBdcStatus(this.url, this.username, this.password, true).then(response => {
				this._bdcStatus = response.bdcStatus;
				this._onDidUpdateBdcStatus.fire(this.bdcStatus);
			}),
			getEndPoints(this.url, this.username, this.password, true).then(response => {
				this._endpoints = response.endPoints || [];
				this._onDidUpdateEndpoints.fire(this.serviceEndpoints);
			})
		]).catch(error => showErrorMessage(error));
	}
}

export enum Endpoint {
	gateway = 'gateway',
	sparkHistory = 'spark-history',
	yarnUi = 'yarn-ui',
	appProxy = 'app-proxy',
	mgmtproxy = 'mgmtproxy',
	managementProxy = 'management-proxy',
	logsui = 'logsui',
	metricsui = 'metricsui',
	controller = 'controller',
	sqlServerMaster = 'sql-server-master',
	webhdfs = 'webhdfs',
	livy = 'livy'
}

export enum Service {
	sql = 'sql',
	hdfs = 'hdfs',
	spark = 'spark',
	control = 'control',
	gateway = 'gateway',
	app = 'app'
}
