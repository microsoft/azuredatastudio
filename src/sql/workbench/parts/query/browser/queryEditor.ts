/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryEditor';

import * as DOM from 'vs/base/browser/dom';
import { EditorOptions, IEditorControl } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TextResourceEditor } from 'vs/workbench/browser/parts/editor/textResourceEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { Event } from 'vs/base/common/event';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';

import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';
import { QueryResultsEditor } from 'sql/workbench/parts/query/browser/queryResultsEditor';
import * as queryContext from 'sql/workbench/parts/query/common/queryContext';
import { QueryEditorActionBar } from 'sql/workbench/parts/query/browser/queryEditorActionBar';
import { QueryEditorContext } from 'sql/workbench/parts/query/common/queryEditorContext';

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

	private inputDisposables: IDisposable[] = [];

	private contextKey = new QueryEditorContext(this.contextKeyService);

	private resultsVisible = false;

	private queryEditorVisible: IContextKey<boolean>;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(QueryEditor.ID, telemetryService, themeService, storageService);

		this.queryEditorVisible = queryContext.QueryEditorVisibleContext.bindTo(contextKeyService);
	}

	// PUBLIC METHODS ////////////////////////////////////////////////////////////
	public get input(): QueryInput {
		return this._input as QueryInput;
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
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
	}

	public setInput(newInput: QueryInput, options: EditorOptions, token: CancellationToken): Promise<void> {
		const oldInput = this.input;

		if (newInput.matches(oldInput)) {
			return Promise.resolve();
		}

		return Promise.all([
			super.setInput(newInput, options, token),
			this.taskbar.setInput(newInput),
			this.textEditor.setInput(newInput.sql, options, token),
			this.resultsEditor.setInput(newInput.results, options)
		]).then(() => {
			dispose(this.inputDisposables);
			this.inputDisposables = [];
			this.contextKey.setState(this.input.state);
			this.inputDisposables.push(this.input.state.onChange(c => {
				if (c.executingChange && this.input.state.executing) {
					this.addResultsEditor();
					this.input.state.resultsVisible = true;
				}
			}));
			if (this.input.state.resultsVisible) {
				this.addResultsEditor();
			} else {
				this.removeResultsEditor();
			}
		});
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
		this.splitview.layout(dimension.height - 31);
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
		if (this.resultsVisible) {
			this.splitview.removeView(1, Sizing.Distribute);
			this.resultsVisible = false;
		}
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

	public dispose(): void {
		this.textEditor.dispose();
		this.resultsEditor.dispose();
		this.splitview.dispose();
		super.dispose();
	}

	public close(): void {
		let queryInput: QueryInput = <QueryInput>this.input;
		queryInput.sql.close();
		queryInput.results.close();
	}
}
