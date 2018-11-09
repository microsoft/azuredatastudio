/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryEditor';

import { EditorOptions, IEditorControl } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TextResourceEditor } from 'vs/workbench/browser/parts/editor/textResourceEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IEditorGroup } from 'vs/workbench/services/group/common/editorGroupsService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { TPromise } from 'vs/base/common/winjs.base';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';

import { QueryInput } from 'sql/parts/query/common/queryInput';
import { QueryResultsEditor } from 'sql/parts/query/editor/queryResultsEditor';
import * as queryContext from 'sql/parts/query/common/queryContext';
import { QueryEditorActionBar } from 'sql/parts/query/editor/queryEditorActionBar';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

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

	private resultsVisible = false;

	private queryEditorVisible: IContextKey<boolean>;

	private inputDisposables: IDisposable[] = [];

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IEditorService private editorService: IEditorService
	) {
		super(QueryEditor.ID, telemetryService, themeService);

		if (contextKeyService) {
			this.queryEditorVisible = queryContext.QueryEditorVisibleContext.bindTo(contextKeyService);
		}
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
		this.taskbar.editor = this.getControl() as ICodeEditor;

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
		const oldInput = this.input;

		if (newInput.matches(oldInput)) {
			return TPromise.as(undefined);
		}

		return TPromise.join([
			super.setInput(newInput, options, token),
			this.taskbar.setInput(newInput),
			this.textEditor.setInput(newInput.sql, options, token),
			this.resultsEditor.setInput(newInput, options)
		]).then(() => {
			dispose(this.inputDisposables);
			this.inputDisposables = [];
			this.inputDisposables.push(this.input.state.onChange(c => {
				if (c.executingChange && this.input.state.executing) {
					this.addResultsEditor();
				}
			}));
		});
	}

	public chart(dataId: { batchId: number; resultId: number; }) {
		this.resultsEditor.chart(dataId);
	}

	public showQueryPlan(xml: string) {
		this.resultsEditor.showQueryPlan(xml);
	}

	public toggleResultsEditorVisibility() {
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

	public setOptions(options: EditorOptions): void {
		this.textEditor.setOptions(options);
	}

	private removeResultsEditor() {
		this.splitview.removeView(1, Sizing.Distribute);
		this.resultsVisible = false;
	}

	private addResultsEditor() {
		if (!this.resultsVisible) {
			this.splitview.addView({
				element: this.resultsEditorContainer,
				layout: size => this.resultsEditor && this.resultsEditor.layout(new DOM.Dimension(this.dimension.width, size)),
				minimumSize: 220,
				maximumSize: Number.POSITIVE_INFINITY,
				onDidChange: Event.None
			}, Sizing.Distribute);
			this.resultsVisible = true;
		}
	}
}
