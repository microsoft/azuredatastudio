/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ExtHostConnectionManagementShape, SqlMainContext, MainThreadConnectionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { generateUuid } from 'vs/base/common/uuid';
import * as azdata from 'azdata';

export class ExtHostConnectionManagement extends ExtHostConnectionManagementShape {

	private _proxy: MainThreadConnectionManagementShape;

	constructor(
		mainContext: IMainContext
	) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadConnectionManagement);
	}

	public $getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		let connection: any = this._proxy.$getCurrentConnection();
		connection.then((conn) => {
			conn.providerId = conn.providerName;
		});
		return connection;
	}

	// "sqlops" back-compat connection APIs
	public $getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return this._proxy.$getActiveConnections();
	}

	public $getSqlOpsCurrentConnection(): Thenable<azdata.connection.Connection> {
		return this._proxy.$getCurrentConnection();
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return this._proxy.$getCredentials(connectionId);
	}

	public $getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return this._proxy.$getServerInfo(connectionId);
	}

	public $openConnectionDialog(providers?: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions, isCMSDialog: boolean = false): Thenable<azdata.connection.Connection> {
		return this._proxy.$openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions, isCMSDialog);
	}

	public $listDatabases(connectionId: string): Thenable<string[]> {
		return this._proxy.$listDatabases(connectionId);
	}

	public $getConnectionString(connectionId: string, includePassword: boolean): Thenable<string> {
		return this._proxy.$getConnectionString(connectionId, includePassword);
	}

	public $getUriForConnection(connectionId: string): Thenable<string> {
		return this._proxy.$getUriForConnection(connectionId);
	}

	public $connect(connectionProfile: azdata.IConnectionProfile, saveConnection: boolean = false, showDashboard: boolean = false): Thenable<azdata.ConnectionResult> {
		return this._proxy.$connect(connectionProfile, saveConnection, showDashboard);
	}
}
