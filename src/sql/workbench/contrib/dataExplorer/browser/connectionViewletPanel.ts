/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionViewletPanel';
import * as DOM from 'vs/base/browser/dom';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ServerTreeView } from 'sql/workbench/contrib/objectExplorer/browser/serverTreeView';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPane';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

export class ConnectionViewletPanel extends ViewPane {

	public static readonly ID = 'dataExplorer.servers';

	private _root?: HTMLElement;
	private _serverTreeView: ServerTreeView;

	constructor(
		private options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ILogService private readonly logService: ILogService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super({ ...(options as IViewPaneOptions) }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
		this._serverTreeView = this.objectExplorerService.getServerTreeView() as ServerTreeView;
		if (!this._serverTreeView) {
			this._serverTreeView = this.instantiationService.createInstance(ServerTreeView);
			this.objectExplorerService.registerServerTreeView(this._serverTreeView);
		}
	}

	protected override renderHeader(container: HTMLElement): void {
		super.renderHeader(container);
	}

	override renderHeaderTitle(container: HTMLElement): void {
		super.renderHeaderTitle(container, this.options.title);
	}

	override renderBody(container: HTMLElement): void {
		const viewletContainer = DOM.append(container, DOM.$('div.server-explorer-viewlet'));
		const viewContainer = DOM.append(viewletContainer, DOM.$('div.object-explorer-view'));
		this._serverTreeView.renderBody(viewContainer).then(undefined, error => {
			this.logService.warn('render registered servers: ' + error);
		});
		this._root = container;
	}

	get serversTree(): ITree | AsyncServerTree {
		return this._serverTreeView.tree;
	}

	override layoutBody(size: number): void {
		this._serverTreeView.layout(size);
		this._root!.classList.toggle('narrow', this._root!.clientWidth < 300);
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

	public clearSearch() {
		this._serverTreeView.refreshTree();
	}

	public search(value: string): void {
		if (value) {
			this._serverTreeView.searchTree(value);
		} else {
			this.clearSearch();
		}
	}

	override dispose(): void {
		super.dispose();
	}

	override focus(): void {
		super.focus();
		this._serverTreeView.tree.domFocus();
	}
}
