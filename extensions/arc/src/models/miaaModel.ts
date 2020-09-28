/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MiaaResourceInfo } from 'arc';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { Deferred } from '../common/promise';
import { createCredentialId, parseIpAndPort, UserCancelledError } from '../common/utils';
import { credentialNamespace } from '../constants';
import * as loc from '../localizedConstants';
import { ConnectToSqlDialog } from '../ui/dialogs/connectSqlDialog';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import { ControllerModel, Registration } from './controllerModel';
import { ResourceModel } from './resourceModel';

export type DatabaseModel = { name: string, status: string };

export class MiaaModel extends ResourceModel {

	private _config: azdataExt.SqlMiShowResult | undefined;
	private _databases: DatabaseModel[] = [];
	// The saved connection information
	private _connectionProfile: azdata.IConnectionProfile | undefined = undefined;
	// The ID of the active connection used to query the server
	private _activeConnectionId: string | undefined = undefined;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azdataExt.SqlMiShowResult | undefined>();
	private readonly _onDatabasesUpdated = new vscode.EventEmitter<DatabaseModel[]>();
	private readonly _azdataApi: azdataExt.IExtension;
	public onConfigUpdated = this._onConfigUpdated.event;
	public onDatabasesUpdated = this._onDatabasesUpdated.event;
	public configLastUpdated?: Date;
	public databasesLastUpdated?: Date;

	private _refreshPromise: Deferred<void> | undefined = undefined;

	constructor(private _controllerModel: ControllerModel, private _miaaInfo: MiaaResourceInfo, registration: Registration, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(_miaaInfo, registration);
		this._azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}

	/**
	 * The username used to connect to this instance
	 */
	public get username(): string | undefined {
		return this._connectionProfile?.userName;
	}

	/**
	 * The status of this instance
	 */
	public get config(): azdataExt.SqlMiShowResult | undefined {
		return this._config;
	}

	/**
	 * The cluster endpoint of this instance
	 */
	public get clusterEndpoint(): string {
		return ''; // TODO chgagnon
		// return this._config?.cluster_endpoint || '';
	}

	public get databases(): DatabaseModel[] {
		return this._databases;
	}

	/** Refreshes the model */
	public async refresh(): Promise<void> {
		// Only allow one refresh to be happening at a time
		if (this._refreshPromise) {
			return this._refreshPromise.promise;
		}
		this._refreshPromise = new Deferred();
		try {
			await this._controllerModel.azdataLogin();
			try {
				const result = await this._azdataApi.azdata.arc.sql.mi.show(this.info.name);
				this._config = result.result;
				this.configLastUpdated = new Date();
				this._onConfigUpdated.fire(this._config);
			} catch (err) {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers can know to update (e.g. so dashboards don't show the
				// loading icon forever)
				vscode.window.showErrorMessage(loc.fetchConfigFailed(this.info.name, err));
				this.configLastUpdated = new Date();
				this._onConfigUpdated.fire(undefined);
				throw err;
			}

			// If we have an external endpoint configured then fetch the databases now
			if (this._config.status.externalEndpoint) {
				this.getDatabases().catch(err => {
					// If an error occurs show a message so the user knows something failed but still
					// fire the event so callers can know to update (e.g. so dashboards don't show the
					// loading icon forever)
					if (err instanceof UserCancelledError) {
						vscode.window.showWarningMessage(loc.connectionRequired);
					} else {
						vscode.window.showErrorMessage(loc.fetchDatabasesFailed(this.info.name, err));
					}
					this.databasesLastUpdated = new Date();
					this._onDatabasesUpdated.fire(this._databases);
					throw err;
				});
			} else {
				// Otherwise just fire the event so dashboards can update appropriately
				this.databasesLastUpdated = new Date();
				this._onDatabasesUpdated.fire(this._databases);
			}

			this._refreshPromise.resolve();
		} catch (err) {
			this._refreshPromise.reject(err);
			throw err;
		} finally {
			this._refreshPromise = undefined;
		}
	}

	private async getDatabases(): Promise<void> {
		await this.getConnectionProfile();
		if (this._connectionProfile) {
			// We haven't connected yet so do so now and then store the ID for the active connection
			if (!this._activeConnectionId) {
				const result = await azdata.connection.connect(this._connectionProfile, false, false);
				if (!result.connected) {
					throw new Error(result.errorMessage);
				}
				this._activeConnectionId = result.connectionId;
			}

			const provider = azdata.dataprotocol.getProvider<azdata.MetadataProvider>(this._connectionProfile.providerName, azdata.DataProviderType.MetadataProvider);
			const ownerUri = await azdata.connection.getUriForConnection(this._activeConnectionId);
			const databases = await provider.getDatabases(ownerUri);
			if (!databases) {
				throw new Error('Could not fetch databases');
			}
			if (databases.length > 0 && typeof (databases[0]) === 'object') {
				this._databases = (<azdata.DatabaseInfo[]>databases).map(db => { return { name: db.options['name'], status: db.options['state'] }; });
			} else {
				this._databases = (<string[]>databases).map(db => { return { name: db, status: '-' }; });
			}
			this.databasesLastUpdated = new Date();
			this._onDatabasesUpdated.fire(this._databases);
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
			providerName: 'MSSQL',
			connectionName: '',
			userName: this._miaaInfo.userName || '',
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
							vscode.window.showErrorMessage(loc.connectToSqlFailed(connectionProfile.serverName, result.errorMessage));
							const connectToSqlDialog = new ConnectToSqlDialog(this._controllerModel, this);
							connectToSqlDialog.showDialog(connectionProfile);
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
			const connectToSqlDialog = new ConnectToSqlDialog(this._controllerModel, this);
			connectToSqlDialog.showDialog(connectionProfile);
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
		this._miaaInfo.userName = connectionProfile.userName;
		await this._treeDataProvider.saveControllers();
	}
}
