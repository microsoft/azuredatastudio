/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainThreadModelViewShape, SqlMainContext, ExtHostModelViewShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/base/common/lifecycle';


import { IModelViewService } from 'sql/platform/modelComponents/browser/modelViewService';
import { IItemConfig, IComponentShape, IModelView } from 'sql/platform/model/browser/modelViewService';
import { find } from 'vs/base/common/arrays';


@extHostNamedCustomer(SqlMainContext.MainThreadModelView)
export class MainThreadModelView extends Disposable implements MainThreadModelViewShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostModelViewShape;
	private readonly _dialogs = new Map<number, IModelView>();
	private knownWidgets = new Array<string>();

	constructor(
		private _context: IExtHostContext,
		@IModelViewService viewService: IModelViewService
	) {
		super();
		this._proxy = _context.getProxy(SqlExtHostContext.ExtHostModelView);
		viewService.onRegisteredModelView(view => {
			if (find(this.knownWidgets, x => x === view.id)) {
				let handle = MainThreadModelView._handlePool++;
				this._dialogs.set(handle, view);
				this._proxy.$registerWidget(handle, view.id, view.connection, view.serverInfo);
				view.onDestroy(() => this._proxy.$onClosed(handle));
			}
		});
	}

	$registerProvider(id: string) {
		this.knownWidgets.push(id);
	}

	$initializeModel(handle: number, rootComponent: IComponentShape): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => {
			modelView.initializeModel(rootComponent, (componentId) => this.runCustomValidations(handle, componentId));
		});
	}

	$clearContainer(handle: number, componentId: string): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.clearContainer(componentId));
	}

	$addToContainer(handle: number, containerId: string, item: IItemConfig, index?: number): Thenable<void> {
		return this.execModelViewAction(handle,
			(modelView) => modelView.addToContainer(containerId, item, index));
	}

	$removeFromContainer(handle: number, containerId: string, item: IItemConfig): Thenable<void> {
		return this.execModelViewAction(handle,
			(modelView) => modelView.removeFromContainer(containerId, item));
	}

	$setLayout(handle: number, componentId: string, layout: any): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setLayout(componentId, layout));
	}

	$setItemLayout(handle: number, containerId: string, item: IItemConfig): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setItemLayout(containerId, item));
	}

	private onEvent(handle: number, componentId: string, eventArgs: any) {
		this._proxy.$handleEvent(handle, componentId, eventArgs);
	}

	$registerEvent(handle: number, componentId: string): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => {
			this._register(modelView.onEvent(e => {
				if (e.componentId && e.componentId === componentId) {
					this.onEvent(handle, componentId, e);
				}
			}));
		});
	}

	$setDataProvider(handle: number, componentId: string): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setDataProvider(handle, componentId, this._context));
	}

	$refreshDataProvider(handle: number, componentId: string, item?: any): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.refreshDataProvider(componentId, item));
	}

	$setProperties(handle: number, componentId: string, properties: { [key: string]: any; }): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setProperties(componentId, properties));
	}

	$validate(handle: number, componentId: string): Thenable<boolean> {
		return new Promise(resolve => this.execModelViewAction(handle, (modelView) => resolve(modelView.validate(componentId))));
	}

	$focus(handle: number, componentId: string): Thenable<void> {
		return new Promise(resolve => this.execModelViewAction(handle, (modelView) => resolve(modelView.focus(componentId))));
	}

	$doAction(handle: number, componentId: string, action: string, ...args: any[]): Thenable<void> {
		return new Promise(resolve => this.execModelViewAction(handle, (modelView) => resolve(modelView.doAction(componentId, action, ...args))));
	}

	private runCustomValidations(handle: number, componentId: string): Thenable<boolean> {
		return this._proxy.$runCustomValidations(handle, componentId);
	}

	private execModelViewAction<T>(handle: number, action: (m: IModelView) => T): Thenable<T> {
		let modelView: IModelView = this._dialogs.get(handle);
		let result = action(modelView);
		return Promise.resolve(result);
	}
}
