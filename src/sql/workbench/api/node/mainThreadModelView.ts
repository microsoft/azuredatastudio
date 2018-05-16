/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MainThreadModelViewShape, SqlMainContext, ExtHostModelViewShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

import { IModelViewService } from 'sql/services/modelComponents/modelViewService';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IModelView } from 'sql/services/model/modelViewService';
import { Disposable } from 'vs/base/common/lifecycle';
import { Dialog } from '../../../platform/dialog/dialogTypes';
import { DialogPane } from '../../../platform/dialog/dialogPane';
import { IBootstrapService } from '../../../services/bootstrap/bootstrapService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import URI from 'vs/base/common/uri';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Builder } from 'vs/base/browser/builder';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Dimension } from 'vs/workbench/services/part/common/partService';
import { EditorInput, EditorModel, EditorOptions } from 'vs/workbench/common/editor';
import { TPromise } from 'vs/base/common/winjs.base';
import { BaseTextEditorModel } from 'vs/workbench/common/editor/textEditorModel';
import { IEditorModel, IEditorOptions } from 'vs/platform/editor/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';

class ModelViewEditor extends BaseEditor {
	public static ID = 'modelViewEditor';
	private _parent: Builder;

	constructor(@ITelemetryService telemetryService: ITelemetryService, @IThemeService themeService: IThemeService, @IBootstrapService private _bootstrapService: IBootstrapService) {
		super(ModelViewEditor.ID, telemetryService, themeService);
	}

	public createEditor(parent: Builder): void {
		this._parent = parent;
	}

	public setInput(input: EditorInput, options?: EditorOptions): TPromise<void, any> {
		let retVal = super.setInput(input, options);
		let modelViewInput = <ModelViewEditorInput>input;
		let dialog = new Dialog(modelViewInput.title, modelViewInput.modelViewId);
		let dialogPane = new DialogPane(dialog, this._bootstrapService);
		dialogPane.createBody(this._parent.getHTMLElement());
		return retVal;
	}

	public layout(dimension: Dimension): void {

	}
}

class ModelViewEditorInput extends EditorInput {
	public title: string;
	public modelViewId: string;

	public getTypeId(): string {
		return 'ModelViewEditorInput';
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return TPromise.as(new ModelViewEditorModel());
	}

	public getName(): string {
		return this.title;
	}
}

class ModelViewEditorModel extends EditorModel {

}

const modelViewEditorDescriptor = new EditorDescriptor(
	ModelViewEditor,
	ModelViewEditor.ID,
	'ModelView'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(modelViewEditorDescriptor, [new SyncDescriptor(ModelViewEditorInput)]);

@extHostNamedCustomer(SqlMainContext.MainThreadModelView)
export class MainThreadModelView extends Disposable implements MainThreadModelViewShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostModelViewShape;
	private readonly _dialogs = new Map<number, IModelView>();

	private knownWidgets = new Array<string>();

	constructor(
		context: IExtHostContext,
		@IModelViewService viewService: IModelViewService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModelView);
		viewService.onRegisteredModelView(view => {
			if (this.knownWidgets.includes(view.id)) {
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

	$addToContainer(handle: number, containerId: string, item: IItemConfig): Thenable<void> {
		return this.execModelViewAction(handle,
			(modelView) => modelView.addToContainer(containerId, item));
	}

	$setLayout(handle: number, componentId: string, layout: any): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setLayout(componentId, layout));
	}

	private onEvent(handle: number, componentId: string, eventArgs: any) {
		this._proxy.$handleEvent(handle, componentId, eventArgs);
	}

	$registerEvent(handle: number, componentId: string): Thenable<void> {
		let properties: { [key: string]: any; } = { eventName: this.onEvent };
		return this.execModelViewAction(handle, (modelView) => {
			this._register(modelView.onEvent(e => {
				if (e.componentId && e.componentId === componentId) {
					this.onEvent(handle, componentId, e);
				}
			}));
		});
	}

	$setProperties(handle: number, componentId: string, properties: { [key: string]: any; }): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setProperties(componentId, properties));
	}

	$validate(handle: number, componentId: string): Thenable<boolean> {
		return new Promise(resolve => this.execModelViewAction(handle, (modelView) => resolve(modelView.validate(componentId))));
	}

	private runCustomValidations(handle: number, componentId: string): Thenable<boolean> {
		return this._proxy.$runCustomValidations(handle, componentId);
	}

	private execModelViewAction<T>(handle: number, action: (m: IModelView) => T): Thenable<T> {
		let modelView: IModelView = this._dialogs.get(handle);
		let result = action(modelView);
		return Promise.resolve(result);
	}

	$openModelViewEditor(title: string, modelViewId: string, position: vscode.ViewColumn, options: any): Thenable<void> {
		let input = new ModelViewEditorInput();
		input.title = title;
		input.modelViewId = modelViewId;
		let editorOptions = Object.assign({
			preserveFocus: true,
			pinned: true
		} as IEditorOptions);
		return this._editorService.openEditor(input, editorOptions, position as any).then(() => undefined);
	}
}
