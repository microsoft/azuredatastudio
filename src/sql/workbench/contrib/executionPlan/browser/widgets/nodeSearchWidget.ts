/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanWidgetBase } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetBase';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { Codicon } from 'vs/base/common/codicons';
import { InternalExecutionPlanNode, ExecutionPlan } from 'sql/workbench/contrib/executionPlan/browser/executionPlan';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { attachInputBoxStyler, attachSelectBoxStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Action } from 'vs/base/common/actions';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { isString } from 'vs/base/common/types';

const CONTAINS_DISPLAY_STRING = localize("executionPlanSearchTypeContains", 'Contains');
const EQUALS_DISPLAY_STRING = localize("executionPlanSearchTypeEquals", 'Equals');

export class NodeSearchWidget extends ExecutionPlanWidgetBase {

	private _propertyNameSelectBoxContainer: HTMLElement;
	private _propertyNameSelectBox: SelectBox;

	private _searchTypeSelectBoxContainer: HTMLElement;
	private _searchTypeSelectBox: SelectBox;

	private _searchTextInputBox: InputBox;
	private _searchResults: string[] = [];
	private _currentSearchResultIndex = 0;
	private _usePreviousSearchResult: boolean = false;

	private _actionBar: ActionBar;

	constructor(
		public readonly executionPlanView: ExecutionPlan,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IThemeService public readonly themeService: IThemeService

	) {
		super(DOM.$('.search-node-widget'), 'searchWidget');

		// property name dropdown
		this._propertyNameSelectBoxContainer = DOM.$('.search-widget-property-name-select-box .dropdown-container');
		this.container.appendChild(this._propertyNameSelectBoxContainer);
		const propDropdownOptions = [...executionPlanView.graphElementPropertiesSet].sort();
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
			CONTAINS_DISPLAY_STRING
		], EQUALS_DISPLAY_STRING, this.contextViewService, this._searchTypeSelectBoxContainer);
		this._searchTypeSelectBox.render(this._searchTypeSelectBoxContainer);
		attachSelectBoxStyler(this._searchTypeSelectBox, this.themeService);
		this._searchTypeSelectBoxContainer.style.width = '100px';
		this._searchTypeSelectBox.onDidSelect(e => {
			this._usePreviousSearchResult = false;
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


	public searchNode(returnPreviousResult: boolean): void {

		// Searching again as the input params have changed
		if (!this._usePreviousSearchResult) {

			this._searchResults = [];
			this._currentSearchResultIndex = 0; //Resetting search Index to 0;
			this._usePreviousSearchResult = true;

			// Doing depth first search in the graphModel to find nodes with matching prop values.
			const graphModel = this.executionPlanView.graphModel;
			const stack: InternalExecutionPlanNode[] = [];
			stack.push(graphModel.root);

			while (stack.length !== 0) {
				const currentNode = stack.pop();

				const matchingProp = currentNode.properties.find(e => e.name === this._propertyNameSelectBox.value);

				// Searching only properties with string value.
				if (isString(matchingProp?.value)) {
					// If the search type is '=' we look for exact match and for 'contains' we look search string occurance in prop value
					if (
						this._searchTypeSelectBox.value === EQUALS_DISPLAY_STRING && matchingProp.value === this._searchTextInputBox.value ||
						this._searchTypeSelectBox.value === CONTAINS_DISPLAY_STRING && matchingProp.value.includes(this._searchTextInputBox.value)
					) {
						this._searchResults.push(currentNode.id);
					}
				}

				stack.push(...currentNode.children);
			}
		}
		// Returning if no results found.
		if (this._searchResults.length === 0) {
			return;
		}

		// Getting the node at search index
		const resultCell = this.executionPlanView.azdataGraphDiagram.graph.model.getCell(this._searchResults[this._currentSearchResultIndex]);
		// Selecting the node on graph diagram
		this.executionPlanView.azdataGraphDiagram.graph.setSelectionCell(resultCell);
		this.executionPlanView.propertiesView.graphElement = this.executionPlanView.searchNodes(resultCell.id);

		/**
		 * The selected graph node might be hidden/partially visible if the graph is overflowing the parent container.
		 * Apart from the obvious problems in aesthetics, user do not get a proper feedback of the search result.
		 * To solve this problem, we will have to scroll the node into view. (preferably into the center of the view)
		 * Steps for that:
		 *  1. Get the bounding rect of the node on graph.
		 *  2. Get the midpoint of the node's bounding rect.
		 *  3. Find the dimensions of the parent container.
		 *  4. Since, we are trying to position the node into center, we set the left top corner position of parent to
		 *     below x and y.
		 *  x =	node's x midpoint - half the width of parent container
		 *  y = node's y midpoint - half the height of parent container
		 * 	5. If the x and y are negative, we set them 0 as that is the minimum possible scroll position.
		 *  6. Smoothly scroll to the left top x and y calculated in step 4, 5.
		 */

		const cellRect = this.executionPlanView.azdataGraphDiagram.graph.getCellBounds(resultCell);
		const cellMidPoint: Point = {
			x: cellRect.x + cellRect.width / 2,
			y: cellRect.y + cellRect.height / 2,
		};

		const graphContainer = <HTMLElement>this.executionPlanView.azdataGraphDiagram.container;
		const containerBoundingRect = graphContainer.getBoundingClientRect();

		const leftTopScrollPoint: Point = {
			x: cellMidPoint.x - containerBoundingRect.width / 2,
			y: cellMidPoint.y - containerBoundingRect.height / 2
		};

		leftTopScrollPoint.x = leftTopScrollPoint.x < 0 ? 0 : leftTopScrollPoint.x;
		leftTopScrollPoint.y = leftTopScrollPoint.y < 0 ? 0 : leftTopScrollPoint.y;

		graphContainer.scrollTo({
			left: leftTopScrollPoint.x,
			top: leftTopScrollPoint.y,
			behavior: 'smooth'
		});

		// Updating search result index based on prev flag
		if (returnPreviousResult) {
			// going to the end of list if the index is 0 on prev
			this._currentSearchResultIndex = this._currentSearchResultIndex === 0 ?
				this._currentSearchResultIndex = this._searchResults.length - 1 :
				this._currentSearchResultIndex = --this._currentSearchResultIndex;
		} else {
			// going to the front of list if we are at the last element
			this._currentSearchResultIndex = this._currentSearchResultIndex === this._searchResults.length - 1 ?
				this._currentSearchResultIndex = 0 :
				this._currentSearchResultIndex = ++this._currentSearchResultIndex;
		}
	}
}

interface Point {
	x: number;
	y: number;
}

export class GoToNextMatchAction extends Action {
	public static ID = 'qp.NextSearchAction';
	public static LABEL = localize('nextSearchItemAction', "Next Match (Enter)");

	constructor() {
		super(GoToNextMatchAction.ID, GoToNextMatchAction.LABEL, Codicon.arrowDown.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.searchNode(false);
	}
}

export class GoToPreviousMatchAction extends Action {
	public static ID = 'qp.PreviousSearchAction';
	public static LABEL = localize('previousSearchItemAction', "Previous Match (Shift+Enter)");

	constructor() {
		super(GoToPreviousMatchAction.ID, GoToPreviousMatchAction.LABEL, Codicon.arrowUp.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.searchNode(true);
	}
}

export class CancelSearch extends Action {
	public static ID = 'qp.cancelSearchAction';
	public static LABEL = localize('cancelSearchAction', "Close (Escape)");

	constructor() {
		super(CancelSearch.ID, CancelSearch.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: NodeSearchWidget): Promise<void> {
		context.executionPlanView.planActionView.removeWidget(context);
	}
}
