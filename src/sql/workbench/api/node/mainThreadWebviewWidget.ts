/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MainThreadWebviewWidgetShape, SqlMainContext, ExtHostWebviewWidgetsShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlextHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IDashboardWebviewService, IWebviewWidget } from 'sql/services/dashboardWebview/common/dashboardWebviewService';

@extHostNamedCustomer(SqlMainContext.MainThreadWebviewWidget)
export class MainThreadWebviewWidget implements MainThreadWebviewWidgetShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostWebviewWidgetsShape;
	private readonly _dialogs = new Map<number, IWebviewWidget>();

	private knownWidgets = new Array<string>();

	constructor(
		context: IExtHostContext,
		@IDashboardWebviewService webviewService: IDashboardWebviewService
	) {
		this._proxy = context.get(SqlExtHostContext.ExtHostWebviewWidgets);
		webviewService.onRegisteredWidget(e => {
			if (this.knownWidgets.includes(e.id)) {
				let handle = MainThreadWebviewWidget._handlePool++;
				this._dialogs.set(handle, e);
				this._proxy.$registerWidget(handle, e.id);
			}
		});
	}

	public dispose(): void {
		throw new Error("Method not implemented.");
	}

	$sendMessage(handle: number, message: string) {
		throw new Error("Method not implemented.");
	}

	$setHtml(handle: number, value: string) {
		this._dialogs.get(handle).setHtml(value);
	}

	$registerProvider(widgetId: string) {
		this.knownWidgets.push(widgetId);
	}
}
