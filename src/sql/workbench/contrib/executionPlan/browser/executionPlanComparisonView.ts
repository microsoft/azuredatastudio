/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { AzdataGraphView, InternalExecutionPlanEdge, InternalExecutionPlanNode } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { Event, Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';

export class ExecutionPlanComparisonView {
	private graphContainer: HTMLElement[] = [];
	public azdataGraphDiagram: AzdataGraphView[] = [];

	private _executionPlanGraph: azdata.executionPlan.ExecutionPlanGraph[] = [];

	public graphElementPropertiesSet: Set<string> = new Set();

	private _container: HTMLElement;

	private _dropdown: SelectBox;
	private _dropdownContainer: HTMLElement;


	private loadingSpinner: LoadingSpinner;

	public _onCellSelectedEmitter: Emitter<InternalExecutionPlanEdge | InternalExecutionPlanNode> = new Emitter<InternalExecutionPlanNode | InternalExecutionPlanEdge>();
	public _onCellSelectedEvent: Event<InternalExecutionPlanNode | InternalExecutionPlanEdge>;


	constructor(
		parent: HTMLElement,
		placeholder: HTMLElement,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IExecutionPlanService executionPlanService: IExecutionPlanService,
		@IContextViewService readonly contextViewService: IContextViewService
	) {

		this._container = DOM.$('.plan');
		parent.insertBefore(this._container, placeholder);

		this.loadingSpinner = new LoadingSpinner(this._container, { showText: true, fullSize: true });
		this.loadingSpinner.loading = true;

		this._dropdown = new SelectBox([], 0, contextViewService);

		this._dropdown.onDidSelect(e => {
			this.graphContainer.forEach(c => {
				c.style.display = 'none';
			});
			this.graphContainer[e.index].style.display = '';
			this.azdataGraphDiagram[e.index].selectElement(undefined);
			this._onCellSelectedEmitter.fire(this._executionPlanGraph[e.index].root);
		});

		this._dropdownContainer = DOM.$('.plan-dropdown-container');
		this._dropdownContainer.style.display = 'none';
		this._dropdown.render(this._dropdownContainer);
		this._container.append(this._dropdownContainer);

		this._onCellSelectedEvent = this._onCellSelectedEmitter.event;
	}

	private createPlanDiagram(container: HTMLElement, executionPlan: azdata.executionPlan.ExecutionPlanGraph, index: number) {
		const diagram = this._instantiationService.createInstance(AzdataGraphView, container, executionPlan);
		diagram.onElementSelected(e => {
			this._onCellSelectedEmitter.fire(e);
		});
		return {
			diagram: diagram
		};
	}

	public addGraphs(executionPlan: azdata.executionPlan.ExecutionPlanGraph[]) {
		this._executionPlanGraph = executionPlan;
		this._dropdown.setOptions(executionPlan.map(e => {
			return {
				text: e.query
			};
		}), 0);
		executionPlan.forEach((e, i) => {
			const graphContainer = DOM.$('.plan-diagram');
			this.graphContainer.push(graphContainer);
			const diagramClose = this.createPlanDiagram(graphContainer, e, i);
			this.azdataGraphDiagram.push(diagramClose.diagram);
			this._container.append(graphContainer);
			graphContainer.style.display = 'none';
		});

		this.graphContainer[0].style.display = '';
		this.azdataGraphDiagram[0].selectElement(undefined);
		this._onCellSelectedEmitter.fire(executionPlan[0].root);
		this._dropdownContainer.style.display = '';
		this.loadingSpinner.loading = false;
	}
}
