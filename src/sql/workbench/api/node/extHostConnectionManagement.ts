/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { ExtHostConnectionManagementShape, SqlMainContext, MainThreadConnectionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';

export class ExtHostConnectionManagement extends ExtHostConnectionManagementShape  {

	private _proxy: MainThreadConnectionManagementShape;

	constructor(
		threadService: IThreadService
	) {
		super();
		this._proxy = threadService.get(SqlMainContext.MainThreadConnectionManagement);
	}

	public $getActiveConnections(): Thenable<sqlops.connection.Connection[]> {
		return this._proxy.$getActiveConnections();
	}

	public $getCurrentConnection(): Thenable<sqlops.connection.Connection> {
		return this._proxy.$getCurrentConnection();
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string}> {
		return this._proxy.$getCredentials(connectionId);
	}
}
