/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsInput, ResultsViewState } from 'sql/workbench/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { MessagePanel } from './messagePanel';
import { GridPanel } from '../electron-browser/gridPanel';
import { ChartTab } from '../../charts/browser/chartTab';
import { QueryPlanTab } from 'sql/workbench/parts/queryPlan/electron-browser/queryPlan';
import { TopOperationsTab } from 'sql/workbench/parts/queryPlan/browser/topOperations';
import { QueryModelViewTab } from 'sql/workbench/parts/query/modelViewTab/queryModelViewTab';

import * as nls from 'vs/nls';
import { PanelViewlet } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { attachTabbedPanelStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

class ResultsView extends Disposable implements IPanelView {
	private panelViewlet: PanelViewlet;
	private gridPanel: GridPanel;
	private messagePanel: MessagePanel;
	private container = document.createElement('div');
	private currentDimension: DOM.Dimension;
	private _state: ResultsViewState;

	constructor(private instantiationService: IInstantiationService) {
		super();
		this.panelViewlet = this._register(this.instantiationService.createInstance(PanelViewlet, 'resultsView', { showHeaderInTitleWhenSingleView: false }));
		this.gridPanel = this._register(this.instantiationService.createInstance(GridPanel, { title: nls.localize('gridPanel', 'Results'), id: 'gridPanel' }));
		this.messagePanel = this._register(this.instantiationService.createInstance(MessagePanel, { title: nls.localize('messagePanel', 'Messages'), minimumBodySize: 0, id: 'messagePanel' }));
		this.gridPanel.render();
		this.messagePanel.render();
		this.panelViewlet.create(this.container);
		this.gridPanel.setVisible(false);
		this.panelViewlet.addPanels([
			{ panel: this.messagePanel, size: this.messagePanel.minimumSize, index: 1 }
		]);
		Event.any(this.gridPanel.onDidChange, this.messagePanel.onDidChange)(e => {
			let size = this.gridPanel.maximumBodySize;
			if (size < 1 && this.gridPanel.isVisible()) {
				this.gridPanel.setVisible(false);
				this.panelViewlet.removePanels([this.gridPanel]);
				this.gridPanel.layout(0);
			} else if (size > 0 && !this.gridPanel.isVisible()) {
				this.gridPanel.setVisible(true);
				this.panelViewlet.addPanels([{ panel: this.gridPanel, index: 0, size: 200 }]);
			}
			if (this.gridPanel.isVisible()) {
				if (this.state.messagePanelSize) {
					this.panelViewlet.resizePanel(this.messagePanel, this.state.messagePanelSize);
				}
				this.panelViewlet.resizePanel(this.gridPanel, this.getGridPanelSize());
			}
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
		// the grid won't be resized if the height has not changed so we need to do it manually
		if (this.currentDimension && dimension.height === this.currentDimension.height) {
			this.gridPanel.layout(dimension.height);
		}
		this.currentDimension = dimension;

		// resize the messages and grid panels
		this.panelViewlet.resizePanel(this.gridPanel, this.getGridPanelSize());
		// we have the right scroll position saved as part of gridPanel state, use this to re-position scrollbar
		this.gridPanel.resetScrollPosition();

		if (this.state.messagePanelSize) {
			this.panelViewlet.resizePanel(this.messagePanel, this.state.messagePanelSize);
		}
	}

	dispose() {
		super.dispose();
	}

	public clear() {
		this.gridPanel.clear();
		this.messagePanel.clear();
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

	private getGridPanelSize(): number {
		if (this.state && this.state.gridPanelSize) {
			return this.state.gridPanelSize;
		} else if (this.currentDimension) {
			return Math.round(Math.max(this.currentDimension.height * 0.7, this.currentDimension.height - 150));
		} else {
			return 200;
		}
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

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryResultsView extends Disposable {
	private _panelView: TabbedPanel;
	private _input: QueryResultsInput;
	private resultsTab: ResultsTab;
	private chartTab: ChartTab;
	private qpTab: QueryPlanTab;
	private topOperationsTab: TopOperationsTab;
	private dynamicModelViewTabs: QueryModelViewTab[] = [];

	private runnerDisposables: IDisposable[];

	constructor(
		container: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService,
		@IThemeService themeService: IThemeService
	) {
		super();
		this.resultsTab = this._register(new ResultsTab(instantiationService));
		this.chartTab = this._register(new ChartTab(instantiationService));
		this._panelView = this._register(new TabbedPanel(container, { showHeaderWhenSingleView: false }));
		attachTabbedPanelStyler(this._panelView, themeService);
		this.qpTab = this._register(new QueryPlanTab());
		this.topOperationsTab = this._register(new TopOperationsTab(instantiationService));

		attachTabbedPanelStyler(this._panelView, themeService);

		this._panelView.pushTab(this.resultsTab);
		this._register(this._panelView.onTabChange(e => {
			if (this.input) {
				this.input.state.activeTab = e;
			}
		}));
	}

	public style() {
	}

	private setQueryRunner(runner: QueryRunner) {
		this.resultsTab.queryRunner = runner;
		this.chartTab.queryRunner = runner;
		this.runnerDisposables.push(runner.onQueryStart(e => {
			this.hideChart();
			this.hidePlan();
			this.hideDynamicViewModelTabs();
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
		if (this.input.state.visibleTabs.has(this.topOperationsTab.identifier)) {
			if (!this._panelView.contains(this.topOperationsTab)) {
				this._panelView.pushTab(this.topOperationsTab);
			}
		}

		// restore query model view tabs
		this.input.state.visibleTabs.forEach(tabId => {
			if (tabId.startsWith('querymodelview;')) {
				// tab id format is 'tab type;title;model view id'
				let parts = tabId.split(';');
				if (parts.length === 3) {
					let tab = this._register(new QueryModelViewTab(parts[1], this.instantiationService));
					tab.view._componentId = parts[2];
					this.dynamicModelViewTabs.push(tab);
					if (!this._panelView.contains(tab)) {
						this._panelView.pushTab(tab);
					}
				}
			}
		});

		this.runnerDisposables.push(runner.onQueryEnd(() => {
			if (runner.isQueryPlan) {
				runner.planXml.then(e => {
					this.showPlan(e);
				});
			}
		}));
		if (this.input.state.activeTab) {
			this._panelView.showTab(this.input.state.activeTab);
		}
	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		dispose(this.runnerDisposables);
		this.runnerDisposables = [];
		this.resultsTab.view.state = this.input.state;
		this.qpTab.view.state = this.input.state.queryPlanState;
		this.topOperationsTab.view.state = this.input.state.topOperationsState;
		this.chartTab.view.state = this.input.state.chartState;

		let info = this.queryModelService._getQueryInfo(input.uri);
		if (info) {
			this.setQueryRunner(info.queryRunner);
		} else {
			let disposeable = this.queryModelService.onRunQueryStart(c => {
				if (c === input.uri) {
					let info = this.queryModelService._getQueryInfo(input.uri);
					this.setQueryRunner(info.queryRunner);
					disposeable.dispose();
				}
			});
		}
	}

	clearInput() {
		this._input = undefined;
		this.resultsTab.clear();
		this.qpTab.clear();
		this.topOperationsTab.clear();
		this.chartTab.clear();
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
		this.input.state.visibleTabs.add(this.topOperationsTab.identifier);
		if (!this._panelView.contains(this.topOperationsTab)) {
			this._panelView.pushTab(this.topOperationsTab);
		}

		this._panelView.showTab(this.qpTab.identifier);
		this.qpTab.view.showPlan(xml);
		this.topOperationsTab.view.showPlan(xml);
	}

	public hidePlan() {
		if (this._panelView.contains(this.qpTab)) {
			this._panelView.removeTab(this.qpTab.identifier);
		}

		if (this._panelView.contains(this.topOperationsTab)) {
			this._panelView.removeTab(this.topOperationsTab.identifier);
		}
	}

	public hideDynamicViewModelTabs() {
		this.dynamicModelViewTabs.forEach(tab => {
			if (this._panelView.contains(tab)) {
				this._panelView.removeTab(tab.identifier);
			}
		});

		this.dynamicModelViewTabs = [];
	}

	public dispose() {
		dispose(this.runnerDisposables);
		super.dispose();
	}

	public registerQueryModelViewTab(title: string, componentId: string): void {
		let tab = this._register(new QueryModelViewTab(title, this.instantiationService));
		tab.view._componentId = componentId;
		this.dynamicModelViewTabs.push(tab);

		this.input.state.visibleTabs.add('querymodelview;' + title + ';' + componentId);
		if (!this._panelView.contains(tab)) {
			this._panelView.pushTab(tab);
		}
	}
}
