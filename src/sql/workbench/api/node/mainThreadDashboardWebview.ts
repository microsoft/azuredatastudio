/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MainThreadDashboardWebviewShape, SqlMainContext, ExtHostDashboardWebviewsShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IDashboardViewService, IDashboardWebview } from 'sql/platform/dashboard/common/dashboardViewService';

@extHostNamedCustomer(SqlMainContext.MainThreadDashboardWebview)
export class MainThreadDashboardWebview implements MainThreadDashboardWebviewShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostDashboardWebviewsShape;
	private readonly _dialogs = new Map<number, IDashboardWebview>();

	private knownWidgets = new Array<string>();

	constructor(
		context: IExtHostContext,
		@IDashboardViewService viewService: IDashboardViewService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostDashboardWebviews);
		viewService.onRegisteredWebview(e => {
			if (this.knownWidgets.includes(e.id)) {
				let handle = MainThreadDashboardWebview._handlePool++;
				this._dialogs.set(handle, e);
				this._proxy.$registerWidget(handle, e.id, e.connection, e.serverInfo);
				e.onMessage(e => {
					this._proxy.$onMessage(handle, e);
				});
			}
		});
	}

	public dispose(): void {
		throw new Error('Method not implemented.');
	}

	$sendMessage(handle: number, message: string) {
		this._dialogs.get(handle).sendMessage(message);
	}

	$setHtml(handle: number, value: string) {
		this._dialogs.get(handle).setHtml(value);
	}

	$registerProvider(widgetId: string) {
		this.knownWidgets.push(widgetId);
	}
}
