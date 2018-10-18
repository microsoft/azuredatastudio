/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { QueryResultsInput, ResultsViewState } from 'sql/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from '../execution/queryModel';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { MessagePanel } from './messagePanel';
import { GridPanel } from './gridPanel';
import { ChartTab } from './charting/chartTab';
import { QueryPlanTab } from 'sql/parts/queryPlan/queryPlan';

import * as nls from 'vs/nls';
import { PanelViewlet } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { once, anyEvent } from 'vs/base/common/event';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

class ResultsView implements IPanelView {
	private panelViewlet: PanelViewlet;
	private gridPanel: GridPanel;
	private messagePanel: MessagePanel;
	private container = document.createElement('div');
	private currentDimension: DOM.Dimension;
	private needsGridResize = false;
	private _state: ResultsViewState;

	constructor(private instantiationService: IInstantiationService) {

		this.panelViewlet = this.instantiationService.createInstance(PanelViewlet, 'resultsView', { showHeaderInTitleWhenSingleView: false });
		this.gridPanel = this.instantiationService.createInstance(GridPanel, { title: nls.localize('gridPanel', 'Results'), id: 'gridPanel' });
		this.messagePanel = this.instantiationService.createInstance(MessagePanel, { title: nls.localize('messagePanel', 'Messages'), minimumBodySize: 0, id: 'messagePanel' });
		this.gridPanel.render();
		this.messagePanel.render();
		this.panelViewlet.create(this.container).then(() => {
			this.gridPanel.setVisible(false);
			this.panelViewlet.addPanels([
				{ panel: this.messagePanel, size: this.messagePanel.minimumSize, index: 1 }
			]);
		});
		anyEvent(this.gridPanel.onDidChange, this.messagePanel.onDidChange)(e => {
			let size = this.gridPanel.maximumBodySize;
			if (size < 1 && this.gridPanel.isVisible()) {
				this.gridPanel.setVisible(false);
				this.panelViewlet.removePanels([this.gridPanel]);
				this.gridPanel.layout(0);
			} else if (size > 0 && !this.gridPanel.isVisible()) {
				this.gridPanel.setVisible(true);
				let panelSize: number;
				if (this.state && this.state.gridPanelSize) {
					panelSize = this.state.gridPanelSize;
				} else if (this.currentDimension) {
					panelSize = Math.round(this.currentDimension.height * .7);
				} else {
					panelSize = 200;
					this.needsGridResize = true;
				}
				this.panelViewlet.addPanels([{ panel: this.gridPanel, index: 0, size: panelSize }]);
			}
		});
		let resizeList = anyEvent(this.gridPanel.onDidChange, this.messagePanel.onDidChange)(() => {
			let panelSize: number;
			if (this.state && this.state.gridPanelSize) {
				panelSize = this.state.gridPanelSize;
			} else if (this.currentDimension) {
				panelSize = Math.round(this.currentDimension.height * .7);
			} else {
				panelSize = 200;
				this.needsGridResize = true;
			}
			if (this.state.messagePanelSize) {
				this.panelViewlet.resizePanel(this.gridPanel, this.state.messagePanelSize);
			}
			this.panelViewlet.resizePanel(this.gridPanel, panelSize);
		});
		// once the user changes the sash we should stop trying to resize the grid
		once(this.panelViewlet.onDidSashChange)(e => {
			this.needsGridResize = false;
			resizeList.dispose();
		});

		this.panelViewlet.onDidSashChange(e => {
			if (this.state) {
				if (this.gridPanel.isExpanded()) {
					this.state.gridPanelSize = this.panelViewlet.getPanelSize(this.gridPanel);
				}
				if (this.messagePanel.isExpanded()) {
					this.state.messagePanelSize = this.panelViewlet.getPanelSize(this.messagePanel);
				}
			}
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
		if (this.needsGridResize) {
			this.panelViewlet.resizePanel(this.gridPanel, this.state.gridPanelSize || Math.round(this.currentDimension.height * .7));
		}
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

	public set state(val: ResultsViewState) {
		this._state = val;
		this.gridPanel.state = val.gridPanelState;
		this.messagePanel.state = val.messagePanelState;
	}

	public get state(): ResultsViewState {
		return this._state;
	}
}

class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', 'Results');
	public readonly identifier = 'resultsTab';
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

	private runnerDisposables: IDisposable[];

	constructor(
		container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService
	) {
		this.resultsTab = new ResultsTab(instantiationService);
		this.chartTab = new ChartTab(instantiationService);
		this._panelView = new TabbedPanel(container, { showHeaderWhenSingleView: false });
		this.qpTab = new QueryPlanTab();
		this._panelView.pushTab(this.resultsTab);
		this._panelView.onTabChange(e => {
			if (this.input) {
				this.input.state.activeTab = e;
			}
		});
	}

	public style() {
	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		dispose(this.runnerDisposables);
		this.runnerDisposables = [];
		this.resultsTab.view.state = this.input.state;
		this.qpTab.view.state = this.input.state.queryPlanState;
		this.chartTab.view.state = this.input.state.chartState;
		let queryRunner = this.queryModelService._getQueryInfo(input.uri).queryRunner;
		this.resultsTab.queryRunner = queryRunner;
		this.chartTab.queryRunner = queryRunner;
		this.runnerDisposables.push(queryRunner.onQueryStart(e => {
			this.hideChart();
			this.hidePlan();
			this.input.state.visibleTabs = new Set();
			this.input.state.activeTab = this.resultsTab.identifier;
		}));
		if (this.input.state.visibleTabs.has(this.chartTab.identifier)) {
			if (!this._panelView.contains(this.chartTab)) {
				this._panelView.pushTab(this.chartTab);
			}
		}
		if (this.input.state.visibleTabs.has(this.qpTab.identifier)) {
			if (!this._panelView.contains(this.qpTab)) {
				this._panelView.pushTab(this.qpTab);
			}
		}
		this.runnerDisposables.push(queryRunner.onQueryEnd(() => {
			if (queryRunner.isQueryPlan) {
				queryRunner.planXml.then(e => {
					this.showPlan(e);
				});
			}
		}));
		if (this.input.state.activeTab) {
			this._panelView.showTab(this.input.state.activeTab);
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
		this.input.state.visibleTabs.add(this.chartTab.identifier);
		if (!this._panelView.contains(this.chartTab)) {
			this._panelView.pushTab(this.chartTab);
		}

		this._panelView.showTab(this.chartTab.identifier);
		this.chartTab.chart(dataId);
	}

	public hideChart() {
		if (this._panelView.contains(this.chartTab)) {
			this._panelView.removeTab(this.chartTab.identifier);
		}
	}

	public showPlan(xml: string) {
		this.input.state.visibleTabs.add(this.qpTab.identifier);
		if (!this._panelView.contains(this.qpTab)) {
			this._panelView.pushTab(this.qpTab);
		}

		this._panelView.showTab(this.qpTab.identifier);
		this.qpTab.view.showPlan(xml);
	}

	public hidePlan() {
		if (this._panelView.contains(this.qpTab)) {
			this._panelView.removeTab(this.qpTab.identifier);
		}
	}
}
