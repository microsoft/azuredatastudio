/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import * as glob from 'vs/base/common/glob';
import { SearchSortOrder } from 'vs/workbench/services/search/common/search';

export const FindInNotebooksActionId = 'workbench.action.findInNotebooks';
export const FocusActiveEditorCommandId = 'notebookSearch.action.focusActiveEditor';

export const FocusSearchFromResults = 'notebookSearch.action.focusSearchFromResults';
export const OpenMatchToSide = 'notebookSearch.action.openResultToSide';
export const CancelActionId = 'notebookSearch.action.cancel';
export const RemoveActionId = 'notebookSearch.action.remove';
export const CopyPathCommandId = 'notebookSearch.action.copyPath';
export const CopyMatchCommandId = 'notebookSearch.action.copyMatch';
export const CopyAllCommandId = 'notebookSearch.action.copyAll';
export const OpenInEditorCommandId = 'notebookSearch.action.openInEditor';
export const ClearSearchHistoryCommandId = 'notebookSearch.action.clearHistory';
export const FocusSearchListCommandID = 'notebookSearch.action.focusSearchList';
export const ToggleCaseSensitiveCommandId = 'toggleSearchCaseSensitive';
export const ToggleWholeWordCommandId = 'toggleSearchWholeWord';
export const ToggleRegexCommandId = 'toggleSearchRegex';
export const AddCursorsAtSearchResults = 'addCursorsAtSearchResults';

export const SearchViewFocusedKey = new RawContextKey<boolean>('notebookSearchViewletFocus', false);
export const InputBoxFocusedKey = new RawContextKey<boolean>('inputBoxFocus', false);
export const SearchInputBoxFocusedKey = new RawContextKey<boolean>('searchInputBoxFocus', false);

// !! Do not change these or updates won't be able to deserialize editors correctly !!
export const UNTITLED_NOTEBOOK_TYPEID = 'workbench.editorinputs.untitledNotebookInput';
export const UNTITLED_QUERY_EDITOR_TYPEID = 'workbench.editorInput.untitledQueryInput';
export const FILE_QUERY_EDITOR_TYPEID = 'workbench.editorInput.fileQueryInput';
export const RESOURCE_VIEWER_TYPEID = 'workbench.editorInput.resourceViewerInput';

export const JUPYTER_PROVIDER_ID = 'jupyter';

export const enum NotebookLanguage {
	Notebook = 'Notebook',
	Ipynb = 'ipynb'
}
export interface INotebookSearchConfigurationProperties {
	exclude: glob.IExpression;
	useRipgrep: boolean;
	/**
	 * Use ignore file for file search.
	 */
	useIgnoreFiles: boolean;
	useGlobalIgnoreFiles: boolean;
	followSymlinks: boolean;
	smartCase: boolean;
	globalFindClipboard: boolean;
	location: 'sidebar' | 'panel';
	useReplacePreview: boolean;
	showLineNumbers: boolean;
	usePCRE2: boolean;
	actionsPosition: 'auto' | 'right';
	maintainFileSearchCache: boolean;
	collapseResults: 'auto' | 'alwaysCollapse' | 'alwaysExpand';
	searchOnType: boolean;
	seedOnFocus: boolean;
	seedWithNearestWord: boolean;
	searchOnTypeDebouncePeriod: number;
	searchEditor: {
		doubleClickBehaviour: 'selectWord' | 'goToLocation' | 'openLocationToSide',
		experimental: { reusePriorSearchConfiguration: boolean }
	};
	sortOrder: SearchSortOrder;
}

export const RESULTS_GRID_DEFAULTS = {
	cellPadding: [5, 8, 4],
	rowHeight: 24
};
