/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { MessagePanel } from 'sql/workbench/contrib/query/browser/messagePanel';
import { GridPanel } from 'sql/workbench/contrib/query/browser/gridPanel';
import { ChartTab } from 'sql/workbench/contrib/charts/browser/chartTab';
import { QueryModelViewTab } from 'sql/workbench/contrib/query/browser/modelViewTab/queryModelViewTab';
import { GridPanelState } from 'sql/workbench/common/editor/query/gridTableState';

import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { dispose, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { attachTabbedPanelStyler } from 'sql/workbench/common/styler';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ILogService } from 'vs/platform/log/common/log';
import { ExecutionPlanTab } from 'sql/workbench/contrib/executionPlan/browser/executionPlanTab';
import { ExecutionPlanFileViewCache } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileViewCache';
import { TopOperationsTab } from 'sql/workbench/contrib/executionPlan/browser/topOperationsTab';
import { ExecutionPlanTreeTab } from 'sql/workbench/contrib/executionPlan/browser/executionPlanTreeTab';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';

class MessagesView extends Disposable implements IPanelView {
	private messagePanel: MessagePanel;
	private container = document.createElement('div');

	constructor(private instantiationService: IInstantiationService) {
		super();
		this.messagePanel = this._register(this.instantiationService.createInstance(MessagePanel));
		this.messagePanel.render(this.container);
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.width = `${dimension.width}px`;
		this.container.style.height = `${dimension.height}px`;
		this.messagePanel.layout(dimension);
	}

	public clear() {
		this.messagePanel.clear();
	}

	remove(): void {
		this.container.remove();
	}

	public set queryRunner(runner: QueryRunner) {
		this.messagePanel.queryRunner = runner;
	}
}

class ResultsView extends Disposable implements IPanelView {
	private gridPanel: GridPanel;
	private container = document.createElement('div');
	private _state: GridPanelState | undefined;
	private _runner: QueryRunner | undefined;

	constructor(private instantiationService: IInstantiationService) {
		super();
		this.gridPanel = this._register(this.instantiationService.createInstance(GridPanel));
		this.gridPanel.render(this.container);
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.width = `${dimension.width}px`;
		this.container.style.height = `${dimension.height}px`;
		this.gridPanel.layout(dimension);
	}

	public clear() {
		this.gridPanel.clear();
		this._runner = undefined;
	}

	remove(): void {
		this.container.remove();
	}

	onHide(): void {
		this._state = this.gridPanel.state;
		this.gridPanel.clear();
	}

	onShow(): void {
		if (this._state) {
			this.state = this._state;
			if (this._runner) {
				this.queryRunner = this._runner;
			}
		}
	}

	public set queryRunner(runner: QueryRunner) {
		this._runner = runner;
		this.gridPanel.queryRunner = runner;
	}

	public set state(val: GridPanelState) {
		this.gridPanel.state = val;
	}
}
class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', "Results");
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

class MessagesTab implements IPanelTab {
	public readonly title = nls.localize('messagesTabTitle', "Messages");
	public readonly identifier = 'messagesTab';
	public readonly view: MessagesView;

	constructor(instantiationService: IInstantiationService) {
		this.view = new MessagesView(instantiationService);
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
	private _input: QueryResultsInput | undefined;
	private resultsTab: ResultsTab;
	private messagesTab: MessagesTab;
	private chartTab: ChartTab;
	private executionPlanTab: ExecutionPlanTab;
	private topOperationsTab: TopOperationsTab;
	private planTreeTab: ExecutionPlanTreeTab;
	private dynamicModelViewTabs: QueryModelViewTab[] = [];

	private runnerDisposables = new DisposableStore();

	constructor(
		container: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService,
		@INotificationService private notificationService: INotificationService,
		@ILogService private logService: ILogService,
		@IAccessibilityService private accessibilityService: IAccessibilityService
	) {
		super();
		this.resultsTab = this._register(new ResultsTab(instantiationService));
		this.messagesTab = this._register(new MessagesTab(instantiationService));
		this.chartTab = this._register(new ChartTab(instantiationService));
		this._panelView = this._register(new TabbedPanel(container, { showHeaderWhenSingleView: true }));
		this._register(attachTabbedPanelStyler(this._panelView, themeService));
		this.executionPlanTab = this._register(this.instantiationService.createInstance(ExecutionPlanTab, this));
		this.topOperationsTab = this._register(this.instantiationService.createInstance(TopOperationsTab, this));
		this.planTreeTab = this._register(this.instantiationService.createInstance(ExecutionPlanTreeTab));
		this._panelView.pushTab(this.resultsTab);
		this._panelView.pushTab(this.messagesTab);
		this._register(this._panelView.onTabChange(e => {
			if (this.input) {
				this.input.state.activeTab = e;
			}
		}));
	}

	private hasResults(runner: QueryRunner): boolean {
		let hasResults = false;
		for (const batch of runner.batchSets) {
			if (batch.resultSetSummaries?.length > 0) {
				hasResults = true;
				break;
			}
		}
		return hasResults;
	}

	private setQueryRunner(runner: QueryRunner) {
		const activeTab = this._input?.state.activeTab;
		if (this.hasResults(runner)) {
			this.showResults();
		} else {
			if (runner.isExecuting) { // in case we don't have results yet, but we also have already started executing
				this.runnerDisposables.add(Event.once(runner.onResultSet)(() => this.showResults()));
			}
			this.hideResults();
		}
		this.resultsTab.queryRunner = runner;
		this.messagesTab.queryRunner = runner;
		this.chartTab.queryRunner = runner;
		this.runnerDisposables.add(runner.onQueryStart(e => {
			this.runnerDisposables.add(Event.once(runner.onResultSet)(() => this.showResults()));
			this.hideResults();
			this.hideChart();
			this.hideTopOperations();
			this.hidePlan();
			// clearing execution plans whenever a new query starts executing
			this.executionPlanTab.view.clearPlans();
			this.hideDynamicViewModelTabs();
			this.input?.state.visibleTabs.clear();
			if (this.input) {
				this.input.state.activeTab = this.resultsTab.identifier;
			}
		}));
		this.runnerDisposables.add(runner.onQueryEnd(() => {
			if (runner.messages.some(v => v.isError)) {
				this._panelView.showTab(this.messagesTab.identifier);
			}
			// Currently we only need to support visualization options for the first result set.
			const batchSet = runner.batchSets[0];
			const resultSet = batchSet?.resultSetSummaries?.[0];
			if (resultSet?.visualization) {
				this.chartData({
					resultId: batchSet.id,
					batchId: resultSet.batchId
				});
				this.chartTab.view.setVisualizationOptions(resultSet.visualization);
			}
		}));

		this.runnerDisposables.add(runner.onExecutionPlanAvailable(e => {
			if (this.executionPlanTab) {
				/**
				 * Adding execution plan graphs to execution plan file view
				 * when they become available
				 */
				const executionPlanFileViewCache = ExecutionPlanFileViewCache.getInstance();
				if (executionPlanFileViewCache) {
					const view = executionPlanFileViewCache.executionPlanFileViewMap.get(
						this.input.state.executionPlanState.executionPlanFileViewUUID
					);
					this.input.state.executionPlanState.graphs.push(...e.planGraphs);
					if (view) {
						view.addGraphs(e.planGraphs);
					}
					this.topOperationsTab.view.renderInput();
					this.planTreeTab.view.renderInput();
				}
			}
		}));

		if (this.input?.state.visibleTabs.has(this.chartTab.identifier) && !this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.pushTab(this.chartTab);
		} else if (!this.input?.state.visibleTabs.has(this.chartTab.identifier) && this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.removeTab(this.chartTab.identifier);
		}

		if (this.input?.state.visibleTabs.has(this.executionPlanTab.identifier) && !this._panelView.contains(this.executionPlanTab.identifier)) {
			this._panelView.pushTab(this.executionPlanTab);
		} else if (!this.input?.state.visibleTabs.has(this.executionPlanTab.identifier) && this._panelView.contains(this.executionPlanTab.identifier)) {
			this._panelView.removeTab(this.executionPlanTab.identifier);
		}

		if (this.input?.state.visibleTabs.has(this.topOperationsTab.identifier) && !this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.pushTab(this.topOperationsTab);
		} else if (!this.input?.state.visibleTabs.has(this.topOperationsTab.identifier) && this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.removeTab(this.topOperationsTab.identifier);
		}

		if (this.input?.state.visibleTabs.has(this.planTreeTab.identifier) && !this._panelView.contains(this.planTreeTab.identifier)) {
			this._panelView.pushTab(this.planTreeTab);
		} else if (!this.input?.state.visibleTabs.has(this.planTreeTab.identifier) && this._panelView.contains(this.planTreeTab.identifier)) {
			this._panelView.removeTab(this.planTreeTab.identifier);
		}

		// restore query model view tabs
		this.dynamicModelViewTabs.forEach(tab => {
			if (this._panelView.contains(tab.identifier)) {
				this._panelView.removeTab(tab.identifier);
			}
		});
		this.dynamicModelViewTabs = [];

		this.input?.state.visibleTabs.forEach(tabId => {
			if (tabId.startsWith('querymodelview;')) {
				// tab id format is 'tab type;title;model view id'
				let parts = tabId.split(';');
				if (parts.length === 3) {
					let tab = this._register(new QueryModelViewTab(parts[1], this.instantiationService));
					tab.view.componentId = parts[2];
					this.dynamicModelViewTabs.push(tab);
					if (!this._panelView.contains(tab.identifier)) {
						this._panelView.pushTab(tab, undefined, true);
					}
				}
			}
		});

		this.runnerDisposables.add(runner.onQueryEnd(() => {
			if (runner.isQueryPlan) {
				runner.planXml.then(e => {
					this.showPlan();
					this.showTopOperations(e);
				});
			}
		}));
		if (activeTab) {
			this._panelView.showTab(activeTab);
		} else {
			this._panelView.showTab(this.resultsTab.identifier); // our default tab is the results view
		}
	}

	private showQueryEditorError(): void {
		this.notificationService.error(nls.localize('queryResults.queryEditorCrashError', "The query editor ran into an issue and has stopped working. Please save and reopen it."));
	}

	public set input(input: QueryResultsInput | undefined) {
		try {
			this._input = input;
			this.runnerDisposables.clear();

			[this.resultsTab, this.messagesTab, this.executionPlanTab, this.planTreeTab, this.topOperationsTab, this.chartTab].forEach(t => t.clear());
			this.dynamicModelViewTabs.forEach(t => t.clear());

			if (input) {
				this.resultsTab.view.state = input.state.gridPanelState;
				this.topOperationsTab.view.state = input.state.executionPlanState;
				this.chartTab.view.state = input.state.chartState;
				this.executionPlanTab.view.state = input.state.executionPlanState;
				this.planTreeTab.view.state = input.state.executionPlanState;

				this.dynamicModelViewTabs.forEach((dynamicTab: QueryModelViewTab) => {
					dynamicTab.captureState(input.state.dynamicModelViewTabsState);
				});
				let info = this.queryModelService._getQueryInfo(input.uri) || this.queryModelService._getQueryInfo(URI.parse(input.uri).toString(true));

				if (info?.queryRunner?.isDisposed) {
					this.logService.error(`The query runner for '${input.uri}' has been disposed.`);
					this.showQueryEditorError();
					return;
				}

				if (info?.queryRunner) {
					this.setQueryRunner(info.queryRunner);
				} else {
					let disposable = this.queryModelService.onRunQueryStart(c => {
						if (URI.parse(c).toString() === URI.parse(input.uri).toString()) {
							let info = this.queryModelService._getQueryInfo(c);
							if (info?.queryRunner) {
								this.setQueryRunner(info.queryRunner);
							}
							disposable.dispose();
						}
					});
					this.runnerDisposables.add(disposable);
				}
			}
		} catch (err) {
			this.logService.error(err);
			this.showQueryEditorError();
		}
	}

	clearInput() {
		this._input = undefined;
		this.runnerDisposables.clear();
		this.resultsTab.clear();
		this.messagesTab.clear();
		this.topOperationsTab.clear();
		this.chartTab.clear();
		this.executionPlanTab.clear();
		this.planTreeTab.clear();
		this.dynamicModelViewTabs.forEach(t => t.clear());
	}

	public get input(): QueryResultsInput | undefined {
		return this._input;
	}

	public layout(dimension: DOM.Dimension) {
		this._panelView.layout(dimension);
	}

	public chartData(dataId: { resultId: number, batchId: number }): void {
		this.input?.state.visibleTabs.add(this.chartTab.identifier);
		if (!this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.pushTab(this.chartTab);
		}

		this._panelView.showTab(this.chartTab.identifier);
		this.chartTab.chart(dataId);
	}

	public hideChart() {
		if (this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.removeTab(this.chartTab.identifier);
		}
	}

	public hideResults() {
		if (this._panelView.contains(this.resultsTab.identifier)) {
			this._panelView.removeTab(this.resultsTab.identifier);
		}
	}

	public showResults() {
		if (!this._panelView.contains(this.resultsTab.identifier)) {
			this._panelView.pushTab(this.resultsTab, 0);
		}
		this._panelView.showTab(this.resultsTab.identifier);
	}

	public showTopOperations(xml: string) {
		this.input?.state.visibleTabs.add(this.topOperationsTab.identifier);
		if (!this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.pushTab(this.topOperationsTab);
		}
	}

	public switchToTopOperationsTab() {
		this._panelView.showTab(this.topOperationsTab.identifier);
	}

	public scrollToTable(planId: number) {
		this.topOperationsTab.view.scrollToIndex(planId);
	}

	public showPlan() {
		if (!this._panelView.contains(this.executionPlanTab.identifier)) {
			this.input?.state.visibleTabs.add(this.executionPlanTab.identifier);
			if (!this._panelView.contains(this.executionPlanTab.identifier)) {
				this._panelView.pushTab(this.executionPlanTab);
			}
			this._panelView.showTab(this.executionPlanTab.identifier);
		}

		if (!this._panelView.contains(this.planTreeTab.identifier)) {
			this.input?.state.visibleTabs.add(this.planTreeTab.identifier);
			if (!this._panelView.contains(this.planTreeTab.identifier)) {
				this._panelView.pushTab(this.planTreeTab);
			}

			// Switching to plan tree as default view when screen reader mode is on.
			if (this.accessibilityService.isScreenReaderOptimized()) {
				this._panelView.showTab(this.planTreeTab.identifier);
			}
		}
	}

	public switchToExecutionPlanTab() {
		this._panelView.showTab(this.executionPlanTab.identifier);
	}

	public focusOnNode(planId: number, nodeId: string) {
		this.executionPlanTab.view.currentFileView.scrollToNode(planId, nodeId);
	}

	public hideTopOperations() {
		if (this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.removeTab(this.topOperationsTab.identifier);
		}
	}

	public hidePlan() {
		if (this._panelView.contains(this.executionPlanTab.identifier)) {
			this._panelView.removeTab(this.executionPlanTab.identifier);
			this.executionPlanTab.clear();
		}
		if (this._panelView.contains(this.planTreeTab.identifier)) {
			this._panelView.removeTab(this.planTreeTab.identifier);
			this.planTreeTab.clear();
		}
	}

	public hideDynamicViewModelTabs() {
		this.dynamicModelViewTabs.forEach(tab => {
			if (this._panelView.contains(tab.identifier)) {
				this._panelView.removeTab(tab.identifier);
			}
		});

		this.dynamicModelViewTabs = [];
	}

	public override dispose() {
		this.runnerDisposables.dispose();
		this.runnerDisposables = new DisposableStore();
		super.dispose();
	}

	public registerQueryModelViewTab(title: string, componentId: string): void {
		let tab = this._register(new QueryModelViewTab(title, this.instantiationService));
		tab.view.componentId = componentId;
		this.dynamicModelViewTabs.push(tab);

		this.input?.state.visibleTabs.add('querymodelview;' + title + ';' + componentId);
		if (!this._panelView.contains(tab.identifier)) {
			this._panelView.pushTab(tab, undefined, true);
		}

		if (this.input) {
			tab.putState(this.input.state.dynamicModelViewTabsState);
		}
	}

	public focus(): void {
		this._panelView.focusCurrentTab();
	}
}
