/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryEditor';

import * as DOM from 'vs/base/browser/dom';
import { EditorOptions, IEditorControl, IEditorMemento } from 'vs/workbench/common/editor';
import { BaseEditor, EditorMemento } from 'vs/workbench/browser/parts/editor/baseEditor';
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
import { DisposableStore } from 'vs/base/common/lifecycle';
import { IActionViewItem, IAction } from 'vs/base/common/actions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';
import { IFileService, FileChangesEvent } from 'vs/platform/files/common/files';

import { QueryEditorInput, IQueryEditorStateChange } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsEditor } from 'sql/workbench/contrib/query/browser/queryResultsEditor';
import * as queryContext from 'sql/workbench/contrib/query/common/queryContext';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import * as actions from 'sql/workbench/contrib/query/browser/queryActions';
import { IRange } from 'vs/editor/common/core/range';

const QUERY_EDITOR_VIEW_STATE_PREFERENCE_KEY = 'queryEditorViewState';

interface IQueryEditorViewState {
	resultsHeight: number | undefined;
}

/**
 * Editor that hosts 2 sub-editors: A TextResourceEditor for SQL file editing, and a QueryResultsEditor
 * for viewing and editing query results. This editor is based off SideBySideEditor.
 */
export class QueryEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.queryEditor';

	private dimension: DOM.Dimension = new DOM.Dimension(0, 0);

	private resultsEditor: QueryResultsEditor;

	private resultsEditorContainer: HTMLElement;

	private textResourceEditor: TextResourceEditor;
	private textFileEditor: TextFileEditor;
	private currentTextEditor: BaseTextEditor;

	private textResourceEditorContainer: HTMLElement;
	private textFileEditorContainer: HTMLElement;

	private taskbar: Taskbar;
	private splitviewContainer: HTMLElement;
	private splitview: SplitView;

	private inputDisposables = this._register(new DisposableStore());

	private resultsVisible = false;

	private queryEditorVisible: IContextKey<boolean>;

	private editorMemento: IEditorMemento<IQueryEditorViewState>;

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
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super(QueryEditor.ID, telemetryService, themeService, storageService);

		this.editorMemento = this.getEditorMemento<IQueryEditorViewState>(editorGroupService, QUERY_EDITOR_VIEW_STATE_PREFERENCE_KEY, 100);

		this.queryEditorVisible = queryContext.QueryEditorVisibleContext.bindTo(contextKeyService);

		// Clear view state for deleted files
		this._register(fileService.onDidFilesChange(e => this.onFilesChanged(e)));
	}

	private onFilesChanged(e: FileChangesEvent): void {
		const deleted = e.getDeleted();
		if (deleted && deleted.length) {
			this.clearTextEditorViewState(deleted.map(d => d.resource));
		}
	}

	protected getEditorMemento<T>(editorGroupService: IEditorGroupsService, key: string, limit: number = 10): IEditorMemento<T> {
		return new EditorMemento(this.getId(), key, Object.create(null), limit, editorGroupService); // do not persist in storage as results are never persisted
	}

	// PUBLIC METHODS ////////////////////////////////////////////////////////////
	public get input(): QueryEditorInput | null {
		return this._input as QueryEditorInput;
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		DOM.addClass(parent, 'query-editor');

		this.splitviewContainer = DOM.$('.query-editor-view');

		this.createTaskbar(parent);

		parent.appendChild(this.splitviewContainer);

		this.splitview = this._register(new SplitView(this.splitviewContainer, { orientation: Orientation.VERTICAL }));
		this._register(this.splitview.onDidSashReset(() => this.splitview.distributeViewSizes()));

		// We create two separate editors - one for Untitled Documents (ad-hoc queries) and another for queries from
		// files. This is necessary because TextResourceEditor by default makes all non-Untitled inputs to be
		// read-only so we need to use a TextFileEditor for files in order to edit them.
		this.textResourceEditor = this._register(this.instantiationService.createInstance(TextResourceEditor));
		this.textFileEditor = this._register(this.instantiationService.createInstance(TextFileEditor));

		this.textResourceEditorContainer = DOM.$('.text-resource-editor-container');
		this.textResourceEditor.create(this.textResourceEditorContainer);
		this.textFileEditorContainer = DOM.$('.text-file-editor-container');
		this.textFileEditor.create(this.textFileEditorContainer);

		this.currentTextEditor = this.textResourceEditor;
		this.splitview.addView({
			element: this.textResourceEditorContainer,
			layout: size => this.currentTextEditor.layout(new DOM.Dimension(this.dimension.width, size)),
			minimumSize: 0,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this.resultsEditorContainer = DOM.$('.results-editor-container');
		this.resultsEditor = this._register(this.instantiationService.createInstance(QueryResultsEditor));
		this.resultsEditor.create(this.resultsEditorContainer);
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
	}

	/**
	 * Update the buttons on the taskbar to reflect the state of the current input.
	 */
	private updateState(stateChangeEvent: IQueryEditorStateChange): void {
		if (stateChangeEvent.connectedChange) {
			this._toggleConnectDatabaseAction.connected = this.input.state.connected;
			this._changeConnectionAction.enabled = this.input.state.connected;
			if (this.input.state.connected) {
				this.listDatabasesActionItem.onConnected();
			} else {
				this.listDatabasesActionItem.onDisconnect();
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
			return this.listDatabasesActionItem;
		}

		return null;
	}

	private get listDatabasesActionItem(): actions.ListDatabasesActionItem {
		if (!this._listDatabasesActionItem) {
			this._listDatabasesActionItem = this.instantiationService.createInstance(actions.ListDatabasesActionItem, this);
			this._register(this._listDatabasesActionItem.attachStyler(this.themeService));
		}
		return this._listDatabasesActionItem;
	}

	private setTaskbarContent(): void {
		// Create HTML Elements for the taskbar
		const separator = Taskbar.createTaskbarSeparator();
		let content: ITaskbarContent[];
		const previewFeaturesEnabled = this.configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (previewFeaturesEnabled) {
			content = [
				{ action: this._runQueryAction },
				{ action: this._cancelQueryAction },
				{ element: separator },
				{ action: this._toggleConnectDatabaseAction },
				{ action: this._changeConnectionAction },
				{ action: this._listDatabasesAction },
				{ element: separator },
				{ action: this._estimatedQueryPlanAction }, // Preview
				{ action: this._toggleSqlcmdMode }, // Preview
				{ action: this._exportAsNotebookAction } // Preview
			];
		} else {
			content = [
				{ action: this._runQueryAction },
				{ action: this._cancelQueryAction },
				{ element: separator },
				{ action: this._toggleConnectDatabaseAction },
				{ action: this._changeConnectionAction },
				{ action: this._listDatabasesAction }
			];
		}

		this.taskbar.setContent(content);
	}

	public async setInput(newInput: QueryEditorInput, options: EditorOptions, token: CancellationToken): Promise<void> {
		const oldInput = this.input;

		if (newInput.matches(oldInput)) {
			return Promise.resolve();
		}

		if (oldInput) {
			// Remember view settings if input changes
			this.saveQueryEditorViewState(this.input);
			this.currentTextEditor.clearInput();
			this.resultsEditor.clearInput();
		}

		// If we're switching editor types switch out the views
		const newTextEditor = newInput.text instanceof FileEditorInput ? this.textFileEditor : this.textResourceEditor;
		if (newTextEditor !== this.currentTextEditor) {
			this.currentTextEditor = newTextEditor;
			this.splitview.removeView(0, Sizing.Distribute);

			this.splitview.addView({
				element: this.currentTextEditor.getContainer(),
				layout: size => this.currentTextEditor.layout(new DOM.Dimension(this.dimension.width, size)),
				minimumSize: 0,
				maximumSize: Number.POSITIVE_INFINITY,
				onDidChange: Event.None
			}, Sizing.Distribute, 0);
		}

		await Promise.all([
			super.setInput(newInput, options, token),
			this.currentTextEditor.setInput(newInput.text, options, token),
			this.resultsEditor.setInput(newInput.results, options)
		]);

		this.inputDisposables.clear();
		this.inputDisposables.add(this.input.state.onChange(c => this.updateState(c)));
		this.updateState({ connectingChange: true, connectedChange: true, executingChange: true, resultsVisibleChange: true, sqlCmdModeChanged: true });

		const editorViewState = this.loadTextEditorViewState(this.input.resource);

		if (editorViewState && editorViewState.resultsHeight && this.splitview.length > 1) {
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
			resultsHeight: this.resultsVisible ? this.splitview.getViewSize(1) : undefined
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

	protected saveState(): void {

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
	public setEditorVisible(visible: boolean, group: IEditorGroup): void {
		this.textFileEditor.setVisible(visible, group);
		this.textResourceEditor.setVisible(visible, group);
		this.resultsEditor.setVisible(visible, group);
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
	public clearInput(): void {

		this.saveQueryEditorViewState(this.input);

		this.currentTextEditor.clearInput();
		this.resultsEditor.clearInput();
		super.clearInput();
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public focus(): void {
		this.currentTextEditor.focus();
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this.dimension = dimension;
		const queryEditorHeight = dimension.height - DOM.getTotalHeight(this.taskbar.getContainer());
		this.splitviewContainer.style.height = queryEditorHeight + 'px';
		this.splitview.layout(queryEditorHeight);
	}

	/**
	 * Returns the editor control for the text editor.
	 */
	public getControl(): IEditorControl {
		return this.currentTextEditor.getControl();
	}

	public setOptions(options: EditorOptions): void {
		this.currentTextEditor.setOptions(options);
	}

	private removeResultsEditor(): void {
		if (this.resultsVisible) {
			this.splitview.removeView(1, Sizing.Distribute);
			this.resultsVisible = false;
			if (this.input && this.input.state) {
				this.input.state.resultsVisible = false;
			}
		}
	}

	private addResultsEditor(): void {
		if (!this.resultsVisible) {
			// size the results section to 65% of available height or at least 100px
			let initialViewSize = Math.round(Math.max(this.dimension.height * 0.65, 100));
			this.splitview.addView({
				element: this.resultsEditorContainer,
				layout: size => this.resultsEditor && this.resultsEditor.layout(new DOM.Dimension(this.dimension.width, size)),
				minimumSize: 0,
				maximumSize: Number.POSITIVE_INFINITY,
				onDidChange: Event.None
			}, initialViewSize);
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
		this.resultsEditor.registerQueryModelViewTab(title, componentId);
	}

	public chart(dataId: { batchId: number, resultId: number }): void {
		this.resultsEditor.chart(dataId);
	}
}
