/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IAction } from 'vs/base/common/actions';
import { append, $, addClass, toggleClass, Dimension, getTotalHeight } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation, IViewDescriptorService } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ShowViewletAction, Viewlet } from 'vs/workbench/browser/viewlet';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { ViewPaneContainer, ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { NotebookSearchWidget, INotebookExplorerSearchOptions } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookSearchWidget';

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

export class NotebookExplorerViewletViewsContribution implements IWorkbenchContribution {

	constructor() {
		this.registerViews();
	}

	private registerViews(): void {
		let viewDescriptors = [];
		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, NOTEBOOK_VIEW_CONTAINER);
	}
}

export class NotebookExplorerViewlet extends Viewlet {
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IStorageService protected storageService: IStorageService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService protected contextMenuService: IContextMenuService,
		@IExtensionService protected extensionService: IExtensionService,
		@IWorkspaceContextService protected contextService: IWorkspaceContextService,
		@IWorkbenchLayoutService protected layoutService: IWorkbenchLayoutService,
		@IConfigurationService protected configurationService: IConfigurationService
	) {
		super(VIEWLET_ID, instantiationService.createInstance(NotebookExplorerViewPaneContainer), telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService, layoutService, configurationService);
	}
}

export class NotebookExplorerViewPaneContainer extends ViewPaneContainer {
	private root: HTMLElement;
	private notebookSourcesBox: HTMLElement;
	private searchWidgetsContainerElement!: HTMLElement;
	searchWidget!: NotebookSearchWidget;

	constructor(
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
	) {
		super(VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService);
	}

	create(parent: HTMLElement): void {
		addClass(parent, 'notebookExplorer-viewlet');
		this.root = parent;

		this.searchWidgetsContainerElement = append(this.root, $('.header'));
		this.createSearchWidget(this.searchWidgetsContainerElement);

		this.notebookSourcesBox = append(this.root, $('.notebookSources'));

		return super.create(this.notebookSourcesBox);
	}

	private createSearchWidget(container: HTMLElement): void {
		this.searchWidget = this._register(this.instantiationService.createInstance(NotebookSearchWidget, container, <INotebookExplorerSearchOptions>{
			value: '',
			replaceValue: undefined,
			isRegex: false,
			isCaseSensitive: false,
			isWholeWords: false,
			searchHistory: [],
			replaceHistory: [],
			preserveCase: false,
			showSearchResultsPane: true,
		}, this, VIEWLET_ID));
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
		let menu = this.menuService.createMenu(MenuId.NotebookTitle, this.contextKeyService);
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

export const NOTEBOOK_VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: VIEWLET_ID,
	name: localize('notebookExplorer.name', "Notebooks"),
	ctorDescriptor: new SyncDescriptor(NotebookExplorerViewPaneContainer),
	icon: 'book',
	order: 6,
	storageId: `${VIEWLET_ID}.state`
}, ViewContainerLocation.Sidebar);
