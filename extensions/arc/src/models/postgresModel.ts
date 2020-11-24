/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PGResourceInfo } from 'arc';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { ConnectToPGSqlDialog } from '../ui/dialogs/connectPGDialog';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import { ControllerModel, Registration } from './controllerModel';
import { createCredentialId, parseIpAndPort, UserCancelledError } from '../common/utils';
import { credentialNamespace } from '../constants';
import { ResourceModel } from './resourceModel';
import { Deferred } from '../common/promise';

export type EngineSettingsModel = { name: string };

export class PostgresModel extends ResourceModel {
	private _config?: azdataExt.PostgresServerShowResult;
	public _engineSettings: EngineSettingsModel[] = [];
	private readonly _azdataApi: azdataExt.IExtension;

	// The saved connection information
	private _connectionProfile: azdata.IConnectionProfile | undefined = undefined;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azdataExt.PostgresServerShowResult>();
	public readonly _onEngineSettingsUpdated = new vscode.EventEmitter<EngineSettingsModel[]>();
	public onConfigUpdated = this._onConfigUpdated.event;
	public onEngineSettingsUpdated = this._onEngineSettingsUpdated.event;
	public configLastUpdated?: Date;
	public engineSettingsLastUpdated?: Date;

	private _refreshPromise?: Deferred<void>;

	constructor(private _controllerModel: ControllerModel, private _pgInfo: PGResourceInfo, registration: Registration, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(_pgInfo, registration);
		this._azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}

	/** Returns the configuration of Postgres */
	public get config(): azdataExt.PostgresServerShowResult | undefined {
		return this._config;
	}

	/** Returns the major version of Postgres */
	public get engineVersion(): string | undefined {
		const kind = this._config?.kind;
		return kind
			? kind.substring(kind.lastIndexOf('-') + 1)
			: undefined;
	}

	/** Returns the IP address and port of Postgres */
	public get endpoint(): { ip: string, port: string } | undefined {
		return this._config?.status.externalEndpoint
			? parseIpAndPort(this._config.status.externalEndpoint)
			: undefined;
	}

	/** Returns the scale configuration of Postgres e.g. '3 nodes, 1.5 vCores, 1Gi RAM, 2Gi storage per node' */
	public get scaleConfiguration(): string | undefined {
		if (!this._config) {
			return undefined;
		}

		const cpuLimit = this._config.spec.scheduling?.default?.resources?.limits?.cpu;
		const ramLimit = this._config.spec.scheduling?.default?.resources?.limits?.memory;
		const cpuRequest = this._config.spec.scheduling?.default?.resources?.requests?.cpu;
		const ramRequest = this._config.spec.scheduling?.default?.resources?.requests?.memory;
		const storage = this._config.spec.storage?.data?.size;

		// scale.shards was renamed to scale.workers. Check both for backwards compatibility.
		const scale = this._config.spec.scale;
		const nodes = (scale?.workers ?? scale?.shards ?? 0) + 1; // An extra node for the coordinator

		let configuration: string[] = [];
		configuration.push(`${nodes} ${nodes > 1 ? loc.nodes : loc.node}`);

		// Prefer limits if they're provided, otherwise use requests if they're provided
		if (cpuLimit || cpuRequest) {
			configuration.push(`${cpuLimit ?? cpuRequest!} ${loc.vCores}`);
		}

		if (ramLimit || ramRequest) {
			configuration.push(`${ramLimit ?? ramRequest!} ${loc.ram}`);
		}

		if (storage) {
			configuration.push(`${storage} ${loc.storagePerNode}`);
		}

		return configuration.join(', ');
	}

	/** Refreshes the model */
	public async refresh() {
		// Only allow one refresh to be happening at a time
		if (this._refreshPromise) {
			return this._refreshPromise.promise;
		}
		this._refreshPromise = new Deferred();

		try {
			await this._controllerModel.azdataLogin();
			this._config = (await this._azdataApi.azdata.arc.postgres.server.show(this.info.name)).result;
			this.configLastUpdated = new Date();
			this._onConfigUpdated.fire(this._config);

			// If we have an external endpoint configured then fetch the engine settings now
			if (this._config.status.externalEndpoint) {
				//this.getEngineSettings();
			}



			this._refreshPromise.resolve();
		} catch (err) {
			this._refreshPromise.reject(err);
			throw err;
		} finally {
			this._refreshPromise = undefined;
		}
	}

	public async getEngineSettings(): Promise<void> {
		await this.getConnectionProfile();
		if (this._connectionProfile) {
			// TODO

			this.engineSettingsLastUpdated = new Date();
		}
	}

	/**
	 * Loads the saved connection profile associated with this model. Will prompt for one if
	 * we don't have one or can't find it (it was deleted)
	 */
	private async getConnectionProfile(): Promise<void> {
		if (this._connectionProfile) {
			return;
		}

		const ipAndPort = parseIpAndPort(this.config?.status.externalEndpoint || '');
		let connectionProfile: azdata.IConnectionProfile | undefined = {
			serverName: `${ipAndPort.ip},${ipAndPort.port}`,
			databaseName: '',
			authenticationType: 'SqlLogin',
			providerName: 'PGSQL',
			connectionName: '',
			userName: this._pgInfo.userName || '',
			password: '',
			savePassword: true,
			groupFullName: undefined,
			saveProfile: true,
			id: '',
			groupId: undefined,
			options: {}
		};

		// If we have the ID stored then try to retrieve the password from previous connections
		if (this.info.connectionId) {
			try {
				const credentialProvider = await azdata.credentials.getProvider(credentialNamespace);
				const credentials = await credentialProvider.readCredential(createCredentialId(this._controllerModel.info.id, this.info.resourceType, this.info.name));
				if (credentials.password) {
					// Try to connect to verify credentials are still valid
					connectionProfile.password = credentials.password;
					// If we don't have a username for some reason then just continue on and we'll prompt for the username below
					if (connectionProfile.userName) {
						const result = await azdata.connection.connect(connectionProfile, false, false);
						if (!result.connected) {
							vscode.window.showErrorMessage(loc.connectToPGSqlFailed(connectionProfile.serverName, result.errorMessage));
							const connectToSqlDialog = new ConnectToPGSqlDialog(this._controllerModel, this);
							connectToSqlDialog.showDialog(loc.connectToPGSql(this.info.name), connectionProfile);
							connectionProfile = await connectToSqlDialog.waitForClose();
						}
					}
				}
			} catch (err) {
				console.warn(`Unexpected error fetching password for MIAA instance ${err}`);
				// ignore - something happened fetching the password so just reprompt
			}
		}

		if (!connectionProfile?.userName || !connectionProfile?.password) {
			// Need to prompt user for password since we don't have one stored
			const connectToSqlDialog = new ConnectToPGSqlDialog(this._controllerModel, this);
			connectToSqlDialog.showDialog(loc.connectToPGSql(this.info.name), connectionProfile);
			connectionProfile = await connectToSqlDialog.waitForClose();
		}

		if (connectionProfile) {
			this.updateConnectionProfile(connectionProfile);
		} else {
			throw new UserCancelledError();
		}
	}

	private async updateConnectionProfile(connectionProfile: azdata.IConnectionProfile): Promise<void> {
		this._connectionProfile = connectionProfile;
		this.info.connectionId = connectionProfile.id;
		this._pgInfo.userName = connectionProfile.userName;
		await this._treeDataProvider.saveControllers();
	}
}
