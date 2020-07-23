/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Extensions as ViewContainerExtensions, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation, ViewContainer } from 'vs/workbench/common/views';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { MenuId } from 'vs/platform/actions/common/actions';
import { ShowViewletAction } from 'vs/workbench/browser/viewlet';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Disposable } from 'vs/base/common/lifecycle';
import { ISearchViewPaneOptions } from 'sql/workbench/contrib/searchViewPane/browser/searchWidget/searchWidgetService';
import { SearchViewPaneContainer } from 'sql/workbench/contrib/searchViewPane/browser/searchViewPaneContainer';


export const NOTEBOOK_VIEWLET_ID = 'workbench.view.notebooks';

// Viewlet Action
export class OpenNotebookExplorerViewletAction extends ShowViewletAction {
	public static ID = NOTEBOOK_VIEWLET_ID;
	public static LABEL = localize('showNotebookExplorer', "Show Notebooks");

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
	) {
		super(id, label, NOTEBOOK_VIEWLET_ID, viewletService, editorGroupService, layoutService);
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
			VIEWLET_ID: NOTEBOOK_VIEWLET_ID,
			actionsMenuId: MenuId.NotebookTitle,
			showSearchResultsPane: true,
			onSearchSubmit: undefined,
			onSearchCancel: undefined
		};
		let container = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
			id: NOTEBOOK_VIEWLET_ID,
			name: localize('notebookExplorer.name', "Notebooks"),
			ctorDescriptor: new SyncDescriptor(SearchViewPaneContainer, [options]),
			icon: 'book',
			order: 6,
			storageId: `${NOTEBOOK_VIEWLET_ID}.state`
		}, ViewContainerLocation.Sidebar);
		return container;
	}
}


