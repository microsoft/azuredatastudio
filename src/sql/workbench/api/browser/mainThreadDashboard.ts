/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { SqlMainContext, MainThreadDashboardShape, ExtHostDashboardShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';

@extHostNamedCustomer(SqlMainContext.MainThreadDashboard)
export class MainThreadDashboard implements MainThreadDashboardShape {
	private _proxy: ExtHostDashboardShape;

	constructor(
		context: IExtHostContext,
		@IExtensionService extensionService: IExtensionService,
		@IDashboardService dashboardService: IDashboardService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostDashboard);
		dashboardService.onDidChangeToDashboard(e => {
			extensionService.activateByEvent('onDashboardOpen');
			this._proxy.$onDidChangeToDashboard(e);
		});

		dashboardService.onDidOpenDashboard(e => {
			this._proxy.$onDidOpenDashboard(e);
		});
	}

	public dispose(): void {

	}
}
