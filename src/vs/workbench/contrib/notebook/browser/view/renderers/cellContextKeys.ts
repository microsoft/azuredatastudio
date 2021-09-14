/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { CellEditState, CellFocusMode, CellViewModelStateChangeEvent, INotebookEditor, NotebookCellExecutionStateContext, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_EDITOR_FOCUSED, NOTEBOOK_CELL_EXECUTION_STATE, NOTEBOOK_CELL_FOCUSED, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_INPUT_COLLAPSED, NOTEBOOK_CELL_LINE_NUMBERS, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_OUTPUT_COLLAPSED, NOTEBOOK_CELL_TYPE } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CodeCellViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/codeCellViewModel';
import { MarkdownCellViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/markdownCellViewModel';
import { NotebookCellExecutionState } from 'vs/workbench/contrib/notebook/common/notebookCommon';

export class CellContextKeyManager extends Disposable {

	private cellType!: IContextKey<'code' | 'markup'>;
	private cellEditable!: IContextKey<boolean>;
	private cellFocused!: IContextKey<boolean>;
	private cellEditorFocused!: IContextKey<boolean>;
	private cellRunState!: IContextKey<NotebookCellExecutionStateContext>;
	private cellHasOutputs!: IContextKey<boolean>;
	private cellContentCollapsed!: IContextKey<boolean>;
	private cellOutputCollapsed!: IContextKey<boolean>;
	private cellLineNumbers!: IContextKey<'on' | 'off' | 'inherit'>;

	private markdownEditMode!: IContextKey<boolean>;

	private readonly elementDisposables = this._register(new DisposableStore());

	constructor(
		private readonly contextKeyService: IContextKeyService,
		private readonly notebookEditor: INotebookEditor,
		private element: CodeCellViewModel | MarkdownCellViewModel
	) {
		super();

		this.contextKeyService.bufferChangeEvents(() => {
			this.cellType = NOTEBOOK_CELL_TYPE.bindTo(this.contextKeyService);
			this.cellEditable = NOTEBOOK_CELL_EDITABLE.bindTo(this.contextKeyService);
			this.cellFocused = NOTEBOOK_CELL_FOCUSED.bindTo(this.contextKeyService);
			this.cellEditorFocused = NOTEBOOK_CELL_EDITOR_FOCUSED.bindTo(this.contextKeyService);
			this.markdownEditMode = NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.bindTo(this.contextKeyService);
			this.cellRunState = NOTEBOOK_CELL_EXECUTION_STATE.bindTo(this.contextKeyService);
			this.cellHasOutputs = NOTEBOOK_CELL_HAS_OUTPUTS.bindTo(this.contextKeyService);
			this.cellContentCollapsed = NOTEBOOK_CELL_INPUT_COLLAPSED.bindTo(this.contextKeyService);
			this.cellOutputCollapsed = NOTEBOOK_CELL_OUTPUT_COLLAPSED.bindTo(this.contextKeyService);
			this.cellLineNumbers = NOTEBOOK_CELL_LINE_NUMBERS.bindTo(this.contextKeyService);

			this.updateForElement(element);
		});
	}

	public updateForElement(element: MarkdownCellViewModel | CodeCellViewModel) {
		this.elementDisposables.clear();
		this.elementDisposables.add(element.onDidChangeState(e => this.onDidChangeState(e)));

		if (element instanceof CodeCellViewModel) {
			this.elementDisposables.add(element.onDidChangeOutputs(() => this.updateForOutputs()));
		}

		this.elementDisposables.add(element.model.onDidChangeMetadata(() => this.updateForCollapseState()));
		this.elementDisposables.add(this.notebookEditor.onDidChangeActiveCell(() => this.updateForFocusState()));

		this.element = element;
		if (this.element instanceof MarkdownCellViewModel) {
			this.cellType.set('markup');
		} else if (this.element instanceof CodeCellViewModel) {
			this.cellType.set('code');
		}

		this.contextKeyService.bufferChangeEvents(() => {
			this.updateForFocusState();
			this.updateForInternalMetadata();
			this.updateForEditState();
			this.updateForCollapseState();
			this.updateForOutputs();

			this.cellLineNumbers.set(this.element.lineNumbers);
		});
	}

	private onDidChangeState(e: CellViewModelStateChangeEvent) {
		this.contextKeyService.bufferChangeEvents(() => {
			if (e.internalMetadataChanged) {
				this.updateForInternalMetadata();
			}

			if (e.editStateChanged) {
				this.updateForEditState();
			}

			if (e.focusModeChanged) {
				this.updateForFocusState();
			}

			if (e.cellLineNumberChanged) {
				this.cellLineNumbers.set(this.element.lineNumbers);
			}

			// if (e.collapseStateChanged) {
			// 	this.updateForCollapseState();
			// }
		});
	}

	private updateForFocusState() {
		const activeCell = this.notebookEditor.getActiveCell();
		this.cellFocused.set(this.notebookEditor.getActiveCell() === this.element);

		if (activeCell === this.element) {
			this.cellEditorFocused.set(this.element.focusMode === CellFocusMode.Editor);
		} else {
			this.cellEditorFocused.set(false);
		}

	}

	private updateForInternalMetadata() {
		const internalMetadata = this.element.internalMetadata;
		this.cellEditable.set(!this.notebookEditor.viewModel?.options.isReadOnly);

		const runState = internalMetadata.runState;
		if (this.element instanceof MarkdownCellViewModel) {
			this.cellRunState.reset();
		} else if (runState === NotebookCellExecutionState.Executing) {
			this.cellRunState.set('executing');
		} else if (runState === NotebookCellExecutionState.Pending) {
			this.cellRunState.set('pending');
		} else if (internalMetadata.lastRunSuccess === true) {
			this.cellRunState.set('succeeded');
		} else if (internalMetadata.lastRunSuccess === false) {
			this.cellRunState.set('failed');
		} else {
			this.cellRunState.set('idle');
		}
	}

	private updateForEditState() {
		if (this.element instanceof MarkdownCellViewModel) {
			this.markdownEditMode.set(this.element.getEditState() === CellEditState.Editing);
		} else {
			this.markdownEditMode.set(false);
		}
	}

	private updateForCollapseState() {
		this.cellContentCollapsed.set(!!this.element.metadata.inputCollapsed);
		this.cellOutputCollapsed.set(!!this.element.metadata.outputCollapsed);
	}

	private updateForOutputs() {
		if (this.element instanceof CodeCellViewModel) {
			this.cellHasOutputs.set(this.element.outputsViewModels.length > 0);
		} else {
			this.cellHasOutputs.set(false);
		}
	}
}
