/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IExtensionTipsService, IExtensionManagementServerService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionsWorkbenchService } from 'vs/workbench/parts/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { Builder } from 'sql/base/browser/builder';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { IAction } from 'vs/base/common/actions';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { ClearSearchAction, ActiveConnectionsFilterAction,
	AddServerAction, AddServerGroupAction } from 'sql/parts/objectExplorer/viewlet/connectionTreeAction';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';

export class ConnectionViewletPanel extends ViewletPanel {

	private _root: HTMLElement;
	private _searchBox: InputBox;
	private _toDisposeViewlet: IDisposable[] = [];
	private _serverTreeView: ServerTreeView;
	private _clearSearchAction: ClearSearchAction;
	private _addServerAction: IAction;
	private _addServerGroupAction: IAction;
	private _activeConnectionsFilterAction: ActiveConnectionsFilterAction;

	constructor(
		private options: IViewletViewOptions,
		@INotificationService protected notificationService: INotificationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService private themeService: IThemeService,
		@IExtensionsWorkbenchService protected extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IExtensionTipsService protected tipsService: IExtensionTipsService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService protected contextService: IWorkspaceContextService,
		@IExtensionManagementServerService protected extensionManagementServerService: IExtensionManagementServerService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService
	) {
		super({ ...(options as IViewletPanelOptions), ariaHeaderLabel: options.title }, keybindingService, contextMenuService, configurationService);
		this._clearSearchAction = this.instantiationService.createInstance(ClearSearchAction, ClearSearchAction.ID, ClearSearchAction.LABEL, this);
		this._addServerAction = this.instantiationService.createInstance(AddServerAction,
			AddServerAction.ID,
			AddServerAction.LABEL);
		this._addServerGroupAction = this.instantiationService.createInstance(AddServerGroupAction,
			AddServerGroupAction.ID,
			AddServerGroupAction.LABEL);
		this._serverTreeView = this.instantiationService.createInstance(ServerTreeView);
		this._activeConnectionsFilterAction = this._serverTreeView.activeConnectionsFilterAction;

		this.objectExplorerService.registerServerTreeView(this._serverTreeView);
	}

	protected renderHeader(container: HTMLElement): void {
		super.renderHeader(container);
	}

	renderHeaderTitle(container: HTMLElement): void {
		super.renderHeaderTitle(container, this.options.title);
	}

	renderBody(container: HTMLElement): void {
		let parentBuilder = new Builder(container);
		parentBuilder.div({ class: 'server-explorer-viewlet' }, (viewletContainer) => {
			viewletContainer.div({ class: 'search-box' }, (searchBoxContainer) => {
				let searchServerString = localize('Search server names', 'Search server names');
				this._searchBox = new InputBox(
					searchBoxContainer.getHTMLElement(),
					null,
					{
						placeholder: searchServerString,
						actions: [this._clearSearchAction],
						ariaLabel: searchServerString
					}
				);

				this._searchBox.onDidChange(() => {
					this.search(this._searchBox.value);
				});

				// Theme styler
				this._toDisposeViewlet.push(attachInputBoxStyler(this._searchBox, this.themeService));

			});
			viewletContainer.div({ Class: 'object-explorer-view' }, (viewContainer) => {
				this._serverTreeView.renderBody(viewContainer.getHTMLElement()).then(() => {
					Promise.resolve(null);
				}, error => {
					console.warn('render registered servers: ' + error);
					Promise.resolve(null);
				});
			});
		});
		this._root = container;
	}

	layoutBody(size: number): void {
		this._searchBox.layout();
		this._serverTreeView.layout(size - 46); // account for search box and horizontal scroll bar
		DOM.toggleClass(this._root, 'narrow', this._root.clientWidth < 300);
	}

	show(): void {
	}

	select(): void {
	}

	showPrevious(): void {
	}

	showPreviousPage(): void {
	}

	showNext(): void {
	}

	showNextPage(): void {
	}

	count(): number {
		return 0;
	}

	public getActions(): IAction[] {
		return [
			this._addServerAction,
			this._addServerGroupAction,
			this._activeConnectionsFilterAction
		];
	}

	public clearSearch() {
		this._serverTreeView.refreshTree();
		this._searchBox.value = '';
		this._clearSearchAction.enabled = false;
		this._searchBox.focus();
	}

	public search(value: string): void {
		if (value) {
			this._clearSearchAction.enabled = true;
			this._serverTreeView.searchTree(value);
		} else {
			this.clearSearch();
		}
	}

	dispose(): void {
		this._serverTreeView.dispose();
		super.dispose();
		this.disposables = dispose(this.disposables);
	}

	focus(): void {
		super.focus();
	}
}
