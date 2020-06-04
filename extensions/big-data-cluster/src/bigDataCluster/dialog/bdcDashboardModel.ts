/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ClusterController } from '../controller/clusterControllerApi';
import { EndpointModel, BdcStatusModel } from '../controller/apiGenerated';
import { Endpoint, Service } from '../utils';
import { ConnectControllerDialog, ConnectControllerModel } from './connectControllerDialog';
import { ControllerTreeDataProvider } from '../tree/controllerTreeDataProvider';
import { AuthType } from 'bdc';

export type BdcDashboardOptions = { url: string, auth: AuthType, username: string, password: string, rememberPassword: boolean };

type BdcErrorType = 'bdcStatus' | 'bdcEndpoints' | 'general';
export type BdcErrorEvent = { error: Error, errorType: BdcErrorType };

export class BdcDashboardModel {

	private _clusterController: ClusterController;
	private _bdcStatus: BdcStatusModel | undefined;
	private _endpoints: EndpointModel[] | undefined;
	private _bdcStatusLastUpdated: Date | undefined;
	private _endpointsLastUpdated: Date | undefined;
	private readonly _onDidUpdateEndpoints = new vscode.EventEmitter<EndpointModel[]>();
	private readonly _onDidUpdateBdcStatus = new vscode.EventEmitter<BdcStatusModel>();
	private readonly _onBdcError = new vscode.EventEmitter<BdcErrorEvent>();
	public onDidUpdateEndpoints = this._onDidUpdateEndpoints.event;
	public onDidUpdateBdcStatus = this._onDidUpdateBdcStatus.event;
	public onBdcError = this._onBdcError.event;

	constructor(private _options: BdcDashboardOptions, private _treeDataProvider: ControllerTreeDataProvider) {
		try {
			this._clusterController = new ClusterController(_options.url, _options.auth, _options.username, _options.password);
			this.refresh().catch(e => console.log(`Unexpected error refreshing BdcModel ${e instanceof Error ? e.message : e}`));
		} catch {
			this.promptReconnect().then(async () => {
				await this.refresh();
			}).catch(error => {
				this._onBdcError.fire({ error: error, errorType: 'general' });
			});
		}
	}

	public get bdcStatus(): BdcStatusModel | undefined {
		return this._bdcStatus;
	}

	public get serviceEndpoints(): EndpointModel[] | undefined {
		return this._endpoints;
	}

	public get bdcStatusLastUpdated(): Date | undefined {
		return this._bdcStatusLastUpdated;
	}

	public get endpointsLastUpdated(): Date | undefined {
		return this._endpointsLastUpdated;
	}

	public async refresh(): Promise<void> {
		try {
			if (!this._clusterController) {
				// If this succeeds without error we know we have a clusterController at this point
				await this.promptReconnect();
			}

			await Promise.all([
				this._clusterController.getBdcStatus(true).then(response => {
					this._bdcStatus = response.bdcStatus;
					this._bdcStatusLastUpdated = new Date();
					this._onDidUpdateBdcStatus.fire(this.bdcStatus);
				}).catch(error => this._onBdcError.fire({ error: error, errorType: 'bdcStatus' })),
				this._clusterController.getEndPoints(true).then(response => {
					this._endpoints = response.endPoints;
					fixEndpoints(this._endpoints);
					this._endpointsLastUpdated = new Date();
					this._onDidUpdateEndpoints.fire(this.serviceEndpoints);
				}).catch(error => this._onBdcError.fire({ error: error, errorType: 'bdcEndpoints' }))
			]);
		} catch (error) {
			this._onBdcError.fire({ error: error, errorType: 'general' });
		}
	}

	/**
	 * Gets a partially filled connection profile for the SQL Server Master Instance endpoint
	 * associated with this cluster.
	 * @returns The IConnectionProfile - or undefined if the endpoints haven't been loaded yet
	 */
	public getSqlServerMasterConnectionProfile(): azdata.IConnectionProfile | undefined {
		const sqlServerMasterEndpoint = this.serviceEndpoints && this.serviceEndpoints.find(e => e.name === Endpoint.sqlServerMaster);
		if (!sqlServerMasterEndpoint) {
			return undefined;
		}

		// We default to sa - if that doesn't work then callers of this should open up a connection
		// dialog so the user can enter in the correct connection information
		return {
			connectionName: undefined,
			serverName: sqlServerMasterEndpoint.endpoint,
			databaseName: undefined,
			userName: 'sa',
			password: this._options.password,
			authenticationType: '',
			savePassword: true,
			groupFullName: undefined,
			groupId: undefined,
			providerName: 'MSSQL',
			saveProfile: true,
			id: undefined,
			options: {}
		};
	}

	/**
	 * Opens up a dialog prompting the user to re-enter credentials for the controller
	 */
	private async promptReconnect(): Promise<void> {
		this._clusterController = await new ConnectControllerDialog(new ConnectControllerModel(this._options)).showDialog();
		await this.updateController();
	}

	private async updateController(): Promise<void> {
		if (!this._clusterController) {
			return;
		}
		this._treeDataProvider.addOrUpdateController(
			this._clusterController.url,
			this._clusterController.authType,
			this._clusterController.username,
			this._clusterController.password,
			this._options.rememberPassword);
		await this._treeDataProvider.saveControllers();
	}
}

/**
 * Retrieves the troubleshoot book URL for the specified service, defaulting to the BDC
 * troubleshoot notebook if the service name is unknown.
 * @param service The service name to get the troubleshoot notebook URL for
 */
export function getTroubleshootNotebookUrl(service?: string): string {
	service = service || '';
	switch (service.toLowerCase()) {
		case Service.sql:
			return 'troubleshooters/tsg101-troubleshoot-sql-server';
		case Service.hdfs:
			return 'troubleshooters/tsg102-troubleshoot-hdfs';
		case Service.spark:
			return 'troubleshooters/tsg103-troubleshoot-spark';
		case Service.control:
			return 'troubleshooters/tsg104-troubleshoot-control';
		case Service.gateway:
			return 'troubleshooters/tsg105-troubleshoot-gateway';
		case Service.app:
			return 'troubleshooters/tsg106-troubleshoot-app';
	}
	return 'troubleshooters/tsg100-troubleshoot-bdc';
}

/**
 * Applies fixes to the endpoints received so they are displayed correctly
 * @param endpoints The endpoints received to modify
 */
function fixEndpoints(endpoints?: EndpointModel[]): void {
	if (!endpoints) {
		return;
	}
	endpoints.forEach(e => {
		if (e.name === Endpoint.metricsui && e.endpoint && e.endpoint.indexOf('/d/wZx3OUdmz') === -1) {
			// Update to have correct URL
			e.endpoint += '/d/wZx3OUdmz';
		}
		if (e.name === Endpoint.logsui && e.endpoint && e.endpoint.indexOf('/app/kibana#/discover') === -1) {
			// Update to have correct URL
			e.endpoint += '/app/kibana#/discover';
		}
	});
}
