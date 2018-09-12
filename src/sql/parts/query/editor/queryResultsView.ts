/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from '../execution/queryModel';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { MessagePanel } from './messagePanel';
import { GridPanel } from './gridPanel';
import { ChartTab } from './charting/chartTab';
import { QueryPlanTab } from 'sql/parts/queryPlan/queryPlan';

import * as nls from 'vs/nls';
import * as UUID from 'vs/base/common/uuid';
import { PanelViewlet } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { once } from 'vs/base/common/event';

class ResultsView implements IPanelView {
	private panelViewlet: PanelViewlet;
	private gridPanel: GridPanel;
	private messagePanel: MessagePanel;
	private container = document.createElement('div');
	private currentDimension: DOM.Dimension;
	private isGridRendered = false;
	private lastGridHeight: number;

	constructor(instantiationService: IInstantiationService) {
		this.panelViewlet = instantiationService.createInstance(PanelViewlet, 'resultsView', { showHeaderInTitleWhenSingleView: false });
		this.gridPanel = instantiationService.createInstance(GridPanel, { title: nls.localize('gridPanel', 'Results'), id: 'gridPanel' });
		this.messagePanel = instantiationService.createInstance(MessagePanel, { title: nls.localize('messagePanel', 'Messages'), minimumBodySize: 0, id: 'messagePanel' });
		this.gridPanel.render();
		this.messagePanel.render();
		this.panelViewlet.create(this.container).then(() => {
			this.panelViewlet.addPanels([
				{ panel: this.messagePanel, size: this.messagePanel.minimumSize, index: 1 }
			]);
		});
		this.gridPanel.onDidChange(e => {
			let size = this.gridPanel.maximumBodySize;
			if (this.isGridRendered) {
				if (size < 1) {
					this.lastGridHeight = this.panelViewlet.getPanelSize(this.gridPanel);
					this.panelViewlet.removePanels([this.gridPanel]);
					// tell the panel is has been removed.
					this.gridPanel.layout(0);
					this.isGridRendered = false;
				}
			} else {
				if (size > 0) {
					this.panelViewlet.addPanels([
						{ panel: this.gridPanel, index: 0, size: this.lastGridHeight ||Math.round(this.currentDimension.height * .8)  }
					]);
					this.isGridRendered = true;
				}
			}
		});
		let gridResizeList = this.gridPanel.onDidChange(e => {
			this.panelViewlet.resizePanel(this.gridPanel, Math.round(this.currentDimension.height * .8));
		});
		// once the user changes the sash we should stop trying to resize the grid
		once(this.panelViewlet.onDidSashChange)(e => {
			gridResizeList.dispose();
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.panelViewlet.layout(dimension);
		// the grid won't be resize if the height has not changed so we need to do it manually
		if (this.currentDimension && dimension.height === this.currentDimension.height) {
			this.gridPanel.layout(dimension.height);
		}
		this.currentDimension = dimension;
	}

	remove(): void {
		this.container.remove();
	}

	public set queryRunner(runner: QueryRunner) {
		this.gridPanel.queryRunner = runner;
		this.messagePanel.queryRunner = runner;
	}

	public hideResultHeader() {
		this.gridPanel.headerVisible = false;
	}
}

class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', 'Results');
	public readonly identifier = UUID.generateUuid();
	public readonly view: ResultsView;

	constructor(instantiationService: IInstantiationService) {
		this.view = new ResultsView(instantiationService);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}
}

export class QueryResultsView {
	private _panelView: TabbedPanel;
	private _input: QueryResultsInput;
	private resultsTab: ResultsTab;
	private chartTab: ChartTab;
	private qpTab: QueryPlanTab;

	constructor(
		container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService
	) {
		this.resultsTab = new ResultsTab(instantiationService);
		this.chartTab = new ChartTab(instantiationService);
		this._panelView = new TabbedPanel(container, { showHeaderWhenSingleView: false });
		this.qpTab = new QueryPlanTab();
	}

	public style() {
	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		let queryRunner = this.queryModelService._getQueryInfo(input.uri).queryRunner;
		this.resultsTab.queryRunner = queryRunner;
		this.chartTab.queryRunner = queryRunner;
		if (!this._panelView.contains(this.resultsTab)) {
			this._panelView.pushTab(this.resultsTab);
		}
	}

	public dispose() {
		this._panelView.dispose();
	}

	public get input(): QueryResultsInput {
		return this._input;
	}

	public layout(dimension: DOM.Dimension) {
		this._panelView.layout(dimension);
	}

	public chartData(dataId: { resultId: number, batchId: number }): void {
		if (!this._panelView.contains(this.chartTab)) {
			this._panelView.pushTab(this.chartTab);
		}

		this._panelView.showTab(this.chartTab.identifier);
		this.chartTab.chart(dataId);
	}

	public showPlan(xml: string) {
		if (!this._panelView.contains(this.qpTab)) {
			this._panelView.pushTab(this.qpTab);
		}

		this._panelView.showTab(this.qpTab.identifier);
		this.qpTab.view.showPlan(xml);
	}
}
