/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { ICommandHandler } from 'vs/platform/commands/common/commands';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { WorkbenchListFocusContextKey } from 'vs/platform/list/browser/listService';
import { IViewsService } from 'vs/workbench/common/views';
import { searchClearIcon, searchCollapseAllIcon, searchExpandAllIcon, searchRefreshIcon, searchShowAsList, searchShowAsTree, searchStopIcon } from 'vs/workbench/contrib/search/browser/searchIcons';
import * as Constants from 'vs/workbench/contrib/search/common/constants';
import { ISearchHistoryService } from 'vs/workbench/contrib/search/common/searchHistoryService';
import { FileMatch, FolderMatch, FolderMatchNoRoot, FolderMatchWorkspaceRoot, Match, SearchResult } from 'vs/workbench/contrib/search/browser/searchModel';
import { VIEW_ID } from 'vs/workbench/services/search/common/search';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { Action2, MenuId, registerAction2 } from 'vs/platform/actions/common/actions';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode } from 'vs/base/common/keyCodes';
import { SearchStateKey, SearchUIState } from 'vs/workbench/contrib/search/common/search';
import { category, getSearchView } from 'vs/workbench/contrib/search/browser/searchActionsBase';

//#region Actions
registerAction2(class ClearSearchHistoryCommandAction extends Action2 {

	constructor(
	) {
		super({
			id: Constants.ClearSearchHistoryCommandId,
			title: {
				value: nls.localize('clearSearchHistoryLabel', "Clear Search History"),
				original: 'Clear Search History'
			},
			category,
			f1: true
		});

	}

	override async run(accessor: ServicesAccessor): Promise<any> {
		clearHistoryCommand(accessor);
	}
});

registerAction2(class CancelSearchAction extends Action2 {
	constructor() {
		super({
			id: Constants.CancelSearchActionId,
			title: {
				value: nls.localize('CancelSearchAction.label', "Cancel Search"),
				original: 'Cancel Search'
			},
			icon: searchStopIcon,
			category,
			f1: true,
			precondition: SearchStateKey.isEqualTo(SearchUIState.Idle).negate(),
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: ContextKeyExpr.and(Constants.SearchViewVisibleKey, WorkbenchListFocusContextKey),
				primary: KeyCode.Escape,
			},
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 0,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', VIEW_ID), SearchStateKey.isEqualTo(SearchUIState.SlowSearch)),
			}]
		});
	}
	run(accessor: ServicesAccessor) {
		return cancelSearch(accessor);
	}
});

registerAction2(class RefreshAction extends Action2 {
	constructor() {
		super({
			id: Constants.RefreshSearchResultsActionId,
			title: {
				value: nls.localize('RefreshAction.label', "Refresh"),
				original: 'Refresh'
			},
			icon: searchRefreshIcon,
			precondition: Constants.ViewHasSearchPatternKey,
			category,
			f1: true,
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 0,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', VIEW_ID), SearchStateKey.isEqualTo(SearchUIState.SlowSearch).negate()),
			}]
		});
	}
	run(accessor: ServicesAccessor, ...args: any[]) {
		return refreshSearch(accessor);
	}
});

registerAction2(class CollapseDeepestExpandedLevelAction extends Action2 {
	constructor() {
		super({
			id: Constants.CollapseSearchResultsActionId,
			title: {
				value: nls.localize('CollapseDeepestExpandedLevelAction.label', "Collapse All"),
				original: 'Collapse All'
			},
			category,
			icon: searchCollapseAllIcon,
			f1: true,
			precondition: ContextKeyExpr.and(Constants.HasSearchResults, Constants.ViewHasSomeCollapsibleKey),
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 3,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', VIEW_ID), ContextKeyExpr.or(Constants.HasSearchResults.negate(), Constants.ViewHasSomeCollapsibleKey)),
			}]
		});
	}
	run(accessor: ServicesAccessor, ...args: any[]) {
		return collapseDeepestExpandedLevel(accessor);
	}
});

registerAction2(class ExpandAllAction extends Action2 {
	constructor() {
		super({
			id: Constants.ExpandSearchResultsActionId,
			title: {
				value: nls.localize('ExpandAllAction.label', "Expand All"),
				original: 'Expand All'
			},
			category,
			icon: searchExpandAllIcon,
			f1: true,
			precondition: ContextKeyExpr.and(Constants.HasSearchResults, Constants.ViewHasSomeCollapsibleKey.toNegated()),
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 3,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', VIEW_ID), Constants.HasSearchResults, Constants.ViewHasSomeCollapsibleKey.toNegated()),
			}]
		});
	}
	run(accessor: ServicesAccessor, ...args: any[]) {
		return expandAll(accessor);
	}
});

registerAction2(class ClearSearchResultsAction extends Action2 {
	constructor() {
		super({
			id: Constants.ClearSearchResultsActionId,
			title: {
				value: nls.localize('ClearSearchResultsAction.label', "Clear Search Results"),
				original: 'Clear Search Results'
			},
			category,
			icon: searchClearIcon,
			f1: true,
			precondition: ContextKeyExpr.or(Constants.HasSearchResults, Constants.ViewHasSearchPatternKey, Constants.ViewHasReplacePatternKey, Constants.ViewHasFilePatternKey),
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 1,
				when: ContextKeyExpr.equals('view', VIEW_ID),
			}]
		});
	}
	run(accessor: ServicesAccessor, ...args: any[]) {
		return clearSearchResults(accessor);
	}
});


registerAction2(class ViewAsTreeAction extends Action2 {
	constructor() {
		super({
			id: Constants.ViewAsTreeActionId,
			title: {
				value: nls.localize('ViewAsTreeAction.label', "View as Tree"),
				original: 'View as Tree'
			},
			category,
			icon: searchShowAsList,
			f1: true,
			precondition: ContextKeyExpr.and(Constants.HasSearchResults, Constants.InTreeViewKey.toNegated()),
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 2,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', VIEW_ID), Constants.InTreeViewKey.toNegated()),
			}]
		});
	}
	run(accessor: ServicesAccessor, ...args: any[]) {
		const searchView = getSearchView(accessor.get(IViewsService));
		if (searchView) {
			searchView.setTreeView(true);
		}
	}
});

registerAction2(class ViewAsListAction extends Action2 {
	constructor() {
		super({
			id: Constants.ViewAsListActionId,
			title: {
				value: nls.localize('ViewAsListAction.label', "View as List"),
				original: 'View as List'
			},
			category,
			icon: searchShowAsTree,
			f1: true,
			precondition: ContextKeyExpr.and(Constants.HasSearchResults, Constants.InTreeViewKey),
			menu: [{
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 2,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', VIEW_ID), Constants.InTreeViewKey),
			}]
		});
	}
	run(accessor: ServicesAccessor, ...args: any[]) {
		const searchView = getSearchView(accessor.get(IViewsService));
		if (searchView) {
			searchView.setTreeView(false);
		}
	}
});

//#endregion

//#region Helpers
const clearHistoryCommand: ICommandHandler = accessor => {
	const searchHistoryService = accessor.get(ISearchHistoryService);
	searchHistoryService.clearHistory();
};

function expandAll(accessor: ServicesAccessor) {
	const viewsService = accessor.get(IViewsService);
	const searchView = getSearchView(viewsService);
	if (searchView) {
		const viewer = searchView.getControl();
		viewer.expandAll();
	}
}

function clearSearchResults(accessor: ServicesAccessor) {
	const viewsService = accessor.get(IViewsService);
	const searchView = getSearchView(viewsService);
	searchView?.clearSearchResults();
}

function cancelSearch(accessor: ServicesAccessor) {
	const viewsService = accessor.get(IViewsService);
	const searchView = getSearchView(viewsService);
	searchView?.cancelSearch();
}

function refreshSearch(accessor: ServicesAccessor) {
	const viewsService = accessor.get(IViewsService);
	const searchView = getSearchView(viewsService);
	searchView?.triggerQueryChange({ preserveFocus: false });
}

function collapseDeepestExpandedLevel(accessor: ServicesAccessor) {

	const viewsService = accessor.get(IViewsService);
	const searchView = getSearchView(viewsService);
	if (searchView) {
		const viewer = searchView.getControl();

		/**
		 * one level to collapse so collapse everything. If FolderMatch, check if there are visible grandchildren,
		 * i.e. if Matches are returned by the navigator, and if so, collapse to them, otherwise collapse all levels.
		 */
		const navigator = viewer.navigate();
		let node = navigator.first();
		let canCollapseFileMatchLevel = false;
		let canCollapseFirstLevel = false;

		if (node instanceof FolderMatchWorkspaceRoot || searchView.isTreeLayoutViewVisible) {
			while (node = navigator.next()) {
				if (node instanceof Match) {
					canCollapseFileMatchLevel = true;
					break;
				}
				if (searchView.isTreeLayoutViewVisible && !canCollapseFirstLevel) {
					let nodeToTest = node;

					if (node instanceof FolderMatch) {
						const compressionStartNode = viewer.getCompressedTreeNode(node).element?.elements[0];
						// Match elements should never be compressed, so !(compressionStartNode instanceof Match) should always be true here
						nodeToTest = (compressionStartNode && !(compressionStartNode instanceof Match)) ? compressionStartNode : node;
					}

					const immediateParent = nodeToTest.parent();

					if (!(immediateParent instanceof FolderMatchWorkspaceRoot || immediateParent instanceof FolderMatchNoRoot || immediateParent instanceof SearchResult)) {
						canCollapseFirstLevel = true;
					}
				}
			}
		}

		if (canCollapseFileMatchLevel) {
			node = navigator.first();
			do {
				if (node instanceof FileMatch) {
					viewer.collapse(node);
				}
			} while (node = navigator.next());
		} else if (canCollapseFirstLevel) {
			node = navigator.first();
			if (node) {
				do {

					let nodeToTest = node;

					if (node instanceof FolderMatch) {
						const compressionStartNode = viewer.getCompressedTreeNode(node).element?.elements[0];
						// Match elements should never be compressed, so !(compressionStartNode instanceof Match) should always be true here
						nodeToTest = (compressionStartNode && !(compressionStartNode instanceof Match)) ? compressionStartNode : node;
					}
					const immediateParent = nodeToTest.parent();

					if (immediateParent instanceof FolderMatchWorkspaceRoot || immediateParent instanceof FolderMatchNoRoot) {
						if (viewer.hasElement(node)) {
							viewer.collapse(node, true);
						} else {
							viewer.collapseAll();
						}
					}
				} while (node = navigator.next());
			}
		} else {
			viewer.collapseAll();
		}

		const firstFocusParent = viewer.getFocus()[0]?.parent();

		if (firstFocusParent && (firstFocusParent instanceof FolderMatch || firstFocusParent instanceof FileMatch) &&
			viewer.hasElement(firstFocusParent) && viewer.isCollapsed(firstFocusParent)) {
			viewer.domFocus();
			viewer.focusFirst();
			viewer.setSelection(viewer.getFocus());
		}
	}
}

//#endregion
