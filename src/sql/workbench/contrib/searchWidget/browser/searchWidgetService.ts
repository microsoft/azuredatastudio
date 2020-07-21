/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { ISearchViewPaneOptions } from 'sql/workbench/browser/parts/views/viewPaneContainer';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService, createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { SimpleSearchWidget, IViewExplorerSearchOptions } from 'sql/workbench/contrib/searchWidget/browser/simpleSearchWidget';

export const ISearchWidgetService = createDecorator<ISearchWidgetService>('searchWidgetService');

export interface ISearchWidgetService {
	createSearchWidget(container: HTMLElement, pane: ViewPaneContainer, params: ISearchViewPaneOptions): void;
}
export class SearchWidgetService extends Disposable implements ISearchWidgetService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		super();
	}
	createSearchWidget(container: HTMLElement, pane: ViewPaneContainer, params: ISearchViewPaneOptions): void {
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

		if (params.onSearchSubmit) {
			searchWidget.onSearchSubmit(options => params.onSearchSubmit(options));

			searchWidget.searchInput.onDidOptionChange((options) => params.onSearchSubmit(options));
		}

		if (params.onSearchCancel) {
			searchWidget.onSearchCancel((focus) => params.onSearchCancel(focus));
		}
	}
}
