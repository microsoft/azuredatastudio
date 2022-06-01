/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryEditor';

import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import * as path from 'vs/base/common/path';
import { IEditorControl, IEditorMemento, IEditorOpenContext } from 'vs/workbench/common/editor';
import { EditorPane, EditorMemento } from 'vs/workbench/browser/parts/editor/editorPane';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TextResourceEditor } from 'vs/workbench/browser/parts/editor/textResourceEditor';
import { TextFileEditor } from 'vs/workbench/contrib/files/browser/editors/textFileEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorGroup, IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { Event } from 'vs/base/common/event';
import { dispose, DisposableStore, Disposable } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';
import { IFileService, FileChangesEvent } from 'vs/platform/files/common/files';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IModeService } from 'vs/editor/common/services/modeService';
import { QueryEditorInput, IQueryEditorStateChange } from 'sql/workbench/common/editor/query/queryEditorInput';
import * as queryContext from 'sql/workbench/contrib/query/common/queryContext';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import * as actions from 'sql/workbench/contrib/query/browser/queryActions';
import { IRange } from 'vs/editor/common/core/range';
import { UntitledQueryEditorInput } from 'sql/base/query/browser/untitledQueryEditorInput';
import { IActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionOptionSpecialType } from 'sql/platform/connection/common/interfaces';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { GridPanelState } from 'sql/workbench/common/editor/query/gridTableState';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { MessagePanel } from 'sql/workbench/contrib/query/browser/messagePanel';
import { GridPanel } from 'sql/workbench/contrib/query/browser/gridPanel';
import { ChartTab } from 'sql/workbench/contrib/charts/browser/chartTab';
import { TopOperationsTab } from 'sql/workbench/contrib/queryPlan/browser/topOperations';
import { QueryModelViewTab } from 'sql/workbench/contrib/query/browser/modelViewTab/queryModelViewTab';
import { ExecutionPlanTab } from 'sql/workbench/contrib/executionPlan/browser/executionPlanTab';
import { attachTabbedPanelStyler } from 'sql/workbench/common/styler';
import * as types from 'vs/base/common/types';
import { getPixelRatio, getZoomLevel } from 'vs/base/browser/browser';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { ExecutionPlanFileViewCache } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileViewCache';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { ILogService } from 'vs/platform/log/common/log';

const QUERY_EDITOR_VIEW_STATE_PREFERENCE_KEY = 'queryEditorViewState';

export class BareResultsGridInfo extends BareFontInfo {

	public static override createFromRawSettings(opts: {
		fontFamily?: string;
		fontWeight?: string;
		fontSize?: number;
		lineHeight?: number;
		letterSpacing?: number;
		cellPadding?: number | number[];
	}, zoomLevel: number): BareResultsGridInfo {
		let cellPadding = !types.isUndefinedOrNull(opts.cellPadding) ? opts.cellPadding : RESULTS_GRID_DEFAULTS.cellPadding;
		return new BareResultsGridInfo(BareFontInfo.createFromRawSettings(opts, zoomLevel, getPixelRatio()), { cellPadding });
	}

	readonly cellPadding: number | number[];

	protected constructor(fontInfo: BareFontInfo, opts: {
		cellPadding: number | number[];
	}) {
		super(fontInfo);
		this.cellPadding = opts.cellPadding;
	}
}

export function getBareResultsGridInfoStyles(info: BareResultsGridInfo): string {
	let content = '';
	if (info.fontFamily) {
		content += `font-family: ${info.fontFamily};`;
	}
	if (info.fontWeight) {
		content += `font-weight: ${info.fontWeight};`;
	}
	if (info.fontSize) {
		content += `font-size: ${info.fontSize}px;`;
	}
	if (info.lineHeight) {
		content += `line-height: ${info.lineHeight}px;`;
	}
	if (info.letterSpacing) {
		content += `letter-spacing: ${info.letterSpacing}px;`;
	}
	return content;
}

interface IQueryEditorViewState {
	resultsHeight: number | undefined;
}

class TextResourceEditorView extends Disposable implements IPanelView {
	public textResourceEditor: TextResourceEditor;
	private container: HTMLElement;


	constructor(inputTextResourceEditor: TextResourceEditor, inputContainer: HTMLElement) {
		super();
		this.textResourceEditor = inputTextResourceEditor;
		this.container = inputContainer;
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.width = `${dimension.width}px`;
		this.container.style.height = `${dimension.height}px`;
		this.textResourceEditor.layout(dimension);
	}

	public clear() {
		this.textResourceEditor.clearInput();
	}

	remove(): void {
		this.container.remove();
	}
}

class TextTab implements IPanelTab {
	public readonly title = localize('textTabTitle', "Query Text");
	public readonly identifier = 'textTab';
	public readonly view: TextResourceEditorView;

	constructor(inputTextEditor: TextResourceEditor, inputContainer: HTMLElement) {
		this.view = new TextResourceEditorView(inputTextEditor, inputContainer);
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

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
	public readonly title = localize('resultsTabTitle', "Results");
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
	public readonly title = localize('messagesTabTitle', "Messages");
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

/**
 * Editor that hosts 2 sub-editors: A TextResourceEditor for SQL file editing, and a QueryResultsEditor
 * for viewing and editing query results. This editor is based off SideBySideEditor.
 */
export class QueryEditor extends EditorPane {

	public static ID: string = 'workbench.editor.queryEditor';
	public static LABEL = localize('queryEditor.name', "Query Editor");

	private dimension: DOM.Dimension = new DOM.Dimension(0, 0);

	//private resultsEditor: QueryResultsEditor;

	private resultsEditorContainer: HTMLElement;

	private textResourceEditor: TextResourceEditor;
	private textFileEditor: TextFileEditor;
	private currentTextEditor: BaseTextEditor;

	private textResourceEditorContainer: HTMLElement;
	private textFileEditorContainer: HTMLElement;

	private taskbar: Taskbar;
	private viewContainer: HTMLElement;
	private splitview: SplitView;

	private inputDisposables = this._register(new DisposableStore());

	private resultsVisible = false;

	private showResultsInSeparateTab = false;

	private queryEditorVisible: IContextKey<boolean>;

	private editorMemento: IEditorMemento<IQueryEditorViewState>;

	//stuff moved from queryResultsView
	private _panelView: TabbedPanel;
	private _resultsInput: QueryResultsInput | undefined;
	private resultsTab: ResultsTab;
	private messagesTab: MessagesTab;
	private chartTab: ChartTab;
	private executionPlanTab: ExecutionPlanTab;
	private topOperationsTab: TopOperationsTab;
	private dynamicModelViewTabs: QueryModelViewTab[] = [];
	private runnerDisposables = new DisposableStore();

	//stuff moved from queryResultsEditor
	protected _rawOptions: BareResultsGridInfo;
	private styleSheet = DOM.createStyleSheet();

	//actions
	private _runQueryAction: actions.RunQueryAction;
	private _cancelQueryAction: actions.CancelQueryAction;
	private _toggleConnectDatabaseAction: actions.ToggleConnectDatabaseAction;
	private _changeConnectionAction: actions.ConnectDatabaseAction;
	private _listDatabasesAction: actions.ListDatabasesAction;
	private _estimatedQueryPlanAction: actions.EstimatedQueryPlanAction;
	private _actualQueryPlanAction: actions.ActualQueryPlanAction;
	private _listDatabasesActionItem: actions.ListDatabasesActionItem;
	private _toggleSqlcmdMode: actions.ToggleSqlCmdModeAction;
	private _exportAsNotebookAction: actions.ExportAsNotebookAction;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IFileService fileService: IFileService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@INotificationService private notificationService: INotificationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IModeService private readonly modeService: IModeService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@ICapabilitiesService private readonly capabilitiesService: ICapabilitiesService,
		@IQueryModelService private queryModelService: IQueryModelService,
		@ILogService private logService: ILogService
	) {
		super(QueryEditor.ID, telemetryService, themeService, storageService);

		this.editorMemento = this.getEditorMemento<IQueryEditorViewState>(editorGroupService, textResourceConfigurationService, QUERY_EDITOR_VIEW_STATE_PREFERENCE_KEY, 100);

		this.queryEditorVisible = queryContext.QueryEditorVisibleContext.bindTo(contextKeyService);

		// Clear view state for deleted files
		this._register(fileService.onDidFilesChange(e => this.onFilesChanged(e)));

		// Moved from queryResultsEditor
		this._rawOptions = BareResultsGridInfo.createFromRawSettings(this.configurationService.getValue('resultsGrid'), getZoomLevel());
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('resultsGrid')) {
				this._rawOptions = BareResultsGridInfo.createFromRawSettings(this.configurationService.getValue('resultsGrid'), getZoomLevel());
				this.applySettings();
			}
		}));
		this.applySettings();
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
		const activeTab = this._resultsInput?.state.activeTab;
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
			this._resultsInput?.state.visibleTabs.clear();
			if (this._resultsInput) {
				this._resultsInput.state.activeTab = this.resultsTab.identifier;
			}
		}));
		this.runnerDisposables.add(runner.onQueryEnd(() => {
			if (runner.messages.some(v => v.isError)) {
				this._panelView.showTab(this.messagesTab.identifier);
				this._panelView.focusCurrentTab();
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
						this._resultsInput.state.executionPlanState.executionPlanFileViewUUID
					);
					if (view) {
						view.addGraphs(e.planGraphs);
					}
				}
			}
		}));

		if (this._resultsInput?.state.visibleTabs.has(this.chartTab.identifier) && !this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.pushTab(this.chartTab);
		} else if (!this._resultsInput?.state.visibleTabs.has(this.chartTab.identifier) && this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.removeTab(this.chartTab.identifier);
		}

		if (this._resultsInput?.state.visibleTabs.has(this.executionPlanTab.identifier) && !this._panelView.contains(this.executionPlanTab.identifier)) {
			this._panelView.pushTab(this.executionPlanTab);
		} else if (!this._resultsInput?.state.visibleTabs.has(this.executionPlanTab.identifier) && this._panelView.contains(this.executionPlanTab.identifier)) {
			this._panelView.removeTab(this.executionPlanTab.identifier);
		}

		if (this._resultsInput?.state.visibleTabs.has(this.topOperationsTab.identifier) && !this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.pushTab(this.topOperationsTab);
		} else if (!this._resultsInput?.state.visibleTabs.has(this.topOperationsTab.identifier) && this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.removeTab(this.topOperationsTab.identifier);
		}

		// restore query model view tabs
		this.dynamicModelViewTabs.forEach(tab => {
			if (this._panelView.contains(tab.identifier)) {
				this._panelView.removeTab(tab.identifier);
			}
		});
		this.dynamicModelViewTabs = [];

		this._resultsInput?.state.visibleTabs.forEach(tabId => {
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
			this._panelView.focusCurrentTab();
		} else {
			this._panelView.showTab(this.resultsTab.identifier); // our default tab is the results view
			this._panelView.focusCurrentTab();
		}
	}

	private applySettings() {
		let cssRuleText = '';
		if (types.isNumber(this._rawOptions.cellPadding)) {
			cssRuleText = this._rawOptions.cellPadding + 'px';
		} else {
			cssRuleText = this._rawOptions.cellPadding.join('px ') + 'px;';
		}
		let content = `.grid-panel .monaco-table .slick-cell { padding: ${cssRuleText} }`;
		content += `.grid-panel .monaco-table, .message-tree { ${getBareResultsGridInfoStyles(this._rawOptions)} }`;
		this.styleSheet.innerHTML = content;
	}

	private onFilesChanged(e: FileChangesEvent): void {
		const deleted = e.rawDeleted;
		if (!deleted) {
			return;
		}
		const changes = [];
		for (const [, change] of deleted) {
			changes.push(change);
		}
		if (changes.length) {
			this.clearTextEditorViewState(changes.map(d => d.resource));
		}
	}

	protected override getEditorMemento<T>(editorGroupService: IEditorGroupsService, configurationService: ITextResourceConfigurationService, key: string, limit: number = 10): IEditorMemento<T> {
		return new EditorMemento(this.getId(), key, Object.create(null), limit, editorGroupService, configurationService); // do not persist in storage as results are never persisted
	}

	private showQueryEditorError(): void {
		this.notificationService.error(localize('queryEditor.queryEditorCrashError', "The query editor ran into an issue and has stopped working. Please save and reopen it."));
	}


	// PUBLIC METHODS ////////////////////////////////////////////////////////////

	// HELPER METHODS FROM QUERYRESULTSVIEW
	public hideResults() {
		if (this._panelView.contains(this.resultsTab.identifier)) {
			this._panelView.removeTab(this.resultsTab.identifier);
		}
	}

	public showResults() {
		if (!this._panelView.contains(this.resultsTab.identifier)) {
			if (!this.showResultsInSeparateTab) {
				this._panelView.pushTab(this.resultsTab, 0);
			}
			else {
				//Change index to account for the query text tab.
				this._panelView.pushTab(this.resultsTab, 1);
			}
		}
		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.switchToResultsTab) {
			this._panelView.showTab(this.resultsTab.identifier);
			this._panelView.focusCurrentTab();
		}
	}

	public hideChart() {
		if (this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.removeTab(this.chartTab.identifier);
		}
	}

	public showTopOperations(xml: string) {
		this._resultsInput?.state.visibleTabs.add(this.topOperationsTab.identifier);
		if (!this._panelView.contains(this.topOperationsTab.identifier)) {
			this._panelView.pushTab(this.topOperationsTab);
		}
		this.topOperationsTab.view.showPlan(xml);
	}

	public showPlan() {
		if (!this._panelView.contains(this.executionPlanTab.identifier)) {
			this._resultsInput?.state.visibleTabs.add(this.executionPlanTab.identifier);
			if (!this._panelView.contains(this.executionPlanTab.identifier)) {
				this._panelView.pushTab(this.executionPlanTab);
			}
			this._panelView.showTab(this.executionPlanTab.identifier);
			this._panelView.focusCurrentTab();
		}
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
	}

	public hideDynamicViewModelTabs() {
		this.dynamicModelViewTabs.forEach(tab => {
			if (this._panelView.contains(tab.identifier)) {
				this._panelView.removeTab(tab.identifier);
			}
		});

		this.dynamicModelViewTabs = [];
	}

	public chartData(dataId: { resultId: number, batchId: number }): void {
		this._resultsInput?.state.visibleTabs.add(this.chartTab.identifier);
		if (!this._panelView.contains(this.chartTab.identifier)) {
			this._panelView.pushTab(this.chartTab);
		}

		this._panelView.showTab(this.chartTab.identifier);
		this.chartTab.chart(dataId);
	}

	// ORIGINAL METHODS.

	public override get input(): QueryEditorInput | null {
		return this._input as QueryEditorInput;
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		parent.classList.add('query-editor');

		this.showResultsInSeparateTab = this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.showResultsInSeparateTab;

		// We create two separate editors - one for Untitled Documents (ad-hoc queries) and another for queries from
		// files. This is necessary because TextResourceEditor by default makes all non-Untitled inputs to be
		// read-only so we need to use a TextFileEditor for files in order to edit them.
		this.textResourceEditor = this._register(this.instantiationService.createInstance(TextResourceEditor));
		this.textFileEditor = this._register(this.instantiationService.createInstance(TextFileEditor));

		this.textResourceEditorContainer = DOM.$('.text-resource-editor-container');
		this.textResourceEditor.create(this.textResourceEditorContainer);
		this.textFileEditorContainer = DOM.$('.text-file-editor-container');
		this.textFileEditor.create(this.textFileEditorContainer);

		this.viewContainer = DOM.$('.query-editor-view');
		this.createTaskbar(parent);

		parent.appendChild(this.viewContainer);
		let currentResultsContainer = this.viewContainer;

		if (!this.showResultsInSeparateTab) {
			this.resultsEditorContainer = DOM.$('.results-editor-container');

			this.splitview = this._register(new SplitView(this.viewContainer, { orientation: Orientation.VERTICAL }));
			this._register(this.splitview.onDidSashReset(() => this.splitview.distributeViewSizes()));

			this.currentTextEditor = this.textResourceEditor;
			this.splitview.addView({
				element: this.textResourceEditorContainer,
				layout: size => this.currentTextEditor.layout(new DOM.Dimension(this.dimension.width, size)),
				minimumSize: 0,
				maximumSize: Number.POSITIVE_INFINITY,
				onDidChange: Event.None
			}, Sizing.Distribute);
			currentResultsContainer = this.resultsEditorContainer;
		}

		this._panelView = this._register(new TabbedPanel(currentResultsContainer, { showHeaderWhenSingleView: true }));
		this.resultsTab = this._register(new ResultsTab(this.instantiationService));
		this.messagesTab = this._register(new MessagesTab(this.instantiationService));
		this.chartTab = this._register(new ChartTab(this.instantiationService));
		this.executionPlanTab = this._register(this.instantiationService.createInstance(ExecutionPlanTab));
		this.topOperationsTab = this._register(new TopOperationsTab(this.instantiationService));

		let textTab = new TextTab(this.textResourceEditor, this.textResourceEditorContainer);
		this._register(attachTabbedPanelStyler(this._panelView, this.themeService));

		this.styleSheet.remove();
		currentResultsContainer.appendChild(this.styleSheet);

		if (this.showResultsInSeparateTab) {
			this._panelView.pushTab(textTab, 0);
		}
		this._register(this._panelView.onTabChange(e => {
			if (this._resultsInput) {
				this._resultsInput.state.activeTab = e;
			}
		}));

	}

	override dispose() {
		this.runnerDisposables.dispose();
		this.runnerDisposables = new DisposableStore();
		this.styleSheet.remove();
		this.styleSheet = undefined;
		super.dispose();
	}

	/**
	 * Creates the query execution taskbar that appears at the top of the QueryEditor
	 */
	private createTaskbar(parentElement: HTMLElement): void {
		// Create QueryTaskbar
		let taskbarContainer = DOM.append(parentElement, DOM.$('div'));
		this.taskbar = this._register(new Taskbar(taskbarContainer, {
			actionViewItemProvider: action => this._getActionItemForAction(action),
		}));

		// Create Actions for the toolbar
		this._runQueryAction = this.instantiationService.createInstance(actions.RunQueryAction, this);
		this._cancelQueryAction = this.instantiationService.createInstance(actions.CancelQueryAction, this);
		this._toggleConnectDatabaseAction = this.instantiationService.createInstance(actions.ToggleConnectDatabaseAction, this, false);
		this._changeConnectionAction = this.instantiationService.createInstance(actions.ConnectDatabaseAction, this, true);
		this._listDatabasesAction = this.instantiationService.createInstance(actions.ListDatabasesAction, this);
		this._estimatedQueryPlanAction = this.instantiationService.createInstance(actions.EstimatedQueryPlanAction, this);
		this._actualQueryPlanAction = this.instantiationService.createInstance(actions.ActualQueryPlanAction, this);
		this._toggleSqlcmdMode = this.instantiationService.createInstance(actions.ToggleSqlCmdModeAction, this, false);
		this._exportAsNotebookAction = this.instantiationService.createInstance(actions.ExportAsNotebookAction, this);
		this.setTaskbarContent();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('workbench.enablePreviewFeatures')) {
				this.setTaskbarContent();
			}
		}));
		this._register(this.connectionManagementService.onLanguageFlavorChanged(() => {
			this.setTaskbarContent();
		}));
		this._register(this.capabilitiesService.onCapabilitiesRegistered(c => {
			if (c.id === this.currentProvider) {
				this.setTaskbarContent();
			}
		}));
	}

	/**
	 * Update the buttons on the taskbar to reflect the state of the current input.
	 */
	private updateState(stateChangeEvent: IQueryEditorStateChange): void {
		if (stateChangeEvent.connectedChange) {
			this._toggleConnectDatabaseAction.connected = this.input.state.connected;
			this._changeConnectionAction.enabled = this.input.state.connected;
			this.setTaskbarContent();
			if (this.input.state.connected) {
				this.listDatabasesActionItem?.onConnected();
			} else {
				this.listDatabasesActionItem?.onDisconnect();
			}
		}

		if (stateChangeEvent.sqlCmdModeChanged) {
			this._toggleSqlcmdMode.isSqlCmdMode = this.input.state.isSqlCmdMode;
		}

		if (stateChangeEvent.connectingChange) {
			this._runQueryAction.enabled = !this.input.state.connecting;
			this._estimatedQueryPlanAction.enabled = !this.input.state.connecting;

		}

		if (stateChangeEvent.executingChange) {
			this._runQueryAction.enabled = !this.input.state.executing;
			this._estimatedQueryPlanAction.enabled = !this.input.state.executing;
			this._cancelQueryAction.enabled = this.input.state.executing;
		}

		if (stateChangeEvent.resultsVisibleChange) {
			if (this.input.state.resultsVisible) {
				this.addResultsEditor();
			} else {
				this.removeResultsEditor();
			}
		}
	}

	/**
	 * Gets the IActionItem for the List Databases dropdown if provided the associated Action.
	 * Otherwise returns null.
	 */
	private _getActionItemForAction(action: IAction): IActionViewItem {
		if (action.id === actions.ListDatabasesAction.ID) {
			if (!this._listDatabasesActionItem) {
				this._listDatabasesActionItem = this.instantiationService.createInstance(actions.ListDatabasesActionItem, this, action);
				this._register(this._listDatabasesActionItem.attachStyler(this.themeService));
			}
			return this._listDatabasesActionItem;
		}

		return null;
	}

	private get listDatabasesActionItem(): actions.ListDatabasesActionItem | undefined {
		return this._listDatabasesActionItem;
	}

	private get currentProvider(): string | undefined {
		const connectionProfile = this.connectionManagementService.getConnectionProfile(this.input?.uri);
		return connectionProfile?.providerName ||
			this.connectionManagementService.getProviderIdFromUri(this.input?.uri) ||
			this.connectionManagementService.getDefaultProviderId();
	}

	private setTaskbarContent(): void {
		const previewFeaturesEnabled = this.configurationService.getValue('workbench')['enablePreviewFeatures'];
		const fileExtension = path.extname(this.input?.uri || '');
		const providerId = this.currentProvider;
		const content: ITaskbarContent[] = [
			{ action: this._runQueryAction },
			{ action: this._cancelQueryAction },
			{ element: Taskbar.createTaskbarSeparator() },
			{ action: this._toggleConnectDatabaseAction },
			{ action: this._changeConnectionAction }
		];

		// TODO: Allow query provider to provide the language mode.
		if (this.input instanceof UntitledQueryEditorInput) {
			if ((providerId === 'KUSTO') || this.modeService.getExtensions('Kusto').indexOf(fileExtension) > -1) {
				this.input.setMode('kusto');
			}
			else if (providerId === 'LOGANALYTICS' || this.modeService.getExtensions('LogAnalytics').indexOf(fileExtension) > -1) {
				this.input.setMode('loganalytics');
			}
		}

		// Only show the databases dropdown if the connection provider supports it.
		// If the provider we're using isn't registered yet then default to not showing it - we'll update once the provider is registered
		if (this.capabilitiesService.getCapabilities(providerId)?.connection?.connectionOptions?.find(option => option.specialValueType === ConnectionOptionSpecialType.databaseName)) {
			content.push({ action: this._listDatabasesAction });
		}

		// TODO: Allow extensions to contribute toolbar actions.
		if (previewFeaturesEnabled && providerId === 'MSSQL') {
			content.push(
				{ element: Taskbar.createTaskbarSeparator() },
				{ action: this._estimatedQueryPlanAction },
				{ action: this._toggleSqlcmdMode },
				{ action: this._exportAsNotebookAction }
			);
		}

		this.taskbar.setContent(content);
	}



	public set resultsInput(input: QueryResultsInput | undefined) {
		try {
			this._resultsInput = input;
			this.runnerDisposables.clear();

			[this.resultsTab, this.messagesTab, this.executionPlanTab, this.topOperationsTab, this.chartTab].forEach(t => t.clear());
			this.dynamicModelViewTabs.forEach(t => t.clear());

			if (input) {
				this.resultsTab.view.state = input.state.gridPanelState;
				this.topOperationsTab.view.setState(input.state.topOperationsState);
				this.chartTab.view.state = input.state.chartState;
				this.executionPlanTab.view.state = input.state.executionPlanState;
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

	public get resultsInput() {
		return this._resultsInput;
	}

	public override async setInput(newInput: QueryEditorInput, options: IEditorOptions, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		const oldInput = this.input;

		if (oldInput && newInput.matches(oldInput)) {
			return Promise.resolve();
		}

		if (oldInput) {
			// Remember view settings if input changes
			this.saveQueryEditorViewState(this.input);
			this.currentTextEditor.clearInput();
			this.clearResultsInput();
		}

		// If we're switching editor types switch out the views
		const newTextEditor = newInput.text instanceof FileEditorInput ? this.textFileEditor : this.textResourceEditor;
		if (newTextEditor !== this.currentTextEditor) {
			this.currentTextEditor = newTextEditor;
			if (!this.showResultsInSeparateTab) {
				this.splitview.removeView(0, Sizing.Distribute);

				this.splitview.addView({
					element: this.currentTextEditor.getContainer(),
					layout: size => this.currentTextEditor.layout(new DOM.Dimension(this.dimension.width, size)),
					minimumSize: 0,
					maximumSize: Number.POSITIVE_INFINITY,
					onDidChange: Event.None
				}, Sizing.Distribute, 0);
			}
		}

		// await Promise.all([
		// 	super.setInput(newInput, options, context, token),
		// 	this.currentTextEditor.setInput(newInput.text, options, context, token),
		// 	this.resultsEditor.setInput(newInput.results, options, context)
		// ]);

		await Promise.all([
			super.setInput(newInput, options, context, token),
			this.currentTextEditor.setInput(newInput.text, options, context, token)
		]);
		this.resultsInput = newInput.results;

		this.inputDisposables.clear();
		this.inputDisposables.add(this.input.state.onChange(c => this.updateState(c)));
		this.updateState({ connectingChange: true, connectedChange: true, executingChange: true, resultsVisibleChange: true, sqlCmdModeChanged: true });

		const editorViewState = this.loadTextEditorViewState(this.input.resource);

		if (editorViewState && editorViewState.resultsHeight && !this.showResultsInSeparateTab && this.splitview.length > 1) {
			this.splitview.resizeView(1, editorViewState.resultsHeight);
		}
	}

	private saveQueryEditorViewState(input: QueryEditorInput): void {
		if (!input) {
			return; // ensure we have an input to handle view state for
		}

		// Otherwise we save the view state to restore it later
		else if (!input.isDisposed()) {
			this.saveTextEditorViewState(input.resource);
		}
	}

	private clearTextEditorViewState(resources: URI[], group?: IEditorGroup): void {
		resources.forEach(resource => {
			this.editorMemento.clearEditorState(resource, group);
		});
	}

	private saveTextEditorViewState(resource: URI): void {
		const editorViewState = {
			resultsHeight: (this.resultsVisible && !this.showResultsInSeparateTab) ? this.splitview.getViewSize(1) : undefined
		} as IQueryEditorViewState;

		if (!this.group) {
			return;
		}

		this.editorMemento.saveEditorState(this.group, resource, editorViewState);
	}

	/**
	 * Loads the text editor view state for the given resource and returns it.
	 */
	protected loadTextEditorViewState(resource: URI): IQueryEditorViewState | undefined {
		return this.group ? this.editorMemento.loadEditorState(this.group, resource) : undefined;
	}

	protected override saveState(): void {

		// Update/clear editor view State
		this.saveQueryEditorViewState(this.input);

		super.saveState();
	}

	public toggleResultsEditorVisibility(): void {
		if (this.resultsVisible) {
			this.removeResultsEditor();
		} else {
			this.addResultsEditor();
		}
	}

	/**
	 * Sets this editor and the 2 sub-editors to visible.
	 */
	public override setEditorVisible(visible: boolean, group: IEditorGroup): void {
		this.textFileEditor.setVisible(visible, group);
		this.textResourceEditor.setVisible(visible, group);
		super.setEditorVisible(visible, group);

		// Note: must update after calling super.setEditorVisible so that the accurate count is handled
		this.updateQueryEditorVisible(visible);
	}

	private updateQueryEditorVisible(currentEditorIsVisible: boolean): void {
		if (this.queryEditorVisible) {
			let visible = currentEditorIsVisible;
			if (!currentEditorIsVisible) {
				// Current editor is closing but still tracked as visible. Check if any other editor is visible
				const candidates = [...this.editorService.visibleEditorPanes].filter(e => {
					if (e && e.getId) {
						return e.getId() === QueryEditor.ID;
					}
					return false;
				});
				// Note: require 2 or more candidates since current is closing but still
				// counted as visible
				visible = candidates.length > 1;
			}
			this.queryEditorVisible.set(visible);
		}
	}

	/**
	 * Called to indicate to the editor that the input should be cleared and resources associated with the
	 * input should be freed.
	 */
	public override clearInput(): void {

		this.saveQueryEditorViewState(this.input);

		this.currentTextEditor.clearInput();
		this.clearResultsInput();
		super.clearInput();
	}

	clearResultsInput() {
		this._resultsInput = undefined;
		this.runnerDisposables.clear();
		this.resultsTab.clear();
		this.messagesTab.clear();
		this.topOperationsTab.clear();
		this.chartTab.clear();
		this.executionPlanTab.clear();
		this.dynamicModelViewTabs.forEach(t => t.clear());
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public override focus(): void {
		if (!this.showResultsInSeparateTab) {
			this.currentTextEditor.focus();
		}
		else {
			this._panelView.focusCurrentTab();
		}
	}

	public toggleFocusBetweenQueryEditorAndResults(): void {
		if (this.resultsVisible || this.resultsEditorContainer.contains(document.activeElement)) {
			this.focus();
		}

		// else {
		// 	this.resultsEditor.focus();
		// }
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this.dimension = dimension;
		const queryEditorHeight = dimension.height - DOM.getTotalHeight(this.taskbar.getContainer());
		this.viewContainer.style.height = queryEditorHeight + 'px';

		if (!this.showResultsInSeparateTab) {
			this.splitview.layout(queryEditorHeight);
		}
		else {
			this._panelView.layout(dimension);
		}
	}

	/**
	 * Returns the editor control for the text editor.
	 */
	public override getControl(): IEditorControl {
		return this.currentTextEditor.getControl();
	}

	public override setOptions(options: IEditorOptions): void {
		this.currentTextEditor.setOptions(options);
	}

	private removeResultsEditor(): void {
		if (this.resultsVisible) {
			if (!this.showResultsInSeparateTab) {
				this.splitview.removeView(1, Sizing.Distribute);
				this.resultsVisible = false;
				if (this.input && this.input.state) {
					this.input.state.resultsVisible = false;
				}
			}
			else {
				this.hideResults();
				this._panelView.showTab('textTab');
				this._panelView.focusCurrentTab();
			}
		}
	}

	private addResultsEditor(): void {
		if (!this.resultsVisible) {
			if (!this.showResultsInSeparateTab) {
				// size the results section to 65% of available height or at least 100px
				let initialViewSize = Math.round(Math.max(this.dimension.height * 0.65, 100));
				this.splitview.addView({
					element: this.resultsEditorContainer,
					layout: size => this._panelView && this._panelView.layout(new DOM.Dimension(this.dimension.width, size)),
					minimumSize: 0,
					maximumSize: Number.POSITIVE_INFINITY,
					onDidChange: Event.None
				}, initialViewSize);
			}

			if (!this._panelView.contains(this.resultsTab.identifier)) {
				this._panelView.pushTab(this.resultsTab);
			}
			if (!this._panelView.contains(this.messagesTab.identifier)) {
				this._panelView.pushTab(this.messagesTab);
			}
			this.resultsVisible = true;
			if (this.input && this.input.state) {
				this.input.state.resultsVisible = true;
			}

		}
	}

	// helper functions

	public isSelectionEmpty(): boolean {
		if (this.currentTextEditor && this.currentTextEditor.getControl()) {
			let control = this.currentTextEditor.getControl();
			let codeEditor: ICodeEditor = <ICodeEditor>control;

			if (codeEditor) {
				let value = codeEditor.getValue();
				if (value !== undefined && value.length > 0) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Returns the underlying SQL editor's text selection in a 0-indexed format. Returns undefined if there
	 * is no selected text.
	 */
	public getSelection(checkIfRange: boolean = true): IRange {
		if (this.currentTextEditor && this.currentTextEditor.getControl()) {
			let vscodeSelection = this.currentTextEditor.getControl().getSelection();

			// If the selection is a range of characters rather than just a cursor position, return the range
			let isRange: boolean =
				!(vscodeSelection.getStartPosition().lineNumber === vscodeSelection.getEndPosition().lineNumber &&
					vscodeSelection.getStartPosition().column === vscodeSelection.getEndPosition().column);
			if (!checkIfRange || isRange) {
				return vscodeSelection;
			}
		}

		// Otherwise return undefined because there is no selected text
		return undefined;
	}

	public getAllSelection(): IRange {
		if (this.currentTextEditor && this.currentTextEditor.getControl()) {
			let control = this.currentTextEditor.getControl();
			let codeEditor: ICodeEditor = <ICodeEditor>control;
			if (codeEditor) {
				let model = codeEditor.getModel();
				let totalLines = model.getLineCount();
				let endColumn = model.getLineMaxColumn(totalLines);
				return {
					startLineNumber: 1,
					startColumn: 1,
					endLineNumber: totalLines,
					endColumn: endColumn,
				};
			}
		}
		return undefined;
	}

	public getAllText(): string {
		if (this.currentTextEditor && this.currentTextEditor.getControl()) {
			let control = this.currentTextEditor.getControl();
			let codeEditor: ICodeEditor = <ICodeEditor>control;
			if (codeEditor) {
				let value = codeEditor.getValue();
				if (value !== undefined && value.length > 0) {
					return value;
				} else {
					return '';
				}
			}
		}
		return undefined;
	}

	public getSelectionText(): string {
		if (this.currentTextEditor && this.currentTextEditor.getControl()) {
			let control = this.currentTextEditor.getControl();
			let codeEditor: ICodeEditor = <ICodeEditor>control;
			let vscodeSelection = control.getSelection();

			if (codeEditor && vscodeSelection) {
				let model = codeEditor.getModel();
				let value = model.getValueInRange(vscodeSelection);
				if (value !== undefined && value.length > 0) {
					return value;
				}
			}
		}
		return '';
	}

	/**
	 * Calls the runCurrent method of this editor's RunQueryAction
	 */
	public async runCurrentQuery(): Promise<void> {
		return this._runQueryAction.runCurrent();
	}

	/**
	 * Calls the runCurrentQueryWithActualPlan method of this editor's ActualQueryPlanAction
	 */
	public async runCurrentQueryWithActualPlan(): Promise<void> {
		return this._actualQueryPlanAction.run();
	}

	/**
	 * Calls the run method of this editor's RunQueryAction
	 */
	public async runQuery(): Promise<void> {
		return this._runQueryAction.run();
	}

	/**
	 * Calls the run method of this editor's CancelQueryAction
	 */
	public async cancelQuery(): Promise<void> {
		return this._cancelQueryAction.run();
	}

	public registerQueryModelViewTab(title: string, componentId: string): void {
		let tab = this._register(new QueryModelViewTab(title, this.instantiationService));
		tab.view.componentId = componentId;
		this.dynamicModelViewTabs.push(tab);

		this._resultsInput?.state.visibleTabs.add('querymodelview;' + title + ';' + componentId);
		if (!this._panelView.contains(tab.identifier)) {
			this._panelView.pushTab(tab, undefined, true);
		}

		if (this.input) {
			tab.putState(this._resultsInput.state.dynamicModelViewTabsState);
		}
	}

	public chart(dataId: { batchId: number, resultId: number }): void {
		this.chartData(dataId);
	}
}
