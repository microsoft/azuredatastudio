/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ExtHostConnectionManagementShape, SqlMainContext, MainThreadConnectionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { generateUuid } from 'vs/base/common/uuid';
import * as sqlops from 'sqlops';

export class ExtHostConnectionManagement extends ExtHostConnectionManagementShape {

	private _proxy: MainThreadConnectionManagementShape;

	constructor(
		mainContext: IMainContext
	) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadConnectionManagement);
	}

	public $getActiveConnections(): Thenable<sqlops.connection.Connection[]> {
		return this._proxy.$getActiveConnections();
	}

	public $getCurrentConnection(): Thenable<sqlops.connection.Connection> {
		return this._proxy.$getCurrentConnection();
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return this._proxy.$getCredentials(connectionId);
	}

	public $getServerInfo(connectionId: string): Thenable<sqlops.ServerInfo> {
		return this._proxy.$getServerInfo(connectionId);
	}

	public $openConnectionDialog(providers?: string[], initialConnectionProfile?: sqlops.IConnectionProfile, connectionCompletionOptions?: sqlops.IConnectionCompletionOptions): Thenable<sqlops.connection.Connection> {
		return this._proxy.$openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
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

	public $connect(connectionProfile: sqlops.IConnectionProfile): Thenable<sqlops.ConnectionResult> {
		return this._proxy.$connect(connectionProfile);
	}
}
