/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MainThreadModelViewShape, ModelComponentTypes, SqlMainContext, ExtHostModelViewShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IDashboardViewService, IDashboardModelView } from 'sql/services/dashboard/common/dashboardViewService';
import * as sqlops from 'sqlops';

@extHostNamedCustomer(SqlMainContext.MainThreadModelView)
export class MainThreadModelView implements MainThreadModelViewShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostModelViewShape;
	private readonly _dialogs = new Map<number, IDashboardModelView>();

	private knownWidgets = new Array<string>();

	constructor(
		context: IExtHostContext,
		@IDashboardViewService viewService: IDashboardViewService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModelView);
		viewService.onRegisteredModelView(view => {
			if (this.knownWidgets.includes(view.id)) {
				let handle = MainThreadModelView._handlePool++;
				this._dialogs.set(handle, view);
				this._proxy.$registerWidget(handle, view.id, view.connection, view.serverInfo);
			}
		});
	}

	public dispose(): void {
		throw new Error('Method not implemented.');
	}

	$registerProvider(widgetId: string) {
		this.knownWidgets.push(widgetId);
	}

	$setModel(handle: number, componentId: string): void {
		this.execModelViewAction(handle, (modelView) => modelView.setModel(componentId));
	}

	$createComponent(handle: number, type: ModelComponentTypes, args: any): string {
		return this.execModelViewAction(handle, (modelView) => modelView.createComponent(type, args));
	}

	$clearContainer(handle: number, componentId: string) {
		this.execModelViewAction(handle, (modelView) => modelView.clearContainer(componentId));
	}
	$addToContainer(handle: number, containerId: string, childComponentid: string, config: any) {
		this.execModelViewAction(handle,
			(modelView) => modelView.addToContainer(containerId, childComponentid, config));
	}
	$setLayout(handle: number, componentId: string, layout: any): void {
		this.execModelViewAction(handle, (modelView) => modelView.setLayout(componentId, layout));
	}
	$setProperties(handle: number, componentId: string, properties: { [key: string]: any; }): void {
		this.execModelViewAction(handle, (modelView) => modelView.setProperties(componentId, properties));
	}

	private execModelViewAction<T>(handle: number, action: (m: IDashboardModelView) => T): T {
		let modelView: IDashboardModelView = this._dialogs.get(handle);
		return action(modelView);
	}
}
