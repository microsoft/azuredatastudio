/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./cellToolbar';
import { Component, Inject, ViewChild, ElementRef, Input } from '@angular/core';
import { localize } from 'vs/nls';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DeleteCellAction, EditCellAction, CellToggleMoreActionViewItem, MoveCellAction, SplitCellAction, CellToggleMoreAction, ToggleAddCellDropdownAction, ToggleAddCellActionViewItem } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';

export const CELL_TOOLBAR_SELECTOR: string = 'cell-toolbar-component';

@Component({
	selector: CELL_TOOLBAR_SELECTOR,
	template: `<div #celltoolbar></div>`
})
export class CellToolbarComponent {
	@ViewChild('celltoolbar', { read: ElementRef }) private celltoolbar: ElementRef;

	public buttonAdd = localize('buttonAdd', "Add cell");
	public optionCodeCell = localize('optionCodeCell', "Code cell");
	public optionTextCell = localize('optionTextCell', "Text cell");
	public buttonMoveDown = localize('buttonMoveDown', "Move cell down");
	public buttonMoveUp = localize('buttonMoveUp', "Move cell up");
	public buttonDelete = localize('buttonDelete', "Delete");
	public buttonSplitCell = localize('splitCell', "Split cell");

	@Input() cellModel: ICellModel;
	@Input() model: NotebookModel;

	private _actionBar: Taskbar;
	private _disposableActions: DisposableStore;
	private _editCellAction: EditCellAction;
	private _cellContext: CellContext;
	private _typeChangedListener: IDisposable;

	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService
	) {
		this._disposableActions = new DisposableStore();
	}

	ngOnInit() {
		this.initActionBar();
		this._typeChangedListener = this.model.onCellTypeChanged(cell => {
			if (cell === this.cellModel) {
				this.setupActions();
			}
		});
	}

	ngOnDestroy() {
		this._typeChangedListener.dispose();
	}

	protected initActionBar(): void {
		this._cellContext = new CellContext(this.model, this.cellModel);
		let taskbar = <HTMLElement>this.celltoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar, {
			actionViewItemProvider: action => {
				if (action.id === ToggleAddCellDropdownAction.ID) {
					return this.instantiationService.createInstance(ToggleAddCellActionViewItem, action, this._actionBar.actionRunner, this._cellContext);
				} else if (action.id === CellToggleMoreAction.ID) {
					return this.instantiationService.createInstance(CellToggleMoreActionViewItem, action, this._actionBar.actionRunner, this._cellContext);
				}
				return undefined;
			}
		});
		this._actionBar.context = this._cellContext;

		this.setupActions();
	}

	private setupActions(): void {
		this._disposableActions.clear();

		const toggleAddCellDropdownAction = this._disposableActions.add(this.instantiationService.createInstance(ToggleAddCellDropdownAction));

		const moveCellDownAction = this._disposableActions.add(this.instantiationService.createInstance(MoveCellAction, 'notebook.MoveCellDown', 'masked-icon move-down', this.buttonMoveDown));
		const moveCellUpAction = this._disposableActions.add(this.instantiationService.createInstance(MoveCellAction, 'notebook.MoveCellUp', 'masked-icon move-up', this.buttonMoveUp));

		const splitCellAction = this._disposableActions.add(this.instantiationService.createInstance(SplitCellAction, 'notebook.SplitCellAtCursor', this.buttonSplitCell, 'masked-icon icon-split-cell'));
		splitCellAction.setListener(this._cellContext);
		splitCellAction.enabled = this.cellModel.cellType !== 'markdown';

		const deleteAction = this._disposableActions.add(this.instantiationService.createInstance(DeleteCellAction, 'notebook.DeleteCell', 'masked-icon delete', this.buttonDelete));

		this._editCellAction = this._disposableActions.add(this.instantiationService.createInstance(EditCellAction, 'notebook.EditCell', true, this.cellModel.isEditMode));
		this._editCellAction.enabled = true;

		const moreAction = this._disposableActions.add(this.instantiationService.createInstance(CellToggleMoreAction));

		const taskbarContent: ITaskbarContent[] = [];
		if (this.cellModel.cellType === CellTypes.Markdown) {
			taskbarContent.push(
				{ action: this._editCellAction }
			);
		}
		taskbarContent.push(
			{ action: toggleAddCellDropdownAction },
			{ action: moveCellDownAction },
			{ action: moveCellUpAction },
			{ action: splitCellAction },
			{ action: deleteAction },
			{ action: moreAction }
		);

		this._actionBar.setContent(taskbarContent);
	}

	public getEditCellAction(): EditCellAction {
		return this._editCellAction;
	}
}
