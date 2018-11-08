/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryEditor';

import { EditorInput, EditorOptions, IEditorControl, IEditor, TextEditorOptions } from 'vs/workbench/common/editor';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { TextResourceEditor } from 'vs/workbench/browser/parts/editor/textResourceEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import { ISelectionData } from 'sqlops';
import { IEditorGroup } from 'vs/workbench/services/group/common/editorGroupsService';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IRange } from 'vs/editor/common/core/range';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { TPromise } from 'vs/base/common/winjs.base';
import * as strings from 'vs/base/common/strings';
import * as DOM from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import { Event } from 'vs/base/common/event';
import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorRegistry, Extensions } from 'vs/workbench/browser/editor';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { QueryResultsEditor } from 'sql/parts/query/editor/queryResultsEditor';
import * as queryContext from 'sql/parts/query/common/queryContext';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { IEditorDescriptorService } from 'sql/parts/query/editor/editorDescriptorService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { QueryEditorActionBar } from 'sql/parts/query/editor/queryEditorActionBar';

const EditorRegistry = Registry.as<IEditorRegistry>(Extensions.Editors);

/**
 * Editor that hosts 2 sub-editors: A TextResourceEditor for SQL file editing, and a QueryResultsEditor
 * for viewing and editing query results. This editor is based off SideBySideEditor.
 */
export class QueryEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.queryEditor';

	private dimension: DOM.Dimension = new DOM.Dimension(0, 0);

	private resultsEditor: QueryResultsEditor;
	private resultsEditorContainer: HTMLElement;

	// could be untitled or resource editor
	private textEditor: TextResourceEditor;
	private textEditorContainer: HTMLElement;

	private taskbar: QueryEditorActionBar;

	private splitview: SplitView;

	private queryEditorVisible: IContextKey<boolean>;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IEditorService private editorService: IEditorService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
	) {
		super(QueryEditor.ID, telemetryService, themeService);

		if (contextKeyService) {
			this.queryEditorVisible = queryContext.QueryEditorVisibleContext.bindTo(contextKeyService);
		}
	}

	// PROPERTIES //////////////////////////////////////////////////////////
	/**
	 * Returns the URI of this editor if it is connected.
	 * @returns {string} URI of the editor if connected, undefined otherwise
	 */
	public get connectedUri(): string {
		return this.connectionManagementService.isConnected(this.uri)
			? this.uri
			: undefined;
	}

	/**
	 * Returns the URI of this editor if an input is associated with it
	 * @return {string} URI of this if input is associated, undefined otherwise
	 */
	get uri(): string {
		let input: QueryInput = <QueryInput>this.input;
		return input
			? input.getQueryResultsInputResource()
			: undefined;
	}

	protected createEditor(parent: HTMLElement): void {
		DOM.addClass(parent, 'query-editor');

		let splitviewContainer = DOM.$('.query-editor-view');

		let taskbarContainer = DOM.$('.query-editor-taskbar');
		this.taskbar = this._register(this.instantiationService.createInstance(QueryEditorActionBar, taskbarContainer));

		parent.appendChild(taskbarContainer);
		parent.appendChild(splitviewContainer);

		this.splitview = new SplitView(splitviewContainer, { orientation: Orientation.VERTICAL });
		this._register(this.splitview);
		this._register(this.splitview.onDidSashReset(() => this.splitview.distributeViewSizes()));

		this.textEditorContainer = DOM.$('.text-editor-container');
		this.textEditor = this._register(this.instantiationService.createInstance(TextResourceEditor));
		this.textEditor.create(this.textEditorContainer);

		this.splitview.addView({
			element: this.textEditorContainer,
			layout: size => this.textEditor.layout(new DOM.Dimension(this.dimension.width, size)),
			minimumSize: 220,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this.resultsEditorContainer = DOM.$('.results-editor-container');
		this.resultsEditor = this._register(this.instantiationService.createInstance(QueryResultsEditor));
		this.resultsEditor.create(this.resultsEditorContainer);

		// (<CodeEditorWidget>this.resultsEditor.getControl()).onDidFocusEditorWidget(() => this.lastFocusedEditor = this.resultsEditor);

		/*
		this._register(attachStylerCallback(this.themeService, { scrollbarShadow }, colors => {
			const shadow = colors.scrollbarShadow ? colors.scrollbarShadow.toString() : null;

			if (shadow) {
				this.editablePreferencesEditorContainer.style.boxShadow = `-6px 0 5px -5px ${shadow}`;
			} else {
				this.editablePreferencesEditorContainer.style.boxShadow = null;
			}
		}));
		*/

		// const focusTracker = this._register(DOM.trackFocus(parent));
		// this._register(focusTracker.onDidFocus(() => this._onFocus.fire()));
	}

	public get input(): QueryInput {
		return this._input as QueryInput;
	}

	/**
	 * Sets the input data for this editor.
	 */
	public setInput(newInput: QueryInput, options: EditorOptions, token: CancellationToken): Thenable<void> {
		const oldInput = <QueryInput>this.input;

		if (newInput.matches(oldInput)) {
			return TPromise.as(undefined);
		}

		// Make sure all event callbacks will be sent to this QueryEditor in the case that this QueryInput was moved from
		// another QueryEditor

		return TPromise.join([
			super.setInput(newInput, options, token),
			this.taskbar.setInput(newInput),
			this.textEditor.setInput(newInput.sql, options, token),
			this.resultsEditor.setInput(newInput.results, options)
		]).then(() => undefined);
	}

	/**
	 * Sets this editor and the 2 sub-editors to visible.
	 */
	public setEditorVisible(visible: boolean, group: IEditorGroup): void {
		this.textEditor.setVisible(visible, group);
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
				const candidates = [...this.editorService.visibleControls].filter(e => {
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
		this.textEditor.clearInput();
		this.resultsEditor.clearInput();
		super.clearInput();
	}

	public shutdown() {
		this.textEditor.shutdown();
		this.resultsEditor.shutdown();
		super.shutdown();
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public focus(): void {
		this.textEditor.focus();
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this.dimension = dimension;
		this.splitview.layout(dimension.height);
	}

	/**
	 * Returns the editor control for the text editor.
	 */
	public getControl(): IEditorControl {
		return this.textEditor.getControl();
	}

	/**
	 * Returns the underlying SQL editor's text selection in a 0-indexed format. Returns undefined if there
	 * is no selected text.
	 */
	public getSelection(checkIfRange: boolean = true): ISelectionData {
		if (this.textEditor.getControl()) {
			let vscodeSelection = this.textEditor.getControl().getSelection();

			// If the selection is a range of characters rather than just a cursor position, return the range
			let isRange: boolean =
				!(vscodeSelection.getStartPosition().lineNumber === vscodeSelection.getEndPosition().lineNumber &&
					vscodeSelection.getStartPosition().column === vscodeSelection.getEndPosition().column);
			if (!checkIfRange || isRange) {
				let sqlToolsServiceSelection: ISelectionData = {
					startLine: vscodeSelection.getStartPosition().lineNumber - 1,
					startColumn: vscodeSelection.getStartPosition().column - 1,
					endLine: vscodeSelection.getEndPosition().lineNumber - 1,
					endColumn: vscodeSelection.getEndPosition().column - 1,
				};
				return sqlToolsServiceSelection;
			}
		}

		// Otherwise return undefined because there is no selected text
		return undefined;
	}

	public isSelectionEmpty(): boolean {
		if (this.textEditor.getControl()) {
			let control = this.textEditor.getControl();
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

	public getAllText(): string {
		if (this.textEditor.getControl()) {
			let control = this.textEditor.getControl();
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

	public getAllSelection(): ISelectionData {
		if (this.textEditor.getControl()) {
			let control = this.textEditor.getControl();
			let codeEditor: ICodeEditor = <ICodeEditor>control;
			if (codeEditor) {
				let model = codeEditor.getModel();
				let totalLines = model.getLineCount();
				let endColumn = model.getLineMaxColumn(totalLines);
				let selection: ISelectionData = {
					startLine: 0,
					startColumn: 0,
					endLine: totalLines - 1,
					endColumn: endColumn - 1,
				};
				return selection;
			}
		}
		return undefined;
	}

	public getSelectionText(): string {
		if (this.textEditor.getControl()) {
			let control = this.textEditor.getControl();
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

	public rebuildIntelliSenseCache(): void {
		this.connectionManagementService.rebuildIntelliSenseCache(this.connectedUri);
	}

	public setOptions(options: EditorOptions): void {
		this.textEditor.setOptions(options);
	}

	// PRIVATE METHODS ////////////////////////////////////////////////////////////

	/**
	 * Sets the text selection for the SQL editor based on the given ISelectionData.
	 */
	private _setSelection(selection: ISelectionData): void {
		let rangeConversion: IRange = {
			startLineNumber: selection.startLine + 1,
			startColumn: selection.startColumn + 1,
			endLineNumber: selection.endLine + 1,
			endColumn: selection.endColumn + 1
		};
		let editor = this.textEditor.getControl();
		editor.revealRange(rangeConversion);
		editor.setSelection(rangeConversion);
		editor.focus();
	}
}
