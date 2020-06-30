/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IViewsService } from 'vs/workbench/common/views';
import { searchCollapseAllIcon, searchExpandAllIcon, searchClearIcon, searchStopIcon } from 'vs/workbench/contrib/search/browser/searchIcons';
import { getSearchView } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookSearchView';
import { FolderMatch, Match, FileMatch } from 'vs/workbench/contrib/search/common/searchModel';

export class ToggleCollapseAndExpandAction extends Action {
	static readonly ID: string = 'search.action.collapseOrExpandSearchResults';
	static LABEL: string = nls.localize('ToggleCollapseAndExpandAction.label', "Toggle Collapse and Expand");

	// Cache to keep from crawling the tree too often.
	private action: CollapseDeepestExpandedLevelAction | ExpandAllAction | undefined;

	constructor(id: string, label: string,
		private collapseAction: CollapseDeepestExpandedLevelAction,
		private expandAction: ExpandAllAction,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, collapseAction.class);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
		this.onTreeCollapseStateChange();
	}

	onTreeCollapseStateChange() {
		this.action = undefined;
		this.determineAction();
	}

	private determineAction(): CollapseDeepestExpandedLevelAction | ExpandAllAction {
		if (this.action !== undefined) { return this.action; }
		this.action = this.isSomeCollapsible() ? this.collapseAction : this.expandAction;
		this.class = this.action.class;
		return this.action;
	}

	private isSomeCollapsible(): boolean {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			const viewer = searchView.getControl();
			const navigator = viewer.navigate();
			let node = navigator.first();
			do {
				if (!viewer.isCollapsed(node)) {
					return true;
				}
			} while (node = navigator.next());
		}
		return false;
	}


	async run(): Promise<void> {
		await this.determineAction().run();
	}
}

export class CancelSearchAction extends Action {

	static readonly ID: string = 'search.action.cancelSearch';
	static LABEL: string = nls.localize('CancelSearchAction.label', "Cancel Search");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchStopIcon.classNames);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.isSlowSearch();
	}

	run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			searchView.cancelSearch();
		}

		return Promise.resolve(undefined);
	}
}

export class ExpandAllAction extends Action {

	static readonly ID: string = 'search.action.expandSearchResults';
	static LABEL: string = nls.localize('ExpandAllAction.label', "Expand All");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchExpandAllIcon.classNames);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
	}

	run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			const viewer = searchView.getControl();
			viewer.expandAll();
			viewer.domFocus();
			viewer.focusFirst();
		}
		return Promise.resolve(undefined);
	}
}

export class CollapseDeepestExpandedLevelAction extends Action {

	static readonly ID: string = 'search.action.collapseSearchResults';
	static LABEL: string = nls.localize('CollapseDeepestExpandedLevelAction.label', "Collapse All");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchCollapseAllIcon.classNames);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
	}

	run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			const viewer = searchView.getControl();

			/**
			 * one level to collapse so collapse everything. If FolderMatch, check if there are visible grandchildren,
			 * i.e. if Matches are returned by the navigator, and if so, collapse to them, otherwise collapse all levels.
			 */
			const navigator = viewer.navigate();
			let node = navigator.first();
			let collapseFileMatchLevel = false;
			if (node instanceof FolderMatch) {
				while (node = navigator.next()) {
					if (node instanceof Match) {
						collapseFileMatchLevel = true;
						break;
					}
				}
			}

			if (collapseFileMatchLevel) {
				node = navigator.first();
				do {
					if (node instanceof FileMatch) {
						viewer.collapse(node);
					}
				} while (node = navigator.next());
			} else {
				viewer.collapseAll();
			}

			viewer.domFocus();
			viewer.focusFirst();
		}
		return Promise.resolve(undefined);
	}
}

export class ClearSearchResultsAction extends Action {

	static readonly ID: string = 'search.action.clearSearchResults';
	static LABEL: string = nls.localize('ClearSearchResultsAction.label', "Clear Search Results");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchClearIcon.classNames);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
	}

	run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			searchView.clearSearchResults();
		}
		return Promise.resolve();
	}
}
