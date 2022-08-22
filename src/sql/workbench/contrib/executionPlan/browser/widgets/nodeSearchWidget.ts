/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ExecutionPlanWidgetBase } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetBase';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { Codicon } from 'vs/base/common/codicons';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { attachInputBoxStyler, attachSelectBoxStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Action } from 'vs/base/common/actions';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { AzdataGraphView, SearchType } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { ExecutionPlanWidgetController } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetController';

const CONTAINS_DISPLAY_STRING = localize("executionPlanSearchTypeContains", 'Contains');
const EQUALS_DISPLAY_STRING = localize("executionPlanSearchTypeEquals", 'Equals');
const GREATER_DISPLAY_STRING = '>';
const LESSER_DISPLAY_STRING = '<';
const GREATER_EQUAL_DISPLAY_STRING = '>=';
const LESSER_EQUAL_DISPLAY_STRING = '<=';
const LESSER_AND_GREATER_DISPLAY_STRING = '<>';

export class NodeSearchWidget extends ExecutionPlanWidgetBase {

	private _propertyNameSelectBoxContainer: HTMLElement;
	private _propertyNameSelectBox: SelectBox;

	private _searchTypeSelectBoxContainer: HTMLElement;
	private _searchTypeSelectBox: SelectBox;
	private _selectedSearchType: SearchType = SearchType.Equals;

	private _searchTextInputBox: InputBox;
	private _searchResults: azdata.executionPlan.ExecutionPlanNode[] = [];
	private _currentSearchResultIndex = 0;
	private _usePreviousSearchResult: boolean = false;

	private _actionBar: ActionBar;

	constructor(
		public readonly planActionView: ExecutionPlanWidgetController,
		private readonly _executionPlanDiagram: AzdataGraphView,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IThemeService public readonly themeService: IThemeService
	) {
		super(DOM.$('.search-node-widget'), 'searchWidget');

		// property name dropdown
		this._propertyNameSelectBoxContainer = DOM.$('.search-widget-property-name-select-box .dropdown-container');
		this.container.appendChild(this._propertyNameSelectBoxContainer);
		const propDropdownOptions = this._executionPlanDiagram.getUniqueElementProperties();
		this._propertyNameSelectBox = new SelectBox(propDropdownOptions, propDropdownOptions[0], this.contextViewService, this._propertyNameSelectBoxContainer);
		attachSelectBoxStyler(this._propertyNameSelectBox, this.themeService);
		this._propertyNameSelectBoxContainer.style.width = '150px';
		this._propertyNameSelectBox.render(this._propertyNameSelectBoxContainer);
		this._propertyNameSelectBox.onDidSelect(e => {
			this._usePreviousSearchResult = false;
		});

		// search type dropdown
		this._searchTypeSelectBoxContainer = DOM.$('.search-widget-search-type-select-box .dropdown-container');
		this.container.appendChild(this._searchTypeSelectBoxContainer);
		this._searchTypeSelectBox = new SelectBox([
			EQUALS_DISPLAY_STRING,
			CONTAINS_DISPLAY_STRING,
			GREATER_DISPLAY_STRING,
			LESSER_DISPLAY_STRING,
			GREATER_EQUAL_DISPLAY_STRING,
			LESSER_EQUAL_DISPLAY_STRING,
			LESSER_AND_GREATER_DISPLAY_STRING
		], EQUALS_DISPLAY_STRING, this.contextViewService, this._searchTypeSelectBoxContainer);
		this._searchTypeSelectBox.render(this._searchTypeSelectBoxContainer);
		attachSelectBoxStyler(this._searchTypeSelectBox, this.themeService);
		this._searchTypeSelectBoxContainer.style.width = '100px';
		this._searchTypeSelectBox.onDidSelect(e => {
			this._usePreviousSearchResult = false;
			switch (e.selected) {
				case EQUALS_DISPLAY_STRING:
					this._selectedSearchType = SearchType.Equals;
					break;
				case CONTAINS_DISPLAY_STRING:
					this._selectedSearchType = SearchType.Contains;
					break;
				case GREATER_DISPLAY_STRING:
					this._selectedSearchType = SearchType.GreaterThan;
					break;
				case LESSER_DISPLAY_STRING:
					this._selectedSearchType = SearchType.LesserThan;
					break;
				case GREATER_EQUAL_DISPLAY_STRING:
					this._selectedSearchType = SearchType.GreaterThanEqualTo;
					break;
				case LESSER_EQUAL_DISPLAY_STRING:
					this._selectedSearchType = SearchType.LesserThanEqualTo;
					break;
				case LESSER_AND_GREATER_DISPLAY_STRING:
					this._selectedSearchType = SearchType.LesserAndGreaterThan;
			}
		});

		// search text input box
		this._searchTextInputBox = new InputBox(this.container, this.contextViewService, {});
		attachInputBoxStyler(this._searchTextInputBox, this.themeService);
		this._searchTextInputBox.element.style.marginLeft = '5px';
		this._searchTextInputBox.onDidChange(e => {
			this._usePreviousSearchResult = false;
		});


		// setting up key board shortcuts
		const self = this;
		this._searchTextInputBox.element.onkeydown = async e => {
			if (e.key === 'Enter' && e.shiftKey) {
				await new GoToPreviousMatchAction().run(self);
			} else if (e.key === 'Enter') {
				await new GoToNextMatchAction().run(self);
			} else if (e.key === 'Escape') {
				await new CancelSearch().run(self);
			}
		};

		// Adding action bar
		this._actionBar = new ActionBar(this.container);
		this._actionBar.context = this;
		this._actionBar.pushAction(new GoToPreviousMatchAction(), { label: false, icon: true });
		this._actionBar.pushAction(new GoToNextMatchAction(), { label: false, icon: true });
		this._actionBar.pushAction(new CancelSearch(), { label: false, icon: true });
	}

	// Initial focus is set to the search text input box
	public focus() {
		this._searchTextInputBox.focus();
	}

	public searchNodes(): void {
		this._currentSearchResultIndex = 0;
		this._searchResults = this._executionPlanDiagram.searchNodes({
			propertyName: this._propertyNameSelectBox.value,
			value: this._searchTextInputBox.value,
			searchType: this._selectedSearchType
		});

		this._usePreviousSearchResult = true;
	}

	public next(): void {
		if (!this._usePreviousSearchResult) {
			this.searchNodes();
		}

		this._executionPlanDiagram.centerElement(this._searchResults[this._currentSearchResultIndex]);
		this._executionPlanDiagram.selectElement(this._searchResults[this._currentSearchResultIndex]);
		this._currentSearchResultIndex = this._currentSearchResultIndex === this._searchResults.length - 1 ?
			this._currentSearchResultIndex = 0 :
			this._currentSearchResultIndex = ++this._currentSearchResultIndex;
	}

	public previous(): void {
		if (!this._usePreviousSearchResult) {
			this.searchNodes();
		}

		this._executionPlanDiagram.centerElement(this._searchResults[this._currentSearchResultIndex]);
		this._executionPlanDiagram.selectElement(this._searchResults[this._currentSearchResultIndex]);
		this._currentSearchResultIndex = this._currentSearchResultIndex === 0 ?
			this._currentSearchResultIndex = this._searchResults.length - 1 :
			this._currentSearchResultIndex = --this._currentSearchResultIndex;
	}
}

export class GoToNextMatchAction extends Action {
	public static ID = 'qp.NextSearchAction';
	public static LABEL = localize('nextSearchItemAction', "Next Match (Enter)");

	constructor() {
		super(GoToNextMatchAction.ID, GoToNextMatchAction.LABEL, Codicon.arrowDown.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.next();
	}
}

export class GoToPreviousMatchAction extends Action {
	public static ID = 'qp.PreviousSearchAction';
	public static LABEL = localize('previousSearchItemAction', "Previous Match (Shift+Enter)");

	constructor() {
		super(GoToPreviousMatchAction.ID, GoToPreviousMatchAction.LABEL, Codicon.arrowUp.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.previous();
	}
}

export class CancelSearch extends Action {
	public static ID = 'qp.cancelSearchAction';
	public static LABEL = localize('cancelSearchAction', "Close (Escape)");

	constructor() {
		super(CancelSearch.ID, CancelSearch.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.planActionView.removeWidget(context);
	}
}
