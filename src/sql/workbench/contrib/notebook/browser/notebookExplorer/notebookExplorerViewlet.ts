/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Extensions as ViewContainerExtensions, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation, ViewContainer, IViewDescriptorService, IViewDescriptor } from 'vs/workbench/common/views';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { MenuId, IMenuService } from 'vs/platform/actions/common/actions';
import { ShowViewletAction } from 'vs/workbench/browser/viewlet';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Disposable } from 'vs/base/common/lifecycle';
import { ViewPaneContainer, ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ISearchWidgetService } from 'sql/workbench/contrib/searchWidget/browser/searchWidgetService';
import { addClass, $, append, Dimension, toggleClass, getTotalHeight } from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';

export const VIEWLET_ID = 'workbench.view.notebooks';

// Viewlet Action
export class OpenNotebookExplorerViewletAction extends ShowViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = localize('showNotebookExplorer', "Show Notebooks");

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
	) {
		super(id, label, VIEWLET_ID, viewletService, editorGroupService, layoutService);
	}
}

export class NotebookExplorerViewletViewsContribution extends Disposable implements IWorkbenchContribution {

	constructor() {
		super();
		this.registerViews();
	}

	private registerViews(): void {
		const container = NotebookExplorerViewletViewsContribution.registerViewContainer();
		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([], container);
	}

	static registerViewContainer(): ViewContainer {
		let options: ISearchViewPaneOptions = {
			VIEWLET_ID: VIEWLET_ID,
			actionsMenuId: MenuId.NotebookTitle,
			showSearchResultsPane: true,
			onSearchSubmit: undefined,
			onSearchCancel: undefined
		};
		let container = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
			id: VIEWLET_ID,
			name: localize('notebookExplorer.name', "Notebooks"),
			ctorDescriptor: new SyncDescriptor(SearchViewPaneContainer, [options]),
			icon: 'book',
			order: 6,
			storageId: `${VIEWLET_ID}.state`
		}, ViewContainerLocation.Sidebar);
		return container;
	}
}

export interface ISearchViewPaneOptions {
	VIEWLET_ID: string;
	actionsMenuId: MenuId;
	showSearchResultsPane: boolean;
	onSearchSubmit(options: any): void;
	onSearchCancel({ focus: boolean }): void;
}

export class SearchViewPaneContainer extends ViewPaneContainer {
	private root: HTMLElement;
	private notebookSourcesBox: HTMLElement;
	private searchWidgetsContainerElement!: HTMLElement;

	constructor(
		private params: ISearchViewPaneOptions,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@ISearchWidgetService private searchWidgetSerivce: ISearchWidgetService
	) {
		super(params.VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService);
	}

	create(parent: HTMLElement): void {
		addClass(parent, 'notebookExplorer-viewlet');
		this.root = parent;

		this.searchWidgetsContainerElement = append(this.root, $('.header'));
		this.searchWidgetSerivce.createSearchWidget(this.searchWidgetsContainerElement, this, this.params);

		this.notebookSourcesBox = append(this.root, $('.notebookSources'));

		return super.create(this.notebookSourcesBox);
	}

	public updateStyles(): void {
		super.updateStyles();
	}

	focus(): void {
		super.focus();
	}

	layout(dimension: Dimension): void {
		toggleClass(this.root, 'narrow', dimension.width <= 300);
		super.layout(new Dimension(dimension.width, dimension.height - getTotalHeight(this.searchWidgetsContainerElement)));
	}

	getOptimalWidth(): number {
		return 400;
	}

	getSecondaryActions(): IAction[] {
		let menu = this.menuService.createMenu(this.params.actionsMenuId, this.contextKeyService);
		let actions = [];
		menu.getActions({}).forEach(group => {
			if (group[0] === 'secondary') {
				actions.push(...group[1]);
			}
		});
		menu.dispose();
		return actions;
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewPane {
		let viewletPanel = this.instantiationService.createInstance(viewDescriptor.ctorDescriptor.ctor, options) as ViewPane;
		this._register(viewletPanel);
		return viewletPanel;
	}
}


