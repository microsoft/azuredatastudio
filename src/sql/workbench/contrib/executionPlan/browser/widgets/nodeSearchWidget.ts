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

const SELECT_PROPERTY_TITLE = localize('executionPlanSelectPropertyTitle', 'Select property');
const SELECT_SEARCH_TYPE_TITLE = localize('executionPlanSelectSearchTypeTitle', 'Select search type');
const ENTER_SEARCH_VALUE_TITLE = localize('executionPlanEnterValueTitle', 'Enter search value');

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
		this._propertyNameSelectBoxContainer.style.width = '150px';

		const propDropdownOptions = this._executionPlanDiagram.getUniqueElementProperties();
		this._propertyNameSelectBox = this._register(new SelectBox(propDropdownOptions, propDropdownOptions[0], this.contextViewService, this._propertyNameSelectBoxContainer));
		this._propertyNameSelectBox.setAriaLabel(SELECT_PROPERTY_TITLE);
		this._register(attachSelectBoxStyler(this._propertyNameSelectBox, this.themeService));
		this._propertyNameSelectBox.render(this._propertyNameSelectBoxContainer);

		this._register(this._propertyNameSelectBox.onDidSelect(e => {
			this._usePreviousSearchResult = false;
		}));

		// search type dropdown
		this._searchTypeSelectBoxContainer = DOM.$('.search-widget-search-type-select-box .dropdown-container');
		this._searchTypeSelectBoxContainer.style.width = '100px';
		this.container.appendChild(this._searchTypeSelectBoxContainer);

		this._searchTypeSelectBox = this._register(new SelectBox([
			EQUALS_DISPLAY_STRING,
			CONTAINS_DISPLAY_STRING,
			GREATER_DISPLAY_STRING,
			LESSER_DISPLAY_STRING,
			GREATER_EQUAL_DISPLAY_STRING,
			LESSER_EQUAL_DISPLAY_STRING,
			LESSER_AND_GREATER_DISPLAY_STRING
		], EQUALS_DISPLAY_STRING, this.contextViewService, this._searchTypeSelectBoxContainer));
		this._searchTypeSelectBox.setAriaLabel(SELECT_SEARCH_TYPE_TITLE);
		this._searchTypeSelectBox.render(this._searchTypeSelectBoxContainer);
		this._register(attachSelectBoxStyler(this._searchTypeSelectBox, this.themeService));

		this._register(this._searchTypeSelectBox.onDidSelect(e => {
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
		}));

		// search text input box
		this._searchTextInputBox = this._register(new InputBox(this.container, this.contextViewService, {}));
		this._searchTextInputBox.setAriaLabel(ENTER_SEARCH_VALUE_TITLE);
		this._searchTextInputBox.element.style.marginLeft = '5px';
		this._register(attachInputBoxStyler(this._searchTextInputBox, this.themeService));
		this._register(this._searchTextInputBox.onDidChange(e => {
			this._usePreviousSearchResult = false;
		}));

		// setting up key board shortcuts
		const goToPreviousMatchAction = this._register(new GoToPreviousMatchAction());
		const goToNextMatchAction = this._register(new GoToNextMatchAction());
		const cancelSearchAction = this._register(new CancelSearch());

		const self = this;
		this._register(DOM.addDisposableListener(this._searchTextInputBox.element, DOM.EventType.KEY_DOWN, async (e: KeyboardEvent) => {
			if (e.key === 'Enter' && e.shiftKey) {
				await goToPreviousMatchAction.run(self);
			} else if (e.key === 'Enter') {
				await goToNextMatchAction.run(self);
			} else if (e.key === 'Escape') {
				await cancelSearchAction.run(self);
			}
		}));

		// Adding action bar
		this._actionBar = this._register(new ActionBar(this.container));
		this._actionBar.context = this;
		this._actionBar.pushAction(goToPreviousMatchAction, { label: false, icon: true });
		this._actionBar.pushAction(goToNextMatchAction, { label: false, icon: true });
		this._actionBar.pushAction(cancelSearchAction, { label: false, icon: true });
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
	public static LABEL = localize('nextSearchItemAction', "Next Match");

	constructor() {
		super(GoToNextMatchAction.ID, GoToNextMatchAction.LABEL, Codicon.arrowDown.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.next();
	}
}

export class GoToPreviousMatchAction extends Action {
	public static ID = 'qp.PreviousSearchAction';
	public static LABEL = localize('previousSearchItemAction', "Previous Match");

	constructor() {
		super(GoToPreviousMatchAction.ID, GoToPreviousMatchAction.LABEL, Codicon.arrowUp.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.previous();
	}
}

export class CancelSearch extends Action {
	public static ID = 'qp.cancelSearchAction';
	public static LABEL = localize('cancelSearchAction', "Close");

	constructor() {
		super(CancelSearch.ID, CancelSearch.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.planActionView.removeWidget(context);
	}
}
