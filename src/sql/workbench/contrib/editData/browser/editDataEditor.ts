/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as strings from 'vs/base/common/strings';
import * as DOM from 'vs/base/browser/dom';
import * as nls from 'vs/nls';

import { EditorOptions, EditorInput, IEditorControl, IEditorPane } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';

import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { PANEL_BORDER } from 'vs/workbench/common/theme';

import { EditDataInput } from 'sql/workbench/browser/editData/editDataInput';

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as queryContext from 'sql/workbench/contrib/query/common/queryContext';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { IAction, IActionViewItem } from 'vs/base/common/actions';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { IEditorDescriptorService } from 'sql/workbench/services/queryEditor/browser/editorDescriptorService';
import {
	RefreshTableAction, StopRefreshTableAction, ChangeMaxRowsAction, ChangeMaxRowsActionItem, ShowQueryPaneAction
} from 'sql/workbench/contrib/editData/browser/editDataActions';
import { TextResourceEditor } from 'vs/workbench/browser/parts/editor/textResourceEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IFlexibleSash, HorizontalFlexibleSash } from 'sql/workbench/contrib/query/browser/flexibleSash';
import { EditDataResultsEditor } from 'sql/workbench/contrib/editData/browser/editDataResultsEditor';
import { EditDataResultsInput } from 'sql/workbench/browser/editData/editDataResultsInput';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { onUnexpectedError } from 'vs/base/common/errors';

/**
 * Editor that hosts an action bar and a resultSetInput for an edit data session
 */
export class EditDataEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.editDataEditor';

	// The minimum width/height of the editors hosted in the QueryEditor
	private readonly _minEditorSize: number = 55;

	private _sash: IFlexibleSash;
	private _dimension: DOM.Dimension;

	private _resultsEditor: EditDataResultsEditor;
	private _resultsEditorContainer: HTMLElement;

	private _sqlEditor: TextResourceEditor;
	private _sqlEditorContainer: HTMLElement;

	private _taskbar: Taskbar;
	private _taskbarContainer: HTMLElement;
	private _changeMaxRowsActionItem: ChangeMaxRowsActionItem;
	private _stopRefreshTableAction: StopRefreshTableAction;
	private _refreshTableAction: RefreshTableAction;
	private _changeMaxRowsAction: ChangeMaxRowsAction;
	private _showQueryPaneAction: ShowQueryPaneAction;
	private _spinnerElement: HTMLElement;
	private _initialized: boolean = false;

	private _queryEditorVisible: IContextKey<boolean>;
	private hideQueryResultsView = false;

	constructor(
		@ITelemetryService _telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IEditorDescriptorService private _editorDescriptorService: IEditorDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService storageService: IStorageService
	) {
		super(EditDataEditor.ID, _telemetryService, themeService, storageService);

		if (contextKeyService) {
			this._queryEditorVisible = queryContext.QueryEditorVisibleContext.bindTo(contextKeyService);
		}

		if (_editorService) {
			_editorService.overrideOpenEditor({
				open: (editor, options, group) => {
					if (this.isVisible() && (editor !== this.input || group !== this.group)) {
						this.saveEditorViewState();
					}
					return {};
				}
			});
		}
	}

	// PUBLIC METHODS ////////////////////////////////////////////////////////////

	// Getters and Setters
	public get editDataInput(): EditDataInput { return <EditDataInput>this.input; }
	public get tableName(): string { return this.editDataInput.tableName; }
	public get uri(): string { return this.input ? this.editDataInput.uri.toString() : undefined; }
	public set resultsEditorVisibility(isVisible: boolean) {
		let input: EditDataInput = <EditDataInput>this.input;
		input.results.visible = isVisible;
	}

	/**
	 * Called to indicate to the editor that the input should be cleared and resources associated with the
	 * input should be freed.
	 */
	public clearInput(): void {
		if (this._resultsEditor) {
			this._resultsEditor.clearInput();
		}
		if (this._sqlEditor) {
			this._sqlEditor.clearInput();
		}
		this._disposeEditors();
		super.clearInput();
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	protected createEditor(parent: HTMLElement): void {
		parent.style.position = 'absolute';
		parent.style.height = '100%';
		parent.style.width = '100%';
		this._createTaskbar(parent);
	}

	public dispose(): void {
		this._disposeEditors();
		super.dispose();
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public focus(): void {
		if (this._sqlEditor) {
			this._sqlEditor.focus();
		}
	}

	public getControl(): IEditorControl {
		if (this._sqlEditor) {
			return this._sqlEditor.getControl();
		}
		return null;
	}

	public getEditorText(): string {
		if (this._sqlEditor && this._sqlEditor.getControl()) {
			let control = this._sqlEditor.getControl();
			let codeEditor: ICodeEditor = <ICodeEditor>control;

			if (codeEditor) {
				let value = codeEditor.getModel().getValue();
				if (value !== undefined && value.length > 0) {
					return value;
				}
			}
		}
		return '';
	}

	/**
	 * Hide the spinner element to show that something was happening, hidden by default
	 */
	public hideSpinner(): void {
		this._spinnerElement.style.visibility = 'hidden';
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this._dimension = dimension;

		if (this._sash) {
			this._setSashDimension();
			this._sash.layout();
		}

		this._doLayout();
		this._resizeGridContents();
	}

	/**
	 * Sets this editor and the sub-editors to visible.
	 */
	public setEditorVisible(visible: boolean, group: IEditorGroup): void {
		if (this._resultsEditor) {
			this._resultsEditor.setVisible(visible, group);
		}
		if (this._sqlEditor) {
			this._sqlEditor.setVisible(visible, group);
		}

		super.setEditorVisible(visible, group);

		// Note: must update after calling super.setEditorVisible so that the accurate count is handled
		this._updateQueryEditorVisible(visible);
	}

	/**
	 * Sets the input data for this editor.
	 */
	public setInput(newInput: EditDataInput, options?: EditorOptions): Promise<void> {
		let oldInput = <EditDataInput>this.input;
		if (!newInput.setup) {
			this._initialized = false;
			this._register(newInput.updateTaskbarEvent((owner) => this._updateTaskbar(owner)));
			this._register(newInput.editorInitializingEvent((initializing) => this._onEditorInitializingChanged(initializing)));
			this._register(newInput.showResultsEditorEvent(() => this._showResultsEditor()));
			newInput.onRowDropDownSet(this._changeMaxRowsActionItem.defaultRowCount);
			newInput.setupComplete();
		}

		return super.setInput(newInput, options, CancellationToken.None)
			.then(() => this._updateInput(oldInput, newInput, options));
	}

	/**
	 * Show the spinner element that shows something is happening, hidden by default
	 */
	public showSpinner(): void {
		setTimeout(() => {
			if (!this._initialized) {
				this._spinnerElement.style.visibility = 'visible';
			}
		}, 200);
	}

	public toggleResultsEditorVisibility(): void {
		let input = <EditDataInput>this.input;
		let hideResults = this.hideQueryResultsView;
		this.hideQueryResultsView = !this.hideQueryResultsView;
		if (!input.results) {
			return;
		}
		this.resultsEditorVisibility = hideResults;
		this._doLayout();
	}

	// PRIVATE METHODS ////////////////////////////////////////////////////////////
	private _createEditor(editorInput: EditorInput, container: HTMLElement): Promise<BaseEditor> {
		const descriptor = this._editorDescriptorService.getEditor(editorInput);
		if (!descriptor) {
			return Promise.reject(new Error(strings.format('Can not find a registered editor for the input {0}', editorInput)));
		}

		let editor = descriptor.instantiate(this._instantiationService);
		editor.create(container);
		editor.setVisible(this.isVisible(), editor.group);
		return Promise.resolve(editor);
	}

	/**
	 * Appends the HTML for the EditDataResultsEditor to the EditDataEditor. If the HTML has not yet been
	 * created, it creates it and appends it. If it has already been created, it locates it and
	 * appends it.
	 */
	private _createResultsEditorContainer() {
		this._createSash();

		const parentElement = this.getContainer();
		let input = <EditDataInput>this.input;

		if (!input.results.container) {
			this._resultsEditorContainer = DOM.append(parentElement, DOM.$('.editDataContainer-horizontal'));

			input.results.setContainer(this._resultsEditorContainer);
		} else {
			this._resultsEditorContainer = DOM.append(parentElement, input.results.container);
		}
		this.updateStyles();
	}

	/**
	 * Creates the sash with the requested orientation and registers sash callbacks
	 */
	private _createSash(): void {
		if (!this._sash) {
			let parentElement: HTMLElement = this.getContainer();

			this._sash = this._register(new HorizontalFlexibleSash(parentElement, this._minEditorSize));
			this._setSashDimension();

			this._register(this._sash.onPositionChange(position => this._doLayout()));
		}

		this._sash.show();
	}


	updateStyles() {
		if (this._resultsEditorContainer) {
			this._resultsEditorContainer.style.borderTopColor = this.getColor(PANEL_BORDER);
		}
		super.updateStyles();
	}

	/**
	 * Appends the HTML for the SQL editor. Creates new HTML every time.
	 */
	private _createSqlEditorContainer() {
		const parentElement = this.getContainer();
		this._sqlEditorContainer = DOM.append(parentElement, DOM.$('.details-editor-container'));
	}

	private _createTaskbar(parentElement: HTMLElement): void {
		// Create QueryTaskbar
		this._taskbarContainer = DOM.append(parentElement, DOM.$('div'));
		this._taskbar = new Taskbar(this._taskbarContainer, {
			actionViewItemProvider: (action: IAction) => this._getChangeMaxRowsAction(action)
		});

		// Create Actions for the toolbar
		this._refreshTableAction = this._instantiationService.createInstance(RefreshTableAction, this);
		this._stopRefreshTableAction = this._instantiationService.createInstance(StopRefreshTableAction, this);
		this._changeMaxRowsAction = this._instantiationService.createInstance(ChangeMaxRowsAction, this);
		this._showQueryPaneAction = this._instantiationService.createInstance(ShowQueryPaneAction, this);

		// Create HTML Elements for the taskbar
		let separator = Taskbar.createTaskbarSeparator();
		let textSeparator = Taskbar.createTaskbarText(nls.localize('maxRowTaskbar', "Max Rows:"));

		this._spinnerElement = Taskbar.createTaskbarSpinner();

		// Set the content in the order we desire
		let content: ITaskbarContent[] = [
			{ action: this._refreshTableAction },
			{ action: this._stopRefreshTableAction },
			{ element: separator },
			{ element: textSeparator },
			{ action: this._changeMaxRowsAction },
			{ action: this._showQueryPaneAction },
			{ element: this._spinnerElement }
		];
		this._taskbar.setContent(content);
	}

	/**
	 * Gets the IActionItem for the list of row number drop down
	 */
	private _getChangeMaxRowsAction(action: IAction): IActionViewItem {
		let actionID = ChangeMaxRowsAction.ID;
		if (action.id === actionID) {
			if (!this._changeMaxRowsActionItem) {
				this._changeMaxRowsActionItem = this._instantiationService.createInstance(ChangeMaxRowsActionItem, this);
			}
			return this._changeMaxRowsActionItem;
		}

		return null;
	}

	private _disposeEditors(): void {
		if (this._sqlEditor) {
			this._sqlEditor.dispose();
			this._sqlEditor = null;
		}
		if (this._resultsEditor) {
			this._resultsEditor.dispose();
			this._resultsEditor = null;
		}

		let thisEditorParent: HTMLElement = this.getContainer();

		if (this._sqlEditorContainer) {
			let sqlEditorParent: HTMLElement = this._sqlEditorContainer.parentElement;
			if (sqlEditorParent && sqlEditorParent === thisEditorParent) {
				this._sqlEditorContainer.parentElement.removeChild(this._sqlEditorContainer);
			}
			this._sqlEditorContainer = null;
		}

		if (this._resultsEditorContainer) {
			let resultsEditorParent: HTMLElement = this._resultsEditorContainer.parentElement;
			if (resultsEditorParent && resultsEditorParent === thisEditorParent) {
				this._resultsEditorContainer.parentElement.removeChild(this._resultsEditorContainer);
			}
			this._resultsEditorContainer = null;
			this.hideQueryResultsView = false;
		}
	}

	private _doLayout(skipResizeGridContent: boolean = false): void {
		if (!this._isResultsEditorVisible() && this._sqlEditor) {
			this._doLayoutSql();
			return;
		}
		if (!this._sqlEditor || !this._resultsEditor || !this._dimension || !this._sash) {
			return;
		}

		this._doLayoutHorizontal();

		if (!skipResizeGridContent) {
			this._resizeGridContents();
		}
	}

	private _doLayoutHorizontal(): void {
		let sqlEditorHeight: number;
		let resultsEditorHeight: number;

		this._resultsEditorContainer.hidden = false;
		if (this.queryPaneEnabled()) {
			const splitPointTop: number = this._sash.getSplitPoint();
			this._sqlEditorContainer.hidden = false;
			sqlEditorHeight = splitPointTop - this._getTaskBarHeight();
			resultsEditorHeight = this._dimension.height - this._getTaskBarHeight() - sqlEditorHeight;
		} else {
			this._sqlEditorContainer.hidden = true;
			sqlEditorHeight = 0;
			resultsEditorHeight = this._dimension.height - this._getTaskBarHeight();
		}

		this._sqlEditorContainer.style.height = `${sqlEditorHeight}px`;
		this._sqlEditorContainer.style.width = `${this._dimension.width}px`;

		this._resultsEditorContainer.style.height = `${resultsEditorHeight}px`;
		this._resultsEditorContainer.style.width = `${this._dimension.width}px`;

		this._sqlEditor.layout(new DOM.Dimension(this._dimension.width, sqlEditorHeight));
		this._resultsEditor.layout(new DOM.Dimension(this._dimension.width, resultsEditorHeight));
	}

	private _doLayoutSql() {
		if (this._resultsEditorContainer) {
			this._resultsEditorContainer.style.width = '0px';
			this._resultsEditorContainer.style.height = '0px';
			this._resultsEditorContainer.style.left = '0px';
			this._resultsEditorContainer.hidden = true;
		}

		if (this._dimension) {
			let sqlEditorHeight: number;

			if (this.queryPaneEnabled()) {
				this._sqlEditorContainer.hidden = false;
				sqlEditorHeight = this._dimension.height - this._getTaskBarHeight();
			} else {
				this._sqlEditorContainer.hidden = true;
				sqlEditorHeight = 0;
			}

			this._sqlEditorContainer.style.height = `${sqlEditorHeight}px`;
			this._sqlEditorContainer.style.width = `${this._dimension.width}px`;

			this._sqlEditor.layout(new DOM.Dimension(this._dimension.width, sqlEditorHeight));
		}
	}

	private _getTaskBarHeight(): number {
		let taskBarElement = this._taskbar.getContainer();
		return DOM.getContentHeight(taskBarElement);
	}

	/**
	 * Returns true if the results table for the current edit data session is visible
	 * Public for testing only.
	 */
	private _isResultsEditorVisible(): boolean {
		let input: EditDataInput = <EditDataInput>this.input;

		if (!input) {
			return false;
		}
		return input.results.visible;
	}

	private _onEditorInitializingChanged(initializing: boolean): void {
		if (initializing) {
			this.showSpinner();
		} else {
			this._initialized = true;
			this.hideSpinner();
		}
	}

	/**
	 * Sets input for the results editor after it has been created.
	 */
	private _onResultsEditorCreated(resultsEditor: EditDataResultsEditor, resultsInput: EditDataResultsInput, options: EditorOptions): Promise<void> {
		this._resultsEditor = resultsEditor;
		return this._resultsEditor.setInput(resultsInput, options);
	}

	/**
	 * Sets input for the SQL editor after it has been created.
	 */
	private _onSqlEditorCreated(sqlEditor: TextResourceEditor, sqlInput: UntitledTextEditorInput, options: EditorOptions): Thenable<void> {
		this._sqlEditor = sqlEditor;
		return this._sqlEditor.setInput(sqlInput, options, CancellationToken.None);
	}

	private _resizeGridContents(): void {
		if (this._isResultsEditorVisible()) {
			let queryInput: EditDataInput = <EditDataInput>this.input;
			let uri: string = queryInput.uri;
			if (uri) {
				this._queryModelService.resizeResultsets(uri);
			}
		}
	}

	/**
	 * Handles setting input and creating editors when this QueryEditor is either:
	 * - Opened for the first time
	 * - Opened with a new EditDataInput
	 */
	private _setNewInput(newInput: EditDataInput, options?: EditorOptions): Promise<any> {

		// Promises that will ensure proper ordering of editor creation logic
		let createEditors: () => Promise<any>;
		let onEditorsCreated: (result) => Promise<any>;

		// If both editors exist, create joined promises - one for each editor
		if (this._isResultsEditorVisible()) {
			createEditors = () => {
				return Promise.all([
					this._createEditor(<EditDataResultsInput>newInput.results, this._resultsEditorContainer),
					this._createEditor(<UntitledTextEditorInput>newInput.sql, this._sqlEditorContainer)
				]);
			};
			onEditorsCreated = (result: IEditorPane[]) => {
				return Promise.all([
					this._onResultsEditorCreated(<EditDataResultsEditor>result[0], newInput.results, options),
					this._onSqlEditorCreated(<TextResourceEditor>result[1], newInput.sql, options)
				]);
			};

			// If only the sql editor exists, create a promise and wait for the sql editor to be created
		} else {
			createEditors = () => {
				return this._createEditor(<UntitledTextEditorInput>newInput.sql, this._sqlEditorContainer);
			};
			onEditorsCreated = (result: TextResourceEditor) => {
				return Promise.all([
					this._onSqlEditorCreated(result, newInput.sql, options)
				]);
			};
		}

		// Create a promise to re render the layout after the editor creation logic
		let doLayout: () => Promise<any> = () => {
			this._doLayout();
			return Promise.resolve(undefined);
		};

		// Run all three steps synchronously
		return createEditors()
			.then(onEditorsCreated)
			.then(doLayout)
			.then(() => {
				if (newInput.results) {
					newInput.results.onRestoreViewStateEmitter.fire();
				}
				if (newInput.savedViewState) {
					this._sqlEditor.getControl().restoreViewState(newInput.savedViewState);
				}
			});
	}

	private _setSashDimension(): void {
		if (!this._dimension) {
			return;
		}
		this._sash.setDimension(this._dimension);
	}

	/**
	 * Makes visible the results table for the current edit data session
	 */
	private _showResultsEditor(): void {
		if (this._isResultsEditorVisible()) {
			return;
		}

		//this._editorGroupService.pinEditor(this.position, this.input);

		let input = <EditDataInput>this.input;
		this._createResultsEditorContainer();

		this._createEditor(<EditDataResultsInput>input.results, this._resultsEditorContainer)
			.then(async result => {
				await this._onResultsEditorCreated(<EditDataResultsEditor>result, input.results, this._options);
				this.resultsEditorVisibility = true;
				this.hideQueryResultsView = false;
				this._doLayout(true);
			}).catch(onUnexpectedError);
	}

	/**
	 * Handles setting input for this editor. If this new input does not match the old input (e.g. a new file
	 * has been opened with the same editor, or we are opening the editor for the first time).
	 */
	private _updateInput(oldInput: EditDataInput, newInput: EditDataInput, options?: EditorOptions): Promise<void> {
		if (this._sqlEditor) {
			this._sqlEditor.clearInput();
		}

		if (oldInput) {
			this._disposeEditors();
		}

		this._createSqlEditorContainer();
		if (this._isResultsEditorVisible()) {
			this._createResultsEditorContainer();

			let uri: string = newInput.uri;
			if (uri) {
				this._queryModelService.refreshResultsets(uri);
			}
		}

		if (this._sash) {
			if (this._isResultsEditorVisible()) {
				this._sash.show();
			} else {
				this._sash.hide();
			}
			this.updateSashVisibility();
		}

		this._updateTaskbar(newInput);
		return this._setNewInput(newInput, options);
	}

	private updateSashVisibility(): void {
		// change the visibility of the sash.
		if (this._resultsEditorContainer) {
			if (this.queryPaneEnabled()) {
				this._resultsEditorContainer.style.borderTopStyle = 'solid';
				this._resultsEditorContainer.style.borderTopWidth = '1px';
			} else {
				this._resultsEditorContainer.style.borderTopStyle = '';
				this._resultsEditorContainer.style.borderTopWidth = '';
			}
		}
	}

	private _updateQueryEditorVisible(currentEditorIsVisible: boolean): void {
		if (this._queryEditorVisible) {
			let visible = currentEditorIsVisible;
			if (!currentEditorIsVisible) {
				// Current editor is closing but still tracked as visible. Check if any other editor is visible
				const candidates = [...this._editorService.visibleEditorPanes].filter(e => {
					if (e && e.getId) {
						return e.getId() === EditDataEditor.ID;
					}
					return false;
				});
				// Note: require 2 or more candidates since current is closing but still
				// counted as visible
				visible = candidates.length > 1;
			}
			this._queryEditorVisible.set(visible);
		}
	}

	private _updateTaskbar(owner: EditDataInput): void {
		// Update the taskbar if the owner of this call is being presented
		if (owner.matches(this.editDataInput)) {
			this._refreshTableAction.enabled = owner.refreshButtonEnabled;
			this._stopRefreshTableAction.enabled = owner.stopButtonEnabled;
			this._changeMaxRowsActionItem.setCurrentOptionIndex = owner.rowLimit;
			this._showQueryPaneAction.queryPaneEnabled = owner.queryPaneEnabled;
		}
	}

	/**
	 * Calls the run method of this editor's showQueryPaneAction
	 */
	public runShowQueryPane(): void {
		this._showQueryPaneAction.run();
	}

	/**
	 * Calls the run method of this editor's RunQueryAction
	 */
	public runQuery(): void {
		this._refreshTableAction.run();
	}

	/**
	 * Calls the run method of this editor's CancelQueryAction
	 */
	public cancelQuery(): void {
		this._stopRefreshTableAction.run();
	}

	public toggleQueryPane(): void {
		this.editDataInput.queryPaneEnabled = !this.queryPaneEnabled();
		this.updateSashVisibility();
		if (this.queryPaneEnabled()) {
			this._showQueryEditor();
		}
		else {
			this._hideQueryEditor();
		}
		this._doLayout(false);
	}

	private _showQueryEditor(): void {
		this._sqlEditorContainer.hidden = false;
		this._changeMaxRowsActionItem.disable();
	}
	private _hideQueryEditor(): void {
		this._sqlEditorContainer.hidden = true;
		this._changeMaxRowsActionItem.enable();
	}

	public queryPaneEnabled(): boolean {
		return this.editDataInput.queryPaneEnabled;
	}

	private saveEditorViewState(): void {
		let editDataInput = this.input as EditDataInput;
		if (editDataInput) {
			if (this._sqlEditor) {
				editDataInput.savedViewState = this._sqlEditor.getControl().saveViewState();
			}
			if (editDataInput.results) {
				editDataInput.results.onSaveViewStateEmitter.fire();
			}
		}
	}
}
