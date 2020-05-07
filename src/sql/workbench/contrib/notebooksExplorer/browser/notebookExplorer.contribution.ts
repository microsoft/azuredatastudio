/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/notebookExplorer.contribution';
import { localize } from 'vs/nls';
import { ViewletRegistry, Extensions as ViewletExtensions } from 'vs/workbench/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { NotebookExplorerViewletViewsContribution, OpenNotebookExplorerViewletAction, VIEWLET_ID } from 'sql/workbench/contrib/notebooksExplorer/browser/notebookExplorerViewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { NotebookExplorerContainerExtensionHandler } from 'sql/workbench/contrib/notebooksExplorer/browser/notebookExplorerExtensionPoint';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { SearchSortOrder } from 'sql/workbench/contrib/notebooksExplorer/common/constants';
import { isMacintosh } from 'vs/base/common/platform';

Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(NotebookExplorerViewletViewsContribution, LifecyclePhase.Starting);
const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		OpenNotebookExplorerViewletAction,
		OpenNotebookExplorerViewletAction.ID,
		OpenNotebookExplorerViewletAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_B }),
	'View: Show Notebook Explorer',
	localize('notebookExplorer.view', "View")
);

workbenchRegistry.registerWorkbenchContribution(NotebookExplorerContainerExtensionHandler, LifecyclePhase.Starting);

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'notebookExplorerSearch',
	order: 13,
	title: localize('searchConfigurationTitle', "Search Notebooks"),
	type: 'object',
	properties: {
		'notebookExplorerSearch.exclude': {
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
								type: 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
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
		'notebookExplorerSearch.useRipgrep': {
			type: 'boolean',
			description: localize('useRipgrep', "This setting is deprecated and now falls back on \"search.usePCRE2\"."),
			deprecationMessage: localize('useRipgrepDeprecated', "Deprecated. Consider \"search.usePCRE2\" for advanced regex feature support."),
			default: true
		},
		'notebookExplorerSearch.maintainFileSearchCache': {
			type: 'boolean',
			description: localize('search.maintainFileSearchCache', "When enabled, the searchService process will be kept alive instead of being shut down after an hour of inactivity. This will keep the file search cache in memory."),
			default: false
		},
		'notebookExplorerSearch.useIgnoreFiles': {
			type: 'boolean',
			markdownDescription: localize('useIgnoreFiles', "Controls whether to use `.gitignore` and `.ignore` files when searching for files."),
			default: true,
			scope: ConfigurationScope.RESOURCE
		},
		'notebookExplorerSearch.useGlobalIgnoreFiles': {
			type: 'boolean',
			markdownDescription: localize('useGlobalIgnoreFiles', "Controls whether to use global `.gitignore` and `.ignore` files when searching for files."),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'notebookExplorerSearch.quickOpen.includeSymbols': {
			type: 'boolean',
			description: localize('search.quickOpen.includeSymbols', "Whether to include results from a global symbol search in the file results for Quick Open."),
			default: false
		},
		'notebookExplorerSearch.quickOpen.includeHistory': {
			type: 'boolean',
			description: localize('search.quickOpen.includeHistory', "Whether to include results from recently opened files in the file results for Quick Open."),
			default: true
		},
		'notebookExplorerSearch.quickOpen.history.filterSortOrder': {
			'type': 'string',
			'enum': ['default', 'recency'],
			'default': 'default',
			'enumDescriptions': [
				localize('filterSortOrder.default', 'History entries are sorted by relevance based on the filter value used. More relevant entries appear first.'),
				localize('filterSortOrder.recency', 'History entries are sorted by recency. More recently opened entries appear first.')
			],
			'description': localize('filterSortOrder', "Controls sorting order of editor history in quick open when filtering.")
		},
		'notebookExplorerSearch.followSymlinks': {
			type: 'boolean',
			description: localize('search.followSymlinks', "Controls whether to follow symlinks while searching."),
			default: true
		},
		'notebookExplorerSearch.smartCase': {
			type: 'boolean',
			description: localize('search.smartCase', "Search case-insensitively if the pattern is all lowercase, otherwise, search case-sensitively."),
			default: false
		},
		'notebookExplorerSearch.globalFindClipboard': {
			type: 'boolean',
			default: false,
			description: localize('search.globalFindClipboard', "Controls whether the search view should read or modify the shared find clipboard on macOS."),
			included: isMacintosh
		},
		'notebookExplorerSearch.location': {
			type: 'string',
			enum: ['sidebar', 'panel'],
			default: 'sidebar',
			description: localize('search.location', "Controls whether the search will be shown as a view in the sidebar or as a panel in the panel area for more horizontal space."),
			deprecationMessage: localize('search.location.deprecationMessage', "This setting is deprecated. Please use the search view's context menu instead.")
		},
		'notebookExplorerSearch.collapseResults': {
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
		'notebookExplorerSearch.useReplacePreview': {
			type: 'boolean',
			default: true,
			description: localize('search.useReplacePreview', "Controls whether to open Replace Preview when selecting or replacing a match."),
		},
		'notebookExplorerSearch.showLineNumbers': {
			type: 'boolean',
			default: false,
			description: localize('search.showLineNumbers', "Controls whether to show line numbers for search results."),
		},
		'notebookExplorerSearch.usePCRE2': {
			type: 'boolean',
			default: false,
			description: localize('search.usePCRE2', "Whether to use the PCRE2 regex engine in text search. This enables using some advanced regex features like lookahead and backreferences. However, not all PCRE2 features are supported - only features that are also supported by JavaScript."),
			deprecationMessage: localize('usePCRE2Deprecated', "Deprecated. PCRE2 will be used automatically when using regex features that are only supported by PCRE2."),
		},
		'notebookExplorerSearch.actionsPosition': {
			type: 'string',
			enum: ['auto', 'right'],
			enumDescriptions: [
				localize('search.actionsPositionAuto', "Position the actionbar to the right when the search view is narrow, and immediately after the content when the search view is wide."),
				localize('search.actionsPositionRight', "Always position the actionbar to the right."),
			],
			default: 'auto',
			description: localize('search.actionsPosition', "Controls the positioning of the actionbar on rows in the search view.")
		},
		'notebookExplorerSearch.searchOnType': {
			type: 'boolean',
			default: false,
			description: localize('search.searchOnType', "Search all files as you type.")
		},
		'notebookExplorerSearch.seedWithNearestWord': {
			type: 'boolean',
			default: false,
			description: localize('search.seedWithNearestWord', "Enable seeding search from the word nearest the cursor when the active editor has no selection.")
		},
		'notebookExplorerSearch.seedOnFocus': {
			type: 'boolean',
			default: false,
			description: localize('search.seedOnFocus', "Update workspace search query to the editor's selected text when focusing the search view. This happens either on click or when triggering the `workbench.views.search.focus` command.")
		},
		'notebookExplorerSearch.searchOnTypeDebouncePeriod': {
			type: 'number',
			default: 300,
			markdownDescription: localize('search.searchOnTypeDebouncePeriod', "When `#search.searchOnType#` is enabled, controls the timeout in milliseconds between a character being typed and the search starting. Has no effect when `search.searchOnType` is disabled.")
		},
		'notebookExplorerSearch.searchEditor.doubleClickBehaviour': {
			type: 'string',
			enum: ['selectWord', 'goToLocation', 'openLocationToSide'],
			default: 'goToLocation',
			enumDescriptions: [
				localize('search.searchEditor.doubleClickBehaviour.selectWord', "Double clicking selects the word under the cursor."),
				localize('search.searchEditor.doubleClickBehaviour.goToLocation', "Double clicking opens the result in the active editor group."),
				localize('search.searchEditor.doubleClickBehaviour.openLocationToSide', "Double clicking opens the result in the editor group to the side, creating one if it does not yet exist."),
			],
			markdownDescription: localize('search.searchEditor.doubleClickBehaviour', "Configure effect of double clicking a result in a search editor.")
		},
		'notebookExplorerSearch.sortOrder': {
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

