/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService, createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Extensions as ViewContainerExtensions, IViewsRegistry, IViewDescriptorService } from 'vs/workbench/common/views';
import { NotebookSearchResultsView } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/searchResultsViewPane';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { MenuId } from 'vs/platform/actions/common/actions';
import { SimpleSearchWidget, IViewExplorerSearchOptions } from 'sql/workbench/contrib/searchViewPane/browser/searchWidget/simpleSearchWidget';

export const ISearchWidgetService = createDecorator<ISearchWidgetService>('searchWidgetService');

export interface ISearchViewPaneOptions {
	VIEWLET_ID: string;
	actionsMenuId: MenuId;
	showSearchResultsPane: boolean;
	onSearchSubmit(options: any): void;
	onSearchCancel({ focus: boolean }): void;
}
export interface ISearchWidgetService {
	searchWidgets: Map<string, any>;
	registerSearchWidget(container: HTMLElement, pane: ViewPaneContainer, params: ISearchViewPaneOptions): void;
	getSearchWidget(VIEWLET_ID: string): any | undefined;
	getSearchResultsView(parentConatiner: ViewPaneContainer): any | undefined;
}
export class SearchWidgetService extends Disposable implements ISearchWidgetService {

	declare readonly _serviceBrand: undefined;
	searchWidgets: Map<string, any>;
	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IViewDescriptorService protected viewDescriptorService: IViewDescriptorService,
	) {
		super();
		this.searchWidgets = new Map<string, any>();
	}

	getSearchWidget(VIEWLET_ID: string): any | undefined {
		return this.searchWidgets.get(VIEWLET_ID);
	}

	registerSearchWidget(container: HTMLElement, pane: ViewPaneContainer, params: ISearchViewPaneOptions): void {
		if (!this.searchWidgets.get(params.VIEWLET_ID)) {
			let searchWidget = this._register(this._instantiationService.createInstance(SimpleSearchWidget, container, <IViewExplorerSearchOptions>{
				value: '',
				replaceValue: undefined,
				isRegex: false,
				isCaseSensitive: false,
				isWholeWords: false,
				searchHistory: [],
				replaceHistory: [],
				preserveCase: false,
				showSearchResultsPane: params.showSearchResultsPane,
			}, pane, params.VIEWLET_ID));

			this.searchWidgets.set(params.VIEWLET_ID, searchWidget);
			if (params.showSearchResultsPane) {
				this.registerNotebookSerachResultsView(params);

				//register search results view specific stuff.
				if (searchWidget.searchView) {
					this._register(searchWidget.onDidHeightChange(() => searchWidget.searchView?.reLayout()));

					this._register(searchWidget.onPreserveCaseChange(async (state) => {
						if (searchWidget.searchView?.searchViewModel) {
							searchWidget.searchView.searchViewModel.preserveCase = state;
							await searchWidget.searchView.refreshTree();
						}
					}));

					this._register(searchWidget.searchInput.onInput(() => searchWidget.searchView?.updateActions()));
				}
			}

			if (params.onSearchSubmit) {
				searchWidget.onSearchSubmit(options => params.onSearchSubmit(options));

				searchWidget.searchInput.onDidOptionChange((options) => params.onSearchSubmit(options));
			}

			if (params.onSearchCancel) {
				searchWidget.onSearchCancel((focus) => params.onSearchCancel(focus));
			}
		}
	}

	registerNotebookSerachResultsView(params: ISearchViewPaneOptions) {
		let viewDescriptors = [{
			id: NotebookSearchResultsView.ID,
			name: localize('notebookExplorer.searchResults', "Search Results"),
			ctorDescriptor: new SyncDescriptor(NotebookSearchResultsView),
			weight: 100,
			canToggleVisibility: true,
			hideByDefault: false,
			order: 0,
			collapsed: true
		}];
		const container = this.viewDescriptorService.getViewContainerById(params.VIEWLET_ID);
		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, container);
	}

	getSearchResultsView(parentConatiner: ViewPaneContainer): any {
		switch (parentConatiner.getId()) {
			case 'workbench.view.notebooks': return <NotebookSearchResultsView>parentConatiner.getView(NotebookSearchResultsView.ID);
			default: return undefined;
		}
	}
}
