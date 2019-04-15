/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionViewlet';
import * as DOM from 'vs/base/browser/dom';
import { Viewlet } from 'vs/workbench/browser/viewlet';
import { IAction } from 'vs/base/common/actions';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { VIEWLET_ID } from 'sql/platform/connection/common/connectionManagement';
import { ServerTreeView } from 'sql/parts/objectExplorer/viewlet/serverTreeView';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { AddServerAction, AddServerGroupAction, ActiveConnectionsFilterAction } from 'sql/parts/objectExplorer/viewlet/connectionTreeAction';
import { warn } from 'sql/base/common/log';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';

export class ConnectionViewlet extends Viewlet {

	private _root: HTMLElement;
	private _toDisposeViewlet: IDisposable[] = [];
	private _serverTreeView: ServerTreeView;
	private _addServerAction: IAction;
	private _addServerGroupAction: IAction;
	private _activeConnectionsFilterAction: ActiveConnectionsFilterAction;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService
	) {

		super(VIEWLET_ID, configurationService, layoutService, telemetryService, themeService, storageService);

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

	public create(parent: HTMLElement): void {
		super.create(parent);
		this._root = parent;
		const viewletContainer = DOM.append(parent, DOM.$('div.server-explorer-viewlet'));
		const viewContainer = DOM.append(viewletContainer, DOM.$('div.object-explorer-view'));
		this._serverTreeView.renderBody(viewContainer).then(undefined, error => {
			warn('render registered servers: ' + error);
		});
	}

	public search(value: string): void {
		if (value) {
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
		this._serverTreeView.layout(height - 36); // account for search box
		DOM.toggleClass(this._root, 'narrow', width <= 350);
	}

	public getOptimalWidth(): number {
		return 400;
	}

	public clearSearch() {
		this._serverTreeView.refreshTree();
	}

	public dispose(): void {
		this._serverTreeView.dispose();
		this._toDisposeViewlet = dispose(this._toDisposeViewlet);
	}

}
