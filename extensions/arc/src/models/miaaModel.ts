/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SqlInstanceRouterApi } from '../controller/generated/v1/api/sqlInstanceRouterApi';
import { HybridSqlNsNameGetResponse } from '../controller/generated/v1/model/hybridSqlNsNameGetResponse';
import { Authentication } from '../controller/generated/v1/api';
import { ResourceModel } from './resourceModel';
import { ResourceInfo } from './controllerModel';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';

export type DatabaseModel = { name: string, status: string };

export class MiaaModel extends ResourceModel {

	private _sqlInstanceRouter: SqlInstanceRouterApi;
	private _status: HybridSqlNsNameGetResponse | undefined;
	private _databases: DatabaseModel[] = [];
	private _connectionProfile: azdata.IConnectionProfile | undefined = undefined;

	private readonly _onPasswordUpdated = new vscode.EventEmitter<string>();
	private readonly _onStatusUpdated = new vscode.EventEmitter<HybridSqlNsNameGetResponse>();
	private readonly _onDatabasesUpdated = new vscode.EventEmitter<DatabaseModel[]>();
	public onPasswordUpdated = this._onPasswordUpdated.event;
	public onStatusUpdated = this._onStatusUpdated.event;
	public onDatabasesUpdated = this._onDatabasesUpdated.event;
	public passwordLastUpdated?: Date;

	constructor(controllerUrl: string, auth: Authentication, info: ResourceInfo, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(info);
		this._sqlInstanceRouter = new SqlInstanceRouterApi(controllerUrl);
		this._sqlInstanceRouter.setDefaultAuthentication(auth);
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
	public get status(): string {
		return this._status?.status || '';
	}

	/**
	 * The cluster endpoint of this instance
	 */
	public get clusterEndpoint(): string {
		return this._status?.cluster_endpoint || '';
	}

	public get databases(): DatabaseModel[] {
		return this._databases;
	}

	/** Refreshes the model */
	public async refresh(): Promise<void> {
		const instanceRefresh = this._sqlInstanceRouter.apiV1HybridSqlNsNameGet(this.info.namespace, this.info.name).then(response => {
			this._status = response.body;
			this._onStatusUpdated.fire(this._status);
		});
		const promises: Thenable<any>[] = [instanceRefresh];
		await this.getConnection();
		if (this._connectionProfile) {
			const provider = azdata.dataprotocol.getProvider<azdata.MetadataProvider>(this._connectionProfile.providerName, azdata.DataProviderType.MetadataProvider);
			const databasesRefresh = azdata.connection.getUriForConnection(this._connectionProfile.id).then(ownerUri => {
				provider.getDatabases(ownerUri).then(databases => {
					if (databases.length > 0 && typeof (databases[0]) === 'object') {
						this._databases = (<azdata.DatabaseInfo[]>databases).map(db => { return { name: db.options['name'], status: db.options['state'] }; });
					} else {
						this._databases = (<string[]>databases).map(db => { return { name: db, status: '-' }; });
					}
					this._onDatabasesUpdated.fire(this._databases);
				});
			});
			promises.push(databasesRefresh);
		}
		await Promise.all(promises);
	}

	private async getConnection(): Promise<void> {
		if (this._connectionProfile) {
			return;
		}
		let connection: azdata.connection.ConnectionProfile | azdata.connection.Connection | undefined;

		if (this.info.connectionId) {
			try {
				const connections = await azdata.connection.getConnections();
				const existingConnection = connections.find(conn => conn.connectionId === this.info.connectionId);
				if (existingConnection) {
					const credentials = await azdata.connection.getCredentials(this.info.connectionId);
					if (credentials) {
						existingConnection.password = credentials.password;
					} else {
						// We need the pass
						const connectionProfile = {
							serverName: existingConnection.options['serverName'],
							databaseName: existingConnection.options['databaseName'],
							authenticationType: existingConnection.options['authenticationType'],
							providerName: 'MSSQL',
							connectionName: '',
							userName: existingConnection.options['user'],
							password: '',
							savePassword: false,
							groupFullName: undefined,
							saveProfile: true,
							id: '',
							groupId: undefined,
							options: existingConnection.options
						};
						connection = await azdata.connection.openConnectionDialog(['MSSQL'], connectionProfile);
					}
				}
			} catch (err) {
				// ignore - the connection may not necessarily exist anymore and in that case we'll just reprompt for a connection
			}
		}

		if (!connection) {
			// Weren't able to load the existing connection so prompt user for new one
			connection = await azdata.connection.openConnectionDialog(['MSSQL']);
		}

		if (connection) {
			this._connectionProfile = {
				serverName: connection.options['serverName'],
				databaseName: connection.options['databaseName'],
				authenticationType: connection.options['authenticationType'],
				providerName: 'MSSQL',
				connectionName: '',
				userName: connection.options['user'],
				password: connection.options['password'],
				savePassword: false,
				groupFullName: undefined,
				saveProfile: true,
				id: connection.connectionId,
				groupId: undefined,
				options: connection.options
			};
			this.info.connectionId = connection.connectionId;
			await this._treeDataProvider.saveControllers();
		}

	}
}
