/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MainThreadModelViewShape, SqlMainContext, ExtHostModelViewShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IDashboardViewService, IDashboardModelView } from 'sql/services/dashboard/common/dashboardViewService';
import * as sqlops from 'sqlops';
import { IComponentConfigurationShape, IItemConfig, ModelComponentTypes } from 'sql/parts/dashboard/contents/mvvm/interfaces';

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

	$registerProvider(id: string) {
		this.knownWidgets.push(id);
	}

	$initializeModel(handle: number, rootComponent: IComponentConfigurationShape): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.initializeModel(rootComponent));
	}

	$clearContainer(handle: number, componentId: string): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.clearContainer(componentId));
	}

	$addToContainer(handle: number, containerId: string, item: IItemConfig): Thenable<void> {
		return this.execModelViewAction(handle,
			(modelView) => modelView.addToContainer(containerId, item));
	}

	$setLayout(handle: number, componentId: string, layout: any): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setLayout(componentId, layout));
	}

	$setProperties(handle: number, componentId: string, properties: { [key: string]: any; }): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setProperties(componentId, properties));
	}

	private execModelViewAction<T>(handle: number, action: (m: IDashboardModelView) => T): Thenable<T> {
		let modelView: IDashboardModelView = this._dialogs.get(handle);
		let result = action(modelView);
		return Promise.resolve(result);
	}
}
