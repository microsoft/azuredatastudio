/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/executionPlan';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ExecutionPlanState } from 'sql/workbench/common/editor/query/executionPlanState';
import { ExecutionPlanFileView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileView';
import { ExecutionPlanFileViewCache } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileViewCache';
import { generateUuid } from 'vs/base/common/uuid';
import { QueryResultsView } from 'sql/workbench/contrib/query/browser/queryResultsView';

export class ExecutionPlanTab implements IPanelTab {
	public readonly title = localize('executionPlanTitle', "Query Plan (Preview)");
	public readonly identifier = 'ExecutionPlan2Tab';
	public readonly view: ExecutionPlanTabView;

	constructor(
		private _queryResultsView: QueryResultsView,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		this.view = instantiationService.createInstance(ExecutionPlanTabView, this._queryResultsView);
	}

	public dispose() {
	}

	public clear() {
		this.view.clear();
	}

}

export class ExecutionPlanTabView implements IPanelView {
	private _container: HTMLElement = DOM.$('.execution-plan-tab');
	private _input: ExecutionPlanState;
	private _viewCache: ExecutionPlanFileViewCache = ExecutionPlanFileViewCache.getInstance();
	public currentFileView: ExecutionPlanFileView;

	constructor(
		private _queryResultsView: QueryResultsView,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
	}

	public set state(newInput: ExecutionPlanState) {
		const oldInput = this._input;

		// clearing old input view
		if (oldInput?.executionPlanFileViewUUID) {
			const oldView = this._viewCache.executionPlanFileViewMap.get(oldInput.executionPlanFileViewUUID);
			oldView.onHide(this._container);
		}

		// if new input already has a view we are just making it visible here.
		let newView = this._viewCache.executionPlanFileViewMap.get(newInput.executionPlanFileViewUUID);
		if (newView) {
			newView.onShow(this._container);
		} else {
			// creating a new view for the new input
			newInput.executionPlanFileViewUUID = generateUuid();
			newView = this._instantiationService.createInstance(ExecutionPlanFileView, this._queryResultsView);
			newView.onShow(this._container);
			newView.addGraphs(
				newInput.graphs
			);
			this._viewCache.executionPlanFileViewMap.set(newInput.executionPlanFileViewUUID, newView);
		}
		this.currentFileView = newView;
		this._input = newInput;
	}

	public render(parent: HTMLElement): void {
		parent.appendChild(this._container);
	}

	public layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}

	public clearPlans(): void {
		let currentView = this._viewCache.executionPlanFileViewMap.get(this._input.executionPlanFileViewUUID);
		if (currentView) {
			currentView.onHide(this._container);
			this._input.graphs = [];
			currentView = this._instantiationService.createInstance(ExecutionPlanFileView, this._queryResultsView);
			this._viewCache.executionPlanFileViewMap.set(this._input.executionPlanFileViewUUID, currentView);
			currentView.render(this._container);
		}
		this.currentFileView = currentView;
	}

	public clear() {
	}
}
