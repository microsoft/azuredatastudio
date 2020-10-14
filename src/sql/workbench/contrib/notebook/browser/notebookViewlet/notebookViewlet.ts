/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IAction } from 'vs/base/common/actions';
import { append, $, addClass, toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry, IViewDescriptorService } from 'vs/workbench/common/views';
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
//import { TreeViewPane } from 'vs/workbench/browser/parts/views/treeView';
import { NOTEBOOK_VIEW_CONTAINER } from '../notebookExplorer/notebookExplorerViewlet';

export const VIEWLET_ID = 'workbench.view.notebooks';
// Viewlet Action
export class OpenNotebookViewletAction extends ShowViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = localize('showNotebookViewlet', "Notebook Tree");

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

export class NotebookViewletViewsContribution implements IWorkbenchContribution {

	constructor() {
		this.registerViews();
	}

	private registerViews(): void {
		let viewDescriptors = [];
		viewDescriptors.push(this.createNotebookViewDescriptor());
		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, NOTEBOOK_VIEW_CONTAINER);
	}

	createNotebookViewDescriptor(): IViewDescriptor {
		return {
			id: VIEWLET_ID,
			name: localize('notebookViewlet.notebooks', "Notebooks WUUUU"),
			ctorDescriptor: new SyncDescriptor(NotebookViewPaneContainer),
			weight: 100,
			canToggleVisibility: true,
			order: 2
		};
	}
}

export class NotebookViewlet extends Viewlet {
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
		super(VIEWLET_ID, instantiationService.createInstance(NotebookViewPaneContainer), telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService, layoutService, configurationService);
	}
}

export class NotebookViewPaneContainer extends ViewPaneContainer {
	private root: HTMLElement;
	private notebookViewletBox?: HTMLElement;

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
		addClass(parent, 'notebook-viewlet');
		this.root = parent;

		this.notebookViewletBox = append(this.root, $('.notebookViewletSources'));

		return super.create(this.notebookViewletBox);
	}


	// async refreshTree(event?: IChangeEvent): Promise<void> {
	// 	await this.searchView.refreshTree(event);
	// }

	public updateStyles(): void {
		super.updateStyles();
	}

	focus(): void {
	}

	layout(dimension: Dimension): void {
		toggleClass(this.root, 'narrow', dimension.width <= 300);
		super.layout(new Dimension(dimension.width, 400));
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
