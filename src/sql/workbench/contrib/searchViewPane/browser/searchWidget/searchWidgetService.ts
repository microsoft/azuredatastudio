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
import { IConfigurationRegistry, Extensions as ConfigExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { isMacintosh } from 'vs/base/common/platform';
import { SearchSortOrder } from 'vs/workbench/services/search/common/search';

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
	searchResultsView: Map<string, any>;
	registerSearchWidget(container: HTMLElement, pane: ViewPaneContainer, params: ISearchViewPaneOptions): void;
	getSearchWidget(VIEWLET_ID: string): any | undefined;
	getSearchResultsViewID(parentConatiner: ViewPaneContainer): string | undefined;
}
export class SearchWidgetService extends Disposable implements ISearchWidgetService {

	declare readonly _serviceBrand: undefined;
	searchWidgets: Map<string, any>;
	searchResultsView: Map<string, any>;
	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IViewDescriptorService protected viewDescriptorService: IViewDescriptorService,
	) {
		super();
		this.searchWidgets = new Map<string, any>();
		this.searchResultsView = new Map<string, any>();
	}

	getSearchWidget(VIEWLET_ID: string): any | undefined {
		return this.searchWidgets.get(VIEWLET_ID);
	}

	registerSearchWidget(container: HTMLElement, pane: ViewPaneContainer, params: ISearchViewPaneOptions): void {
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
		}, pane, this.getSearchResultsViewID(pane)));

		if (!this.searchWidgets.get(params.VIEWLET_ID)) {
			this.searchWidgets.set(params.VIEWLET_ID, searchWidget);
		}

		if (params.showSearchResultsPane) {
			this.registerSearchResultsView(params);
		}

		if (params.onSearchSubmit) {
			searchWidget.onSearchSubmit(options => params.onSearchSubmit(options));

			searchWidget.searchInput.onDidOptionChange((options) => params.onSearchSubmit(options));
		}

		if (params.onSearchCancel) {
			searchWidget.onSearchCancel((focus) => params.onSearchCancel(focus));
		}
	}

	registerSearchResultsView(params: ISearchViewPaneOptions): void {
		const container = this.viewDescriptorService.getViewContainerById(params.VIEWLET_ID);
		let viewDescriptors = [];
		switch (params.VIEWLET_ID) {
			case 'workbench.view.notebooks':
				let searchResultsView = new SyncDescriptor(NotebookSearchResultsView);
				viewDescriptors.push({
					id: NotebookSearchResultsView.ID,
					name: localize('notebookExplorer.searchResultsTitle', "Search Results"),
					ctorDescriptor: searchResultsView,
					weight: 100,
					canToggleVisibility: true,
					hideByDefault: false,
					order: 0,
					collapsed: true
				});
				this.searchResultsView.set('workbench.view.notebooks', searchResultsView);
				Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, container);
				break;
			default: break;
		}
	}

	getSearchResultsViewID(parentConatiner: ViewPaneContainer): string {
		switch (parentConatiner.getId()) {
			case 'workbench.view.notebooks': return NotebookSearchResultsView.ID;
			default: return undefined;
		}
	}
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'defaultSearch',
	order: 13,
	title: localize('searchConfigurationTitle', "Search"),
	type: 'object',
	properties: {
		'defaultSearch.exclude': {
			type: 'object',
			markdownDescription: localize('exclude', "Configure glob patterns for excluding files and folders in fulltext searches and quick open. Inherits all glob patterns from the `#files.exclude#` setting. Read more about glob patterns [here](https://code.visualstudio.com/docs/editor/codebasics#_advanced-search-options)."),
			default: { '**/node_modules': true, '**/bower_components': true, '**/*.code-search': true },
			additionalProperties: {
				anyOf: [
					{
						type: 'boolean',
						description: localize('exclude.boolean', "The glob pattern to match file paths against. Set to true or false to enable or disable the pattern."),
					},
					{
						type: 'object',
						properties: {
							when: {
								type: 'string',
								pattern: '\\w*\\$\\(basename\\)\\w*',
								default: '$(basename).ext',
								description: localize('exclude.when', 'Additional check on the siblings of a matching file. Use $(basename) as variable for the matching file name.')
							}
						}
					}
				]
			},
			scope: ConfigurationScope.RESOURCE
		},
		'defaultSearch.useRipgrep': {
			type: 'boolean',
			description: localize('useRipgrep', "This setting is deprecated and now falls back on \"search.usePCRE2\"."),
			deprecationMessage: localize('useRipgrepDeprecated', "Deprecated. Consider \"search.usePCRE2\" for advanced regex feature support."),
			default: true
		},
		'defaultSearch.maintainFileSearchCache': {
			type: 'boolean',
			description: localize('search.maintainFileSearchCache', "When enabled, the searchService process will be kept alive instead of being shut down after an hour of inactivity. This will keep the file search cache in memory."),
			default: false
		},
		'defaultSearch.useIgnoreFiles': {
			type: 'boolean',
			markdownDescription: localize('useIgnoreFiles', "Controls whether to use `.gitignore` and `.ignore` files when searching for files."),
			default: true,
			scope: ConfigurationScope.RESOURCE
		},
		'defaultSearch.useGlobalIgnoreFiles': {
			type: 'boolean',
			markdownDescription: localize('useGlobalIgnoreFiles', "Controls whether to use global `.gitignore` and `.ignore` files when searching for files."),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'defaultSearch.quickOpen.includeSymbols': {
			type: 'boolean',
			description: localize('search.quickOpen.includeSymbols', "Whether to include results from a global symbol search in the file results for Quick Open."),
			default: false
		},
		'defaultSearch.quickOpen.includeHistory': {
			type: 'boolean',
			description: localize('search.quickOpen.includeHistory', "Whether to include results from recently opened files in the file results for Quick Open."),
			default: true
		},
		'defaultSearch.quickOpen.history.filterSortOrder': {
			'type': 'string',
			'enum': ['default', 'recency'],
			'default': 'default',
			'enumDescriptions': [
				localize('filterSortOrder.default', 'History entries are sorted by relevance based on the filter value used. More relevant entries appear first.'),
				localize('filterSortOrder.recency', 'History entries are sorted by recency. More recently opened entries appear first.')
			],
			'description': localize('filterSortOrder', "Controls sorting order of editor history in quick open when filtering.")
		},
		'defaultSearch.followSymlinks': {
			type: 'boolean',
			description: localize('search.followSymlinks', "Controls whether to follow symlinks while searching."),
			default: true
		},
		'defaultSearch.smartCase': {
			type: 'boolean',
			description: localize('search.smartCase', "Search case-insensitively if the pattern is all lowercase, otherwise, search case-sensitively."),
			default: false
		},
		'defaultSearch.globalFindClipboard': {
			type: 'boolean',
			default: false,
			description: localize('search.globalFindClipboard', "Controls whether the search view should read or modify the shared find clipboard on macOS."),
			included: isMacintosh
		},
		'defaultSearch.location': {
			type: 'string',
			enum: ['sidebar', 'panel'],
			default: 'sidebar',
			description: localize('search.location', "Controls whether the search will be shown as a view in the sidebar or as a panel in the panel area for more horizontal space."),
			deprecationMessage: localize('search.location.deprecationMessage', "This setting is deprecated. Please use the search view's context menu instead.")
		},
		'defaultSearch.collapseResults': {
			type: 'string',
			enum: ['auto', 'alwaysCollapse', 'alwaysExpand'],
			enumDescriptions: [
				localize('search.collapseResults.auto', "Files with less than 10 results are expanded. Others are collapsed."),
				'',
				''
			],
			default: 'alwaysExpand',
			description: localize('search.collapseAllResults', "Controls whether the search results will be collapsed or expanded."),
		},
		'defaultSearch.useReplacePreview': {
			type: 'boolean',
			default: true,
			description: localize('search.useReplacePreview', "Controls whether to open Replace Preview when selecting or replacing a match."),
		},
		'defaultSearch.showLineNumbers': {
			type: 'boolean',
			default: false,
			description: localize('search.showLineNumbers', "Controls whether to show line numbers for search results."),
		},
		'defaultSearch.usePCRE2': {
			type: 'boolean',
			default: false,
			description: localize('search.usePCRE2', "Whether to use the PCRE2 regex engine in text search. This enables using some advanced regex features like lookahead and backreferences. However, not all PCRE2 features are supported - only features that are also supported by JavaScript."),
			deprecationMessage: localize('usePCRE2Deprecated', "Deprecated. PCRE2 will be used automatically when using regex features that are only supported by PCRE2."),
		},
		'defaultSearch.actionsPosition': {
			type: 'string',
			enum: ['auto', 'right'],
			enumDescriptions: [
				localize('search.actionsPositionAuto', "Position the actionbar to the right when the search view is narrow, and immediately after the content when the search view is wide."),
				localize('search.actionsPositionRight', "Always position the actionbar to the right."),
			],
			default: 'auto',
			description: localize('search.actionsPosition', "Controls the positioning of the actionbar on rows in the search view.")
		},
		'defaultSearch.searchOnType': {
			type: 'boolean',
			default: true,
			description: localize('search.searchOnType', "Search all files as you type.")
		},
		'defaultSearch.seedWithNearestWord': {
			type: 'boolean',
			default: false,
			description: localize('search.seedWithNearestWord', "Enable seeding search from the word nearest the cursor when the active editor has no selection.")
		},
		'defaultSearch.seedOnFocus': {
			type: 'boolean',
			default: false,
			description: localize('search.seedOnFocus', "Update workspace search query to the editor's selected text when focusing the search view. This happens either on click or when triggering the `workbench.views.search.focus` command.")
		},
		'defaultSearch.searchOnTypeDebouncePeriod': {
			type: 'number',
			default: 1000,
			markdownDescription: localize('search.searchOnTypeDebouncePeriod', "When `#search.searchOnType#` is enabled, controls the timeout in milliseconds between a character being typed and the search starting. Has no effect when `search.searchOnType` is disabled.")
		},
		'defaultSearch.sortOrder': {
			'type': 'string',
			'enum': [SearchSortOrder.Default, SearchSortOrder.FileNames, SearchSortOrder.Type, SearchSortOrder.Modified, SearchSortOrder.CountDescending, SearchSortOrder.CountAscending],
			'default': SearchSortOrder.Default,
			'enumDescriptions': [
				localize('searchSortOrder.default', 'Results are sorted by folder and file names, in alphabetical order.'),
				localize('searchSortOrder.filesOnly', 'Results are sorted by file names ignoring folder order, in alphabetical order.'),
				localize('searchSortOrder.type', 'Results are sorted by file extensions, in alphabetical order.'),
				localize('searchSortOrder.modified', 'Results are sorted by file last modified date, in descending order.'),
				localize('searchSortOrder.countDescending', 'Results are sorted by count per file, in descending order.'),
				localize('searchSortOrder.countAscending', 'Results are sorted by count per file, in ascending order.')
			],
			'description': localize('search.sortOrder', "Controls sorting order of search results.")
		},
	}
});

