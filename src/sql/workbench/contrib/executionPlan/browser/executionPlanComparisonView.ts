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
import { ISashEvent, ISashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';

export class ExecutionPlanComparisonView implements ISashLayoutProvider {
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

	private _sashContainer: HTMLElement;
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

		this._sashContainer = DOM.$('.execution-plan-sash');
		this._container.appendChild(this._sashContainer);
		// resizing sash for the query plan.
		const sash = new Sash(this._sashContainer, this, { orientation: Orientation.HORIZONTAL, size: 3 });
		let originalHeight = this._container.offsetHeight;
		let change = 0;
		sash.onDidStart((e: ISashEvent) => {
			originalHeight = this._container.offsetHeight;
		});

		/**
		 * Using onDidChange for the smooth resizing of the graph diagram
		 */
		sash.onDidChange((evt: ISashEvent) => {
			change = evt.startY - evt.currentY;
			const newHeight = originalHeight + change;
			if (newHeight < 200) {
				return;
			}
			/**
			 * Since the parent container is flex, we will have
			 * to change the flex-basis property to change the height.
			 */
			this._container.style.minHeight = '200px';
			this._container.style.flex = `0 0 ${newHeight}px`;
		});

		/**
		 * Resizing properties window table only once at the end as it is a heavy operation and worsens the smooth resizing experience
		 */
		sash.onDidEnd(() => {

		});


		this._onCellSelectedEvent = this._onCellSelectedEmitter.event;
	}

	getHorizontalSashTop(sash: Sash): number {
		return 0;
	}
	getHorizontalSashLeft?(sash: Sash): number {
		return 0;
	}
	getHorizontalSashWidth?(sash: Sash): number {
		return this._container.clientWidth;
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
			this._container.insertBefore(graphContainer, this._sashContainer);
			graphContainer.style.display = 'none';
		});

		this.graphContainer[0].style.display = '';
		this.azdataGraphDiagram[0].selectElement(undefined);
		this._onCellSelectedEmitter.fire(executionPlan[0].root);
		this._dropdownContainer.style.display = '';
		this.loadingSpinner.loading = false;
	}
}
