/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SqlInstanceRouterApi } from '../controller/generated/v1/api/sqlInstanceRouterApi';
import { HybridSqlNsNameGetResponse } from '../controller/generated/v1/model/hybridSqlNsNameGetResponse';
import { Authentication } from '../controller/generated/v1/api';

export type DatabaseModel = { name: string, status: string };

export class MiaaModel {

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

	constructor(controllerUrl: string, auth: Authentication, private _namespace: string, private _name: string) {
		this._sqlInstanceRouter = new SqlInstanceRouterApi(controllerUrl);
		this._sqlInstanceRouter.setDefaultAuthentication(auth);
	}

	/**
	 * The name of this instance
	 */
	public get name(): string {
		return this._name;
	}

	/**
	 * The namespace of this instance
	 */
	public get namespace(): string {
		return this._namespace;
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
		const instanceRefresh = this._sqlInstanceRouter.apiV1HybridSqlNsNameGet(this._namespace, this._name).then(response => {
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
		const connection = await azdata.connection.openConnectionDialog(['MSSQL']);
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
	}
}
