/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as errors from 'vs/base/common/errors';
import * as vscode from 'vscode';
import { SqlMainContext, ExtHostModelViewTreeViewsShape, MainThreadModelViewShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ITreeComponentItem } from 'sql/workbench/common/views';
import { CommandsConverter } from 'vs/workbench/api/common/extHostCommands';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import * as azdata from 'azdata';
import * as  vsTreeExt from 'vs/workbench/api/common/extHostTreeViews';
import { Emitter } from 'vs/base/common/event';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { assign } from 'vs/base/common/objects';
import { ILogService } from 'vs/platform/log/common/log';

export class ExtHostModelViewTreeViews implements ExtHostModelViewTreeViewsShape {
	private _proxy: MainThreadModelViewShape;

	private treeViews: Map<string, ExtHostTreeView<any>> = new Map<string, ExtHostTreeView<any>>();

	constructor(
		private _mainContext: IMainContext,
		private readonly logService: ILogService
	) {
		this._proxy = this._mainContext.getProxy(SqlMainContext.MainThreadModelView);
	}

	$createTreeView<T>(handle: number, componentId: string, options: { treeDataProvider: azdata.TreeComponentDataProvider<T> }, extension: IExtensionDescription): azdata.TreeComponentView<T> {
		if (!options || !options.treeDataProvider) {
			throw new Error('Options with treeDataProvider is mandatory');
		}

		const treeView = this.createExtHostTreeViewer(handle, componentId, options.treeDataProvider, extension, this.logService);
		return {
			dispose: () => {
				this.treeViews.delete(componentId);
				treeView.dispose();
			},
			onNodeCheckedChanged: treeView.NodeCheckedChanged,
			onDidChangeSelection: treeView.ChangeSelection
		};
	}

	$getChildren(treeViewId: string, treeItemHandle?: string): Promise<ITreeComponentItem[]> {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {

			return Promise.reject(new Error(localize('treeView.notRegistered', "No tree view with id \'{0}\' registered.", treeViewId)));
		}
		return treeView.getChildren(treeItemHandle);
	}

	$onNodeCheckedChanged(treeViewId: string, treeItemHandle?: string, checked?: boolean): void {
		const treeView = this.treeViews.get(treeViewId);
		if (treeView) {
			treeView.onNodeCheckedChanged(treeItemHandle, checked);
		}
	}

	$onNodeSelected(treeViewId: string, handles: string[]): void {
		const treeView = this.treeViews.get(treeViewId);
		if (treeView) {
			treeView.onNodeSelectedChanged(handles);
		}
	}

	$setExpanded(treeViewId: string, treeItemHandle: string, expanded: boolean): void {
	}

	$setSelection(treeViewId: string, treeItemHandles: string[]): void {
	}

	$setVisible(treeViewId: string, visible: boolean): void {
	}

	$hasResolve(treeViewId: string): Promise<boolean> {
		return Promise.resolve(false);
	}

	$resolve(treeViewId: string, treeItemHandle: string): Promise<ITreeComponentItem | undefined> {
		return Promise.resolve(undefined);
	}

	private createExtHostTreeViewer<T>(handle: number, id: string, dataProvider: azdata.TreeComponentDataProvider<T>, extension: IExtensionDescription, logService: ILogService): ExtHostTreeView<T> {
		const treeView = new ExtHostTreeView<T>(handle, id, dataProvider, this._proxy, undefined, extension, logService);
		this.treeViews.set(`${handle}-${id}`, treeView);
		return treeView;
	}
}

export class ExtHostTreeView<T> extends vsTreeExt.ExtHostTreeView<T> {

	private _onNodeCheckedChanged = new Emitter<azdata.NodeCheckedEventParameters<T>>();
	private _onChangeSelection = new Emitter<vscode.TreeViewSelectionChangeEvent<T>>();
	public readonly NodeCheckedChanged: vscode.Event<azdata.NodeCheckedEventParameters<T>> = this._onNodeCheckedChanged.event;
	public readonly ChangeSelection: vscode.Event<vscode.TreeViewSelectionChangeEvent<T>> = this._onChangeSelection.event;
	constructor(
		private handle: number, private componentId: string, private componentDataProvider: azdata.TreeComponentDataProvider<T>,
		private modelViewProxy: MainThreadModelViewShape, commands: CommandsConverter, extension: IExtensionDescription,
		private readonly _logService: ILogService) {
		super(componentId, { treeDataProvider: componentDataProvider }, undefined, commands, _logService, extension);
	}

	onNodeCheckedChanged(parentHandle?: vsTreeExt.TreeItemHandle, checked?: boolean): void {
		const parentElement = parentHandle ? this.getExtensionElement(parentHandle) : void 0;
		if (parentHandle && !parentElement) {
			this._logService.error(`No tree item with id \'${parentHandle}\' found.`);
		}

		this._onNodeCheckedChanged.fire({ element: parentElement, checked: checked });
	}

	onNodeSelectedChanged(parentHandles?: vsTreeExt.TreeItemHandle[]): void {
		if (parentHandles) {
			let nodes = parentHandles.map(parentHandle => {
				return parentHandle ? this.getExtensionElement(parentHandle) : void 0;
			});
			this._onChangeSelection.fire({ selection: nodes });
		}
	}

	reveal(element: T, options?: { select?: boolean }): Promise<void> {
		if (typeof this.componentDataProvider.getParent !== 'function') {
			return Promise.reject(new Error(`Required registered TreeDataProvider to implement 'getParent' method to access 'reveal' method`));
		}
		let i: void;
		return Promise.resolve(this.resolveUnknownParentChain(element)
			.then(parentChain => this.resolveTreeNode(element, parentChain[parentChain.length - 1])
				.then(treeNode => i)));
	}

	protected refreshElements(elements: T[]): void {
		const hasRoot = elements.some(element => !element);
		if (hasRoot) {
			this.clearAll(); // clear cache
			this.modelViewProxy.$refreshDataProvider(this.handle, this.componentId);
		} else {
			const handlesToRefresh = this.getHandlesToRefresh(elements);
			if (handlesToRefresh.length) {
				this.refreshHandles(handlesToRefresh).catch(errors.onUnexpectedError);
			}
		}
	}

	protected refreshHandles(itemHandles: vsTreeExt.TreeItemHandle[]): Promise<void> {
		const itemsToRefresh: { [treeItemHandle: string]: ITreeComponentItem } = {};
		return Promise.all(itemHandles.map(treeItemHandle =>
			this.refreshNode(treeItemHandle)
				.then(node => {
					if (node) {
						itemsToRefresh[treeItemHandle] = node.item;
					}
				})))
			.then(() => Object.keys(itemsToRefresh).length ? this.modelViewProxy.$refreshDataProvider(this.handle, this.componentId, itemsToRefresh) : null);
	}

	protected refreshNode(treeItemHandle: vsTreeExt.TreeItemHandle): Promise<vsTreeExt.TreeNode> {
		const extElement = this.getExtensionElement(treeItemHandle);
		const existing = this.nodes.get(extElement);
		//this.clearChildren(extElement); // clear children cache
		return Promise.resolve(this.componentDataProvider.getTreeItem(extElement))
			.then(extTreeItem => {
				if (extTreeItem) {
					const newNode = this.createTreeNode(extElement, extTreeItem, existing.parent);
					this.updateNodeCache(extElement, newNode, existing, existing.parent);
					return newNode;
				}
				return null;
			});
	}

	protected createTreeNode(element: T, extensionTreeItem: azdata.TreeComponentItem, parent?: vsTreeExt.TreeNode | vsTreeExt.Root): vsTreeExt.TreeNode {
		let node = super.createTreeNode(element, extensionTreeItem, parent);
		if (node.item) {
			node.item = assign(node.item, { checked: extensionTreeItem.checked, enabled: extensionTreeItem.enabled });
		}
		return node;
	}
}
