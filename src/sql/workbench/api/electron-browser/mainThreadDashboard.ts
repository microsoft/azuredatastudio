
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { SqlMainContext, MainThreadDashboardShape, ExtHostDashboardShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';

@extHostNamedCustomer(SqlMainContext.MainThreadDashboard)
export class MainThreadDashboard implements MainThreadDashboardShape {
	private _proxy: ExtHostDashboardShape;

	constructor(
		context: IExtHostContext,
		@IDashboardService private _dashboardService: IDashboardService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostDashboard);
		_dashboardService.onDidChangeToDashboard(e => {
			this._proxy.$onDidChangeToDashboard(e);
		});

		_dashboardService.onDidOpenDashboard(e => {
			this._proxy.$onDidOpenDashboard(e);
		});
	}

	public dispose(): void {

	}
}
