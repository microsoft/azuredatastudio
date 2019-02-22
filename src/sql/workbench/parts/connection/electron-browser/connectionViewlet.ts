/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/connectionViewlet';
import * as DOM from 'vs/base/browser/dom';
import { TPromise } from 'vs/base/common/winjs.base';
import { Builder } from 'sql/base/browser/builder';
import { Viewlet } from 'vs/workbench/browser/viewlet';
import { IAction } from 'vs/base/common/actions';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import Severity from 'vs/base/common/severity';
import { VIEWLET_ID } from 'sql/platform/connection/common/connectionManagement';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ClearSearchAction, AddServerAction, AddServerGroupAction, ActiveConnectionsFilterAction } from 'sql/parts/objectExplorer/viewlet/connectionTreeAction';
import { warn } from 'sql/base/common/log';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IConnectionsViewlet } from 'sql/workbench/parts/connection/common/connectionViewlet';

export class ConnectionViewlet extends Viewlet implements IConnectionsViewlet {

	private _root: HTMLElement;
	private _searchBox: InputBox;
	private _toDisposeViewlet: IDisposable[] = [];
	private _serverTreeView: ServerTreeView;
	private _clearSearchAction: ClearSearchAction;
	private _addServerAction: IAction;
	private _addServerGroupAction: IAction;
	private _activeConnectionsFilterAction: ActiveConnectionsFilterAction;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@INotificationService private _notificationService: INotificationService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService,
		@IPartService partService: IPartService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService
	) {

		super(VIEWLET_ID, configurationService, partService, telemetryService, _themeService, storageService);

		this._clearSearchAction = this._instantiationService.createInstance(ClearSearchAction, ClearSearchAction.ID, ClearSearchAction.LABEL, this);
		this._addServerAction = this._instantiationService.createInstance(AddServerAction,
			AddServerAction.ID,
			AddServerAction.LABEL);
		this._addServerGroupAction = this._instantiationService.createInstance(AddServerGroupAction,
			AddServerGroupAction.ID,
			AddServerGroupAction.LABEL);
		this._serverTreeView = this._instantiationService.createInstance(ServerTreeView);
		this._activeConnectionsFilterAction = this._serverTreeView.activeConnectionsFilterAction;
		this.objectExplorerService.registerServerTreeView(this._serverTreeView);
	}

	private onError(err: any): void {
		if (isPromiseCanceledError(err)) {
			return;
		}
		this._notificationService.notify({
			severity: Severity.Error,
			message: err
		});
	}

	public create(parent: HTMLElement): TPromise<void> {
		return new TPromise<void>((resolve) => {
			super.create(parent);
			this._root = parent;
			let parentBuilder = new Builder(parent);
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
					this._toDisposeViewlet.push(attachInputBoxStyler(this._searchBox, this._themeService));

				});
				viewletContainer.div({ Class: 'object-explorer-view' }, (viewContainer) => {
					this._serverTreeView.renderBody(viewContainer.getHTMLElement()).then(() => {
						resolve(null);
					}, error => {
						warn('render registered servers: ' + error);
						resolve(null);
					});
				});
			});
		});
	}

	public search(value: string): void {
		if (value) {
			this._clearSearchAction.enabled = true;
			this._serverTreeView.searchTree(value);
		} else {
			this.clearSearch();
		}
	}

	public setVisible(visible: boolean): void {
		super.setVisible(visible);
		this._serverTreeView.setVisible(visible);
	}

	/**
	 * Return actions for the viewlet
	 */
	public getActions(): IAction[] {
		return [this._addServerAction, this._addServerGroupAction, this._activeConnectionsFilterAction];
	}

	public focus(): void {
		super.focus();
	}

	public layout({ height, width }: DOM.Dimension): void {
		this._searchBox.layout();
		this._serverTreeView.layout(height - 36); // account for search box
		DOM.toggleClass(this._root, 'narrow', width <= 350);
	}

	public getOptimalWidth(): number {
		return 400;
	}

	public clearSearch() {
		this._serverTreeView.refreshTree();
		this._searchBox.value = '';
		this._clearSearchAction.enabled = false;
		this._searchBox.focus();
	}

	public dispose(): void {
		this._serverTreeView.dispose();
		this._toDisposeViewlet = dispose(this._toDisposeViewlet);
	}

}
