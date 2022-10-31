/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainThreadDashboardWebviewShape, ExtHostDashboardWebviewsShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IDashboardViewService, IDashboardWebview } from 'sql/platform/dashboard/browser/dashboardViewService';
import { Disposable } from 'vs/base/common/lifecycle';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadDashboardWebview)
export class MainThreadDashboardWebview extends Disposable implements MainThreadDashboardWebviewShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostDashboardWebviewsShape;
	private readonly _dialogs = new Map<number, IDashboardWebview>();

	private knownWidgets = new Array<string>();

	constructor(
		context: IExtHostContext,
		@IDashboardViewService viewService: IDashboardViewService
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostDashboardWebviews);
		this._register(viewService.onRegisteredWebview(e => {
			if (this.knownWidgets.find(x => x === e.id)) {
				let handle = MainThreadDashboardWebview._handlePool++;
				this._dialogs.set(handle, e);
				this._proxy.$registerWidget(handle, e.id, e.connection, e.serverInfo);
				e.onMessage(e => {
					this._proxy.$onMessage(handle, e);
				});
			}
		}));
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
