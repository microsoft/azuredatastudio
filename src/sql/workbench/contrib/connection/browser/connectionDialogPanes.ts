/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITreeItem, ITreeView } from 'sql/workbench/common/views';
import { IViewsRegistry, Extensions, ITreeViewDescriptor, ITreeViewDataProvider, TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TreeView } from 'sql/workbench/contrib/views/browser/treeView';
import { localize } from 'vs/nls';
import { VIEW_CONTAINER } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { TreeViewPane } from 'vs/workbench/browser/parts/views/treeView';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { Event } from 'vs/base/common/event';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { TreeCreationUtils } from 'sql/workbench/services/objectExplorer/browser/treeCreationUtils';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);

abstract class ViewContribution implements IWorkbenchContribution {
	constructor(@IInstantiationService protected readonly instantiationService: IInstantiationService) {
		this.registerView();
	}

	protected abstract registerView(): void;
}

class RecentConnectionsDataProvider implements ITreeViewDataProvider {

	constructor(@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService) { }

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		if (element) {
			return [];
		} else {
			return this.connectionManagementService.getRecentConnections().map(c => {
				return {
					handle: c.id,
					label: { label: c.title },
					collapsibleState: TreeItemCollapsibleState.None,
					payload: c.toIConnectionProfile()
				};
			});
		}
	}
}

export class RecentConnectionsViewContribution extends ViewContribution {
	protected registerView() {
		const id = 'recentConnections';
		const name = localize('workbench.dialog.connection.recentConnections', "Recent Connections");
		const treeView = this.instantiationService.createInstance(TreeView, id, name);
		treeView.dataProvider = this.instantiationService.createInstance(RecentConnectionsDataProvider);
		viewsRegistry.registerViews([<ITreeViewDescriptor>{
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			id,
			name,
			canMoveView: false,
			treeView,

		}], VIEW_CONTAINER);
	}
}

export class SavedConnectionsViewContribution extends ViewContribution {
	protected registerView() {
		const id = 'savedConnections';
		const name = localize('workbench.dialog.connection.savedConnections', "Saved Connections");
		const treeView = this.instantiationService.createInstance(SavedConnectionsTree, name);
		viewsRegistry.registerViews([<ITreeViewDescriptor>{
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			id,
			name,
			canMoveView: false,
			treeView
		}], VIEW_CONTAINER);
	}
}

class SavedConnectionsTree extends Disposable implements ITreeView {

	private readonly tree: ITree;
	private readonly domNode = DOM.$('div');

	onDidExpandItem: Event<ITreeItem> = Event.None;
	onDidCollapseItem: Event<ITreeItem> = Event.None;
	onDidChangeVisibility: Event<boolean> = Event.None;
	onDidChangeActions: Event<void> = Event.None;
	onDidChangeTitle: Event<string> = Event.None;
	onDidChangeWelcomeState: Event<void> = Event.None;
	onDidChangeSelection: Event<ITreeItem[]>;

	constructor(
		public readonly title: string,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();
		this.tree = this._register(TreeCreationUtils.createConnectionTree(this.domNode, instantiationService));
		this.onDidChangeSelection = Event.map(this.tree.onDidChangeSelection, ({ selection }): ITreeItem[] => {
			const connectionProfileSelection = selection as Array<ConnectionProfile | ConnectionProfileGroup>;
			return connectionProfileSelection.map(p => {
				return {
					collapsibleState: TreeItemCollapsibleState.None,
					handle: p.id,
					payload: p instanceof ConnectionProfile ? p.toIConnectionProfile() : undefined
				};
			});
		});
		void TreeUpdateUtils.structuralTreeUpdate(this.tree, 'saved', connectionManagementService);
	}

	collapse(element: ITreeItem): boolean {
		return true;
	}

	dataProvider: ITreeViewDataProvider;
	showCollapseAllAction: boolean;
	canSelectMany: boolean;
	visible: boolean;

	refresh(treeItems?: ITreeItem[]): Promise<void> {
		return this.tree.refresh();
	}

	setVisibility(visible: boolean): void {
	}

	focus(): void {
		this.tree.domFocus();
	}

	layout(height: number, width: number): void {
		this.domNode.style.height = height + 'px';
		this.domNode.style.width = width + 'px';
		this.tree.layout(height);
	}

	getOptimalWidth(): number {
		return 0;
	}

	async reveal(item: ITreeItem): Promise<void> {
		return;
	}

	async expand(itemOrItems: ITreeItem | ITreeItem[]): Promise<void> {
		return;
	}

	setSelection(items: ITreeItem[]): void {

	}

	setFocus(item: ITreeItem): void {

	}

	show(container: HTMLElement): void {
		DOM.append(container, this.domNode);
	}
}
