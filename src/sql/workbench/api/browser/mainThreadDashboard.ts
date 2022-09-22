/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainThreadDashboardShape, ExtHostDashboardShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

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
