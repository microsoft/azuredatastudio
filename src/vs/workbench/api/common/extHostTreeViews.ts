/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import type * as vscode from 'vscode';
import { basename } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { ExtHostTreeViewsShape, MainThreadTreeViewsShape } from './extHost.protocol';
import { ITreeItem, TreeViewItemHandleArg, ITreeItemLabel, IRevealOptions, TREE_ITEM_DATA_TRANSFER_TYPE } from 'vs/workbench/common/views';
import { ExtHostCommands, CommandsConverter } from 'vs/workbench/api/common/extHostCommands';
import { asPromise } from 'vs/base/common/async';
import { TreeItemCollapsibleState, ThemeIcon, MarkdownString as MarkdownStringType } from 'vs/workbench/api/common/extHostTypes';
import { isUndefinedOrNull, isString } from 'vs/base/common/types';
import { equals, coalesce } from 'vs/base/common/arrays';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { MarkdownString } from 'vs/workbench/api/common/extHostTypeConverters';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Command } from 'vs/editor/common/modes';
import { TreeDataTransferConverter, TreeDataTransferDTO } from 'vs/workbench/api/common/shared/treeDataTransfer';

// {{SQL CARBON EDIT}}
import * as azdata from 'azdata';
export type TreeItemHandle = string;

function toTreeItemLabel(label: any, extension: IExtensionDescription): ITreeItemLabel | undefined {
	if (isString(label)) {
		return { label };
	}

	if (label
		&& typeof label === 'object'
		&& typeof label.label === 'string') {
		let highlights: [number, number][] | undefined = undefined;
		if (Array.isArray(label.highlights)) {
			highlights = (<[number, number][]>label.highlights).filter((highlight => highlight.length === 2 && typeof highlight[0] === 'number' && typeof highlight[1] === 'number'));
			highlights = highlights.length ? highlights : undefined;
		}
		return { label: label.label, highlights };
	}

	return undefined;
}


export class ExtHostTreeViews implements ExtHostTreeViewsShape {

	private treeViews: Map<string, ExtHostTreeView<any>> = new Map<string, ExtHostTreeView<any>>();

	constructor(
		private _proxy: MainThreadTreeViewsShape,
		private commands: ExtHostCommands,
		private logService: ILogService
	) {

		function isTreeViewItemHandleArg(arg: any): boolean {
			return arg && arg.$treeViewId && arg.$treeItemHandle && !arg.$treeItem?.payload; // {{SQL CARBON EDIT}} Don't process Data Explorer tree items
		}
		commands.registerArgumentProcessor({
			processArgument: arg => {
				if (isTreeViewItemHandleArg(arg)) {
					return this.convertArgument(arg);
				} else if (Array.isArray(arg) && (arg.length > 0)) {
					return arg.map(item => {
						if (isTreeViewItemHandleArg(item)) {
							return this.convertArgument(item);
						}
						return item;
					});
				}
				return arg;
			}
		});
	}

	registerTreeDataProvider<T>(id: string, treeDataProvider: vscode.TreeDataProvider<T>, extension: IExtensionDescription): vscode.Disposable {
		const treeView = this.createTreeView(id, { treeDataProvider }, extension);
		return { dispose: () => treeView.dispose() };
	}

	createTreeView<T>(viewId: string, options: vscode.TreeViewOptions<T>, extension: IExtensionDescription): vscode.TreeView<T> {
		if (!options || !options.treeDataProvider) {
			throw new Error('Options with treeDataProvider is mandatory');
		}
		const canDragAndDrop = options.dragAndDropController !== undefined;
		const registerPromise = this._proxy.$registerTreeViewDataProvider(viewId, { showCollapseAll: !!options.showCollapseAll, canSelectMany: !!options.canSelectMany, canDragAndDrop: canDragAndDrop });
		const treeView = this.createExtHostTreeView(viewId, options, extension);
		return {
			get onDidCollapseElement() { return treeView.onDidCollapseElement; },
			get onDidExpandElement() { return treeView.onDidExpandElement; },
			get selection() { return treeView.selectedElements; },
			get onDidChangeSelection() { return treeView.onDidChangeSelection; },
			get visible() { return treeView.visible; },
			get onDidChangeVisibility() { return treeView.onDidChangeVisibility; },
			get message() { return treeView.message; },
			set message(message: string) {
				treeView.message = message;
			},
			get title() { return treeView.title; },
			set title(title: string) {
				treeView.title = title;
			},
			get description() {
				return treeView.description;
			},
			set description(description: string | undefined) {
				treeView.description = description;
			},
			reveal: (element: T, options?: IRevealOptions): Promise<void> => {
				return treeView.reveal(element, options);
			},
			dispose: async () => {
				// Wait for the registration promise to finish before doing the dispose.
				await registerPromise;
				this.treeViews.delete(viewId);
				treeView.dispose();
			}
		};
	}

	$getChildren(treeViewId: string, treeItemHandle?: string): Promise<ITreeItem[] | undefined> {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			return Promise.reject(new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId)));
		}
		return treeView.getChildren(treeItemHandle);
	}

	async $onDrop(treeViewId: string, treeDataTransferDTO: TreeDataTransferDTO, newParentItemHandle: string): Promise<void> {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			return Promise.reject(new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId)));
		}

		const treeDataTransfer = TreeDataTransferConverter.toITreeDataTransfer(treeDataTransferDTO);
		if (treeDataTransfer.items.has(TREE_ITEM_DATA_TRANSFER_TYPE)) {
			const sourceHandles: string[] = JSON.parse(await treeDataTransfer.items.get(TREE_ITEM_DATA_TRANSFER_TYPE)!.asString());
			const sourceElements = sourceHandles.map(handle => treeView.getExtensionElement(handle)).filter(element => !!element);
			if (sourceElements.length > 0) {
				treeDataTransfer.items.set(TREE_ITEM_DATA_TRANSFER_TYPE, {
					asString: async () => JSON.stringify(sourceElements)
				});
			} else {
				treeDataTransfer.items.delete(TREE_ITEM_DATA_TRANSFER_TYPE);
			}
		}
		return treeView.onDrop(treeDataTransfer, newParentItemHandle);
	}

	async $hasResolve(treeViewId: string): Promise<boolean> {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			throw new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId));
		}
		return treeView.hasResolve;
	}

	$resolve(treeViewId: string, treeItemHandle: string, token: vscode.CancellationToken): Promise<ITreeItem | undefined> {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			throw new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId));
		}
		return treeView.resolveTreeItem(treeItemHandle, token);
	}

	$setExpanded(treeViewId: string, treeItemHandle: string, expanded: boolean): void {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			throw new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId));
		}
		treeView.setExpanded(treeItemHandle, expanded);
	}

	$setSelection(treeViewId: string, treeItemHandles: string[]): void {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			throw new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId));
		}
		treeView.setSelection(treeItemHandles);
	}

	$setVisible(treeViewId: string, isVisible: boolean): void {
		const treeView = this.treeViews.get(treeViewId);
		if (!treeView) {
			throw new Error(localize('treeView.notRegistered', 'No tree view with id \'{0}\' registered.', treeViewId));
		}
		treeView.setVisible(isVisible);
	}

	private createExtHostTreeView<T>(id: string, options: vscode.TreeViewOptions<T>, extension: IExtensionDescription): ExtHostTreeView<T> {
		const treeView = new ExtHostTreeView<T>(id, options, this._proxy, this.commands.converter, this.logService, extension);
		this.treeViews.set(id, treeView);
		return treeView;
	}

	private convertArgument(arg: TreeViewItemHandleArg): any {
		const treeView = this.treeViews.get(arg.$treeViewId);
		return treeView ? treeView.getExtensionElement(arg.$treeItemHandle) : null;
	}
}

export type Root = null | undefined | void; // {{SQL CARBON EDIT}} export interface
type TreeData<T> = { message: boolean, element: T | T[] | Root | false };

export interface TreeNode extends IDisposable { // {{SQL CARBON EDIT}} export interface
	item: ITreeItem;
	extensionItem: vscode.TreeItem;
	parent: TreeNode | Root;
	children?: TreeNode[];
	disposableStore: DisposableStore;
}

// {{SQL CARBON EDIT}}
export class ExtHostTreeView<T> extends Disposable {

	private static readonly LABEL_HANDLE_PREFIX = '0';
	private static readonly ID_HANDLE_PREFIX = '1';

	private readonly dataProvider: vscode.TreeDataProvider<T>;
	private readonly dndController: vscode.DragAndDropController<T> | undefined;

	private roots: TreeNode[] | undefined = undefined;
	private elements: Map<TreeItemHandle, T> = new Map<TreeItemHandle, T>();
	// {{SQL CARBON EDIT}}
	protected nodes: Map<T, TreeNode> = new Map<T, TreeNode>();

	private _visible: boolean = false;
	get visible(): boolean { return this._visible; }

	private _selectedHandles: TreeItemHandle[] = [];
	get selectedElements(): T[] { return <T[]>this._selectedHandles.map(handle => this.getExtensionElement(handle)).filter(element => !isUndefinedOrNull(element)); }

	private _onDidExpandElement: Emitter<vscode.TreeViewExpansionEvent<T>> = this._register(new Emitter<vscode.TreeViewExpansionEvent<T>>());
	readonly onDidExpandElement: Event<vscode.TreeViewExpansionEvent<T>> = this._onDidExpandElement.event;

	private _onDidCollapseElement: Emitter<vscode.TreeViewExpansionEvent<T>> = this._register(new Emitter<vscode.TreeViewExpansionEvent<T>>());
	readonly onDidCollapseElement: Event<vscode.TreeViewExpansionEvent<T>> = this._onDidCollapseElement.event;

	private _onDidChangeSelection: Emitter<vscode.TreeViewSelectionChangeEvent<T>> = this._register(new Emitter<vscode.TreeViewSelectionChangeEvent<T>>());
	readonly onDidChangeSelection: Event<vscode.TreeViewSelectionChangeEvent<T>> = this._onDidChangeSelection.event;

	private _onDidChangeVisibility: Emitter<vscode.TreeViewVisibilityChangeEvent> = this._register(new Emitter<vscode.TreeViewVisibilityChangeEvent>());
	readonly onDidChangeVisibility: Event<vscode.TreeViewVisibilityChangeEvent> = this._onDidChangeVisibility.event;

	private _onDidChangeData: Emitter<TreeData<T>> = this._register(new Emitter<TreeData<T>>());

	private refreshPromise: Promise<void> = Promise.resolve();
	private refreshQueue: Promise<void> = Promise.resolve();

	constructor(
		private viewId: string, options: vscode.TreeViewOptions<T>,
		private proxy: MainThreadTreeViewsShape,
		private commands: CommandsConverter,
		private logService: ILogService,
		private extension: IExtensionDescription
	) {
		super();
		if (extension.contributes && extension.contributes.views) {
			for (const location in extension.contributes.views) {
				for (const view of extension.contributes.views[location]) {
					if (view.id === viewId) {
						this._title = view.name;
					}
				}
			}
		}
		this.dataProvider = options.treeDataProvider;
		this.dndController = options.dragAndDropController;

		// {{SQL CARBON EDIT}}
		if (this.proxy) {
			this.proxy.$registerTreeViewDataProvider(viewId, { showCollapseAll: !!options.showCollapseAll, canSelectMany: !!options.canSelectMany, canDragAndDrop: options.dragAndDropController !== undefined });
		}
		this.dndController = options.dragAndDropController;
		if (this.dataProvider.onDidChangeTreeData2) {
			this._register(this.dataProvider.onDidChangeTreeData2(elementOrElements => this._onDidChangeData.fire({ message: false, element: elementOrElements })));
		} else if (this.dataProvider.onDidChangeTreeData) {
			this._register(this.dataProvider.onDidChangeTreeData(element => this._onDidChangeData.fire({ message: false, element })));
		}

		let refreshingPromise: Promise<void> | null;
		let promiseCallback: () => void;
		this._register(Event.debounce<TreeData<T>, { message: boolean, elements: (T | Root)[] }>(this._onDidChangeData.event, (result, current) => {
			if (!result) {
				result = { message: false, elements: [] };
			}
			if (current.element !== false) {
				if (!refreshingPromise) {
					// New refresh has started
					refreshingPromise = new Promise(c => promiseCallback = c);
					this.refreshPromise = this.refreshPromise.then(() => refreshingPromise!);
				}
				if (Array.isArray(current.element)) {
					result.elements.push(...current.element);
				} else {
					result.elements.push(current.element);
				}
			}
			if (current.message) {
				result.message = true;
			}
			return result;
		}, 200, true)(({ message, elements }) => {
			if (elements.length) {
				this.refreshQueue = this.refreshQueue.then(() => {
					const _promiseCallback = promiseCallback;
					refreshingPromise = null;
					return this.refresh(elements).then(() => _promiseCallback());
				});
			}
			if (message) {
				this.proxy.$setMessage(this.viewId, this._message);
			}
		}));
	}

	async getChildren(parentHandle: TreeItemHandle | Root): Promise<ITreeItem[] | undefined> {
		const parentElement = parentHandle ? this.getExtensionElement(parentHandle) : undefined;
		if (parentHandle && !parentElement) {
			this.logService.error(`No tree item with id \'${parentHandle}\' found.`);
			return Promise.resolve([]);
		}

		let childrenNodes: TreeNode[] | undefined = this.getChildrenNodes(parentHandle); // Get it from cache

		if (!childrenNodes) {
			childrenNodes = await this.fetchChildrenNodes(parentElement);
		}

		return childrenNodes ? childrenNodes.map(n => n.item) : undefined;
	}

	getExtensionElement(treeItemHandle: TreeItemHandle): T | undefined {
		return this.elements.get(treeItemHandle);
	}

	reveal(element: T | undefined, options?: IRevealOptions): Promise<void> {
		options = options ? options : { select: true, focus: false };
		const select = isUndefinedOrNull(options.select) ? true : options.select;
		const focus = isUndefinedOrNull(options.focus) ? false : options.focus;
		const expand = isUndefinedOrNull(options.expand) ? false : options.expand;

		if (typeof this.dataProvider.getParent !== 'function') {
			return Promise.reject(new Error(`Required registered TreeDataProvider to implement 'getParent' method to access 'reveal' method`));
		}

		if (element) {
			return this.refreshPromise
				.then(() => this.resolveUnknownParentChain(element))
				.then(parentChain => this.resolveTreeNode(element, parentChain[parentChain.length - 1])
					.then(treeNode => this.proxy.$reveal(this.viewId, { item: treeNode.item, parentChain: parentChain.map(p => p.item) }, { select, focus, expand })), error => this.logService.error(error));
		} else {
			return this.proxy.$reveal(this.viewId, undefined, { select, focus, expand });
		}
	}

	private _message: string = '';
	get message(): string {
		return this._message;
	}

	set message(message: string) {
		this._message = message;
		this._onDidChangeData.fire({ message: true, element: false });
	}

	private _title: string = '';
	get title(): string {
		return this._title;
	}

	set title(title: string) {
		this._title = title;
		this.proxy.$setTitle(this.viewId, title, this._description);
	}

	private _description: string | undefined;
	get description(): string | undefined {
		return this._description;
	}

	set description(description: string | undefined) {
		this._description = description;
		this.proxy.$setTitle(this.viewId, this._title, description);
	}

	setExpanded(treeItemHandle: TreeItemHandle, expanded: boolean): void {
		const element = this.getExtensionElement(treeItemHandle);
		if (element) {
			if (expanded) {
				this._onDidExpandElement.fire(Object.freeze({ element }));
			} else {
				this._onDidCollapseElement.fire(Object.freeze({ element }));
			}
		}
	}

	setSelection(treeItemHandles: TreeItemHandle[]): void {
		if (!equals(this._selectedHandles, treeItemHandles)) {
			this._selectedHandles = treeItemHandles;
			this._onDidChangeSelection.fire(Object.freeze({ selection: this.selectedElements }));
		}
	}

	setVisible(visible: boolean): void {
		if (visible !== this._visible) {
			this._visible = visible;
			this._onDidChangeVisibility.fire(Object.freeze({ visible: this._visible }));
		}
	}

	async onDrop(treeDataTransfer: vscode.TreeDataTransfer, targetHandleOrNode: TreeItemHandle): Promise<void> {
		const target = this.getExtensionElement(targetHandleOrNode);
		if (!target) {
			return;
		}
		return asPromise(() => this.dndController?.onDrop(treeDataTransfer, target));
	}

	get hasResolve(): boolean {
		return !!this.dataProvider.resolveTreeItem;
	}

	async resolveTreeItem(treeItemHandle: string, token: vscode.CancellationToken): Promise<ITreeItem | undefined> {
		if (!this.dataProvider.resolveTreeItem) {
			return undefined; // {{SQL CARBON EDIT}} strict-null-checks
		}
		const element = this.elements.get(treeItemHandle);
		if (element) {
			const node = this.nodes.get(element);
			if (node) {
				const resolve = await this.dataProvider.resolveTreeItem(node.extensionItem, element, token) ?? node.extensionItem;
				// Resolvable elements. Currently only tooltip and command.
				node.item.tooltip = this.getTooltip(resolve.tooltip);
				node.item.command = this.getCommand(node.disposableStore, resolve.command);
				return node.item;
			}
		}
		return undefined; // {{SQL CARBON EDIT}} strict-null-checks
	}

	protected resolveUnknownParentChain(element: T): Promise<TreeNode[]> { // {{SQL CARBON EDIT}}
		return this.resolveParent(element)
			.then((parent) => {
				if (!parent) {
					return Promise.resolve([]);
				}
				return this.resolveUnknownParentChain(parent)
					.then(result => this.resolveTreeNode(parent, result[result.length - 1])
						.then(parentNode => {
							result.push(parentNode);
							return result;
						}));
			});
	}

	private resolveParent(element: T): Promise<T | Root> {
		const node = this.nodes.get(element);
		if (node) {
			return Promise.resolve(node.parent ? this.elements.get(node.parent.item.handle) : undefined);
		}
		return asPromise(() => this.dataProvider.getParent!(element));
	}

	// {{SQL CARBON EDIT}}
	protected resolveTreeNode(element: T, parent?: TreeNode): Promise<TreeNode> {
		const node = this.nodes.get(element);
		if (node) {
			return Promise.resolve(node);
		}
		return asPromise(() => this.dataProvider.getTreeItem(element))
			.then(extTreeItem => this.createHandle(element, extTreeItem, parent, true))
			.then(handle => this.getChildren(parent ? parent.item.handle : undefined)
				.then(() => {
					const cachedElement = this.getExtensionElement(handle);
					if (cachedElement) {
						const node = this.nodes.get(cachedElement);
						if (node) {
							return Promise.resolve(node);
						}
					}
					throw new Error(`Cannot resolve tree item for element ${handle}`);
				}));
	}

	private getChildrenNodes(parentNodeOrHandle: TreeNode | TreeItemHandle | Root): TreeNode[] | undefined {
		if (parentNodeOrHandle) {
			let parentNode: TreeNode | undefined;
			if (typeof parentNodeOrHandle === 'string') {
				const parentElement = this.getExtensionElement(parentNodeOrHandle);
				parentNode = parentElement ? this.nodes.get(parentElement) : undefined;
			} else {
				parentNode = parentNodeOrHandle;
			}
			return parentNode ? parentNode.children || undefined : undefined;
		}
		return this.roots;
	}

	private async fetchChildrenNodes(parentElement?: T): Promise<TreeNode[] | undefined> {
		// clear children cache
		this.clearChildren(parentElement);

		const cts = new CancellationTokenSource(this._refreshCancellationSource.token);

		try {
			const parentNode = parentElement ? this.nodes.get(parentElement) : undefined;
			const elements = await this.dataProvider.getChildren(parentElement);
			if (cts.token.isCancellationRequested) {
				return undefined;
			}

			const items = await Promise.all(coalesce(elements || []).map(async element => {
				const item = await this.dataProvider.getTreeItem(element);
				return item && !cts.token.isCancellationRequested ? this.createAndRegisterTreeNode(element, item, parentNode) : null;
			}));
			if (cts.token.isCancellationRequested) {
				return undefined;
			}

			return coalesce(items);
		} finally {
			cts.dispose();
		}
	}

	private _refreshCancellationSource = new CancellationTokenSource();

	private refresh(elements: (T | Root)[]): Promise<void> {
		const hasRoot = elements.some(element => !element);
		if (hasRoot) {
			// Cancel any pending children fetches
			this._refreshCancellationSource.dispose(true);
			this._refreshCancellationSource = new CancellationTokenSource();

			this.clearAll(); // clear cache
			return this.proxy.$refresh(this.viewId);
		} else {
			const handlesToRefresh = this.getHandlesToRefresh(<T[]>elements);
			if (handlesToRefresh.length) {
				return this.refreshHandles(handlesToRefresh);
			}
		}
		return Promise.resolve(undefined);
	}

	// {{SQL CARBON EDIT}}
	protected getHandlesToRefresh(elements: T[]): TreeItemHandle[] {
		const elementsToUpdate = new Set<TreeItemHandle>();
		const elementNodes = elements.map(element => this.nodes.get(element));
		for (const elementNode of elementNodes) {
			if (elementNode && !elementsToUpdate.has(elementNode.item.handle)) {
				// check if an ancestor of extElement is already in the elements list
				let currentNode: TreeNode | undefined = elementNode;
				while (currentNode && currentNode.parent && elementNodes.findIndex(node => currentNode && currentNode.parent && node && node.item.handle === currentNode.parent.item.handle) === -1) {
					const parentElement: T | undefined = this.elements.get(currentNode.parent.item.handle);
					currentNode = parentElement ? this.nodes.get(parentElement) : undefined;
				}
				if (currentNode && !currentNode.parent) {
					elementsToUpdate.add(elementNode.item.handle);
				}
			}
		}

		const handlesToUpdate: TreeItemHandle[] = [];
		// Take only top level elements
		elementsToUpdate.forEach((handle) => {
			const element = this.elements.get(handle);
			if (element) {
				const node = this.nodes.get(element);
				if (node && (!node.parent || !elementsToUpdate.has(node.parent.item.handle))) {
					handlesToUpdate.push(handle);
				}
			}
		});

		return handlesToUpdate;
	}

	// {{SQL CARBON EDIT}}
	protected refreshHandles(itemHandles: TreeItemHandle[]): Promise<void> {
		const itemsToRefresh: { [treeItemHandle: string]: ITreeItem } = {};
		return Promise.all(itemHandles.map(treeItemHandle =>
			this.refreshNode(treeItemHandle)
				.then(node => {
					if (node) {
						itemsToRefresh[treeItemHandle] = node.item;
					}
				})))
			.then(() => Object.keys(itemsToRefresh).length ? this.proxy.$refresh(this.viewId, itemsToRefresh) : undefined);
	}

	// {{SQL CARBON EDIT}}
	protected refreshNode(treeItemHandle: TreeItemHandle): Promise<TreeNode | null> {
		const extElement = this.getExtensionElement(treeItemHandle);
		if (extElement) {
			const existing = this.nodes.get(extElement);
			if (existing) {
				this.clearChildren(extElement); // clear children cache
				return asPromise(() => this.dataProvider.getTreeItem(extElement))
					.then(extTreeItem => {
						if (extTreeItem) {
							const newNode = this.createTreeNode(extElement, extTreeItem, existing.parent);
							this.updateNodeCache(extElement, newNode, existing, existing.parent);
							existing.dispose();
							return newNode;
						}
						return null;
					});
			}
		}
		return Promise.resolve(null);
	}

	private createAndRegisterTreeNode(element: T, extTreeItem: vscode.TreeItem, parentNode: TreeNode | Root): TreeNode {
		const node = this.createTreeNode(element, extTreeItem, parentNode);
		if (extTreeItem.id && this.elements.has(node.item.handle)) {
			throw new Error(localize('treeView.duplicateElement', 'Element with id {0} is already registered', extTreeItem.id));
		}
		this.addNodeToCache(element, node);
		this.addNodeToParentCache(node, parentNode);
		return node;
	}

	private getTooltip(tooltip?: string | vscode.MarkdownString): string | IMarkdownString | undefined {
		if (MarkdownStringType.isMarkdownString(tooltip)) {
			return MarkdownString.from(tooltip);
		}
		return tooltip;
	}

	private getCommand(disposable: DisposableStore, command?: vscode.Command): Command | undefined {
		return command ? this.commands.toInternal(command, disposable) : undefined;
	}

	protected createTreeNode(element: T, extensionTreeItem: azdata.TreeItem, parent: TreeNode | Root): TreeNode { // {{SQL CARBON EDIT}} change to protected, change to azdata.TreeItem
		const disposableStore = new DisposableStore();
		const handle = this.createHandle(element, extensionTreeItem, parent);
		const icon = this.getLightIconPath(extensionTreeItem);
		// {{SQL CARBON EDIT}}
		const item = {
			handle,
			parentHandle: parent ? parent.item.handle : undefined,
			label: toTreeItemLabel(extensionTreeItem.label, this.extension),
			description: extensionTreeItem.description,
			resourceUri: extensionTreeItem.resourceUri,
			tooltip: this.getTooltip(extensionTreeItem.tooltip),
			command: this.getCommand(disposableStore, extensionTreeItem.command),
			contextValue: extensionTreeItem.contextValue,
			icon,
			iconDark: this.getDarkIconPath(extensionTreeItem) || icon,
			themeIcon: this.getThemeIcon(extensionTreeItem),
			collapsibleState: isUndefinedOrNull(extensionTreeItem.collapsibleState) ? TreeItemCollapsibleState.None : extensionTreeItem.collapsibleState,
			accessibilityInformation: extensionTreeItem.accessibilityInformation,
			payload: extensionTreeItem.payload, // {{SQL CARBON EDIT}}
			childProvider: extensionTreeItem.childProvider, // {{SQL CARBON EDIT}}
			type: extensionTreeItem.type // {{SQL CARBON EDIT}}
		};

		return {
			item,
			extensionItem: extensionTreeItem,
			parent,
			children: undefined,
			disposableStore,
			dispose(): void { disposableStore.dispose(); }
		};
	}

	private getThemeIcon(extensionTreeItem: vscode.TreeItem): ThemeIcon | undefined {
		return extensionTreeItem.iconPath instanceof ThemeIcon ? extensionTreeItem.iconPath : undefined;
	}

	private createHandle(element: T, { id, label, resourceUri }: vscode.TreeItem, parent: TreeNode | Root, returnFirst?: boolean): TreeItemHandle {
		if (id) {
			return `${ExtHostTreeView.ID_HANDLE_PREFIX}/${id}`;
		}

		const treeItemLabel = toTreeItemLabel(label, this.extension);
		const prefix: string = parent ? parent.item.handle : ExtHostTreeView.LABEL_HANDLE_PREFIX;
		let elementId = treeItemLabel ? treeItemLabel.label : resourceUri ? basename(resourceUri) : '';
		elementId = elementId.indexOf('/') !== -1 ? elementId.replace('/', '//') : elementId;
		const existingHandle = this.nodes.has(element) ? this.nodes.get(element)!.item.handle : undefined;
		const childrenNodes = (this.getChildrenNodes(parent) || []);

		let handle: TreeItemHandle;
		let counter = 0;
		do {
			handle = `${prefix}/${counter}:${elementId}`;
			if (returnFirst || !this.elements.has(handle) || existingHandle === handle) {
				// Return first if asked for or
				// Return if handle does not exist or
				// Return if handle is being reused
				break;
			}
			counter++;
		} while (counter <= childrenNodes.length);

		return handle;
	}

	private getLightIconPath(extensionTreeItem: vscode.TreeItem): URI | undefined {
		if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof ThemeIcon)) {
			if (typeof extensionTreeItem.iconPath === 'string'
				|| URI.isUri(extensionTreeItem.iconPath)) {
				return this.getIconPath(extensionTreeItem.iconPath);
			}
			return this.getIconPath((<{ light: string | URI; dark: string | URI }>extensionTreeItem.iconPath).light);
		}
		return undefined;
	}

	private getDarkIconPath(extensionTreeItem: vscode.TreeItem): URI | undefined {
		if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof ThemeIcon) && (<{ light: string | URI; dark: string | URI }>extensionTreeItem.iconPath).dark) {
			return this.getIconPath((<{ light: string | URI; dark: string | URI }>extensionTreeItem.iconPath).dark);
		}
		return undefined;
	}

	private getIconPath(iconPath: string | URI): URI {
		if (URI.isUri(iconPath)) {
			return iconPath;
		}
		return URI.file(iconPath);
	}

	private addNodeToCache(element: T, node: TreeNode): void {
		this.elements.set(node.item.handle, element);
		this.nodes.set(element, node);
	}

	// {{SQL CARBON EDIT}}
	protected updateNodeCache(element: T, newNode: TreeNode, existing: TreeNode, parentNode: TreeNode | Root): void {
		// Remove from the cache
		this.elements.delete(newNode.item.handle);
		this.nodes.delete(element);
		if (newNode.item.handle !== existing.item.handle) {
			this.elements.delete(existing.item.handle);
		}

		// Add the new node to the cache
		this.addNodeToCache(element, newNode);

		// Replace the node in parent's children nodes
		const childrenNodes = (this.getChildrenNodes(parentNode) || []);
		const childNode = childrenNodes.filter(c => c.item.handle === existing.item.handle)[0];
		if (childNode) {
			childrenNodes.splice(childrenNodes.indexOf(childNode), 1, newNode);
		}
	}

	private addNodeToParentCache(node: TreeNode, parentNode: TreeNode | Root): void {
		if (parentNode) {
			if (!parentNode.children) {
				parentNode.children = [];
			}
			parentNode.children.push(node);
		} else {
			if (!this.roots) {
				this.roots = [];
			}
			this.roots.push(node);
		}
	}

	private clearChildren(parentElement?: T): void {
		if (parentElement) {
			const node = this.nodes.get(parentElement);
			if (node) {
				if (node.children) {
					for (const child of node.children) {
						const childElement = this.elements.get(child.item.handle);
						if (childElement) {
							this.clear(childElement);
						}
					}
				}
				node.children = undefined;
			}
		} else {
			this.clearAll();
		}
	}

	private clear(element: T): void {
		const node = this.nodes.get(element);
		if (node) {
			if (node.children) {
				for (const child of node.children) {
					const childElement = this.elements.get(child.item.handle);
					if (childElement) {
						this.clear(childElement);
					}
				}
			}
			this.nodes.delete(element);
			this.elements.delete(node.item.handle);
			node.dispose();
		}
	}

	protected clearAll(): void { // {{SQL CARBON EDIT}}
		this.roots = undefined;
		this.elements.clear();
		this.nodes.forEach(node => node.dispose());
		this.nodes.clear();
	}

	override dispose() {
		this._refreshCancellationSource.dispose();

		this.clearAll();
	}
}
