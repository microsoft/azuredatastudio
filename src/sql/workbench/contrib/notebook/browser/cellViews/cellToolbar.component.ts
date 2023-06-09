/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./cellToolbar';
import * as DOM from 'vs/base/browser/dom';
import { Component, Inject, ViewChild, ElementRef, Input } from '@angular/core';
import { localize } from 'vs/nls';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DeleteCellAction, EditCellAction, CellToggleMoreActions, MoveCellAction, SplitCellAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { AddCodeCellAction, AddTextCellAction, ToggleAddCellDropdownAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
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
	public _cellToggleMoreActions: CellToggleMoreActions;

	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService
	) {
		this._cellToggleMoreActions = this.instantiationService.createInstance(CellToggleMoreActions);
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
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = this._cellContext;

		this.setupActions();
	}

	private setupActions(): void {
		this._disposableActions.clear();

		let toggleAddCellDropdown = this.instantiationService.createInstance(ToggleAddCellDropdownAction);
		this._disposableActions.add(toggleAddCellDropdown);

		let addCodeCellAction = this.instantiationService.createInstance(AddCodeCellAction);
		addCodeCellAction.cellType = CellTypes.Code;
		this._disposableActions.add(addCodeCellAction);

		let addTextCellAction = this.instantiationService.createInstance(AddTextCellAction);
		addTextCellAction.cellType = CellTypes.Markdown;
		this._disposableActions.add(addTextCellAction);

		let moveCellDownAction = this.instantiationService.createInstance(MoveCellAction, 'notebook.MoveCellDown', 'masked-icon move-down', this.buttonMoveDown);
		let moveCellUpAction = this.instantiationService.createInstance(MoveCellAction, 'notebook.MoveCellUp', 'masked-icon move-up', this.buttonMoveUp);
		this._disposableActions.add(moveCellDownAction);
		this._disposableActions.add(moveCellUpAction);

		let splitCellAction = this.instantiationService.createInstance(SplitCellAction, 'notebook.SplitCellAtCursor', this.buttonSplitCell, 'masked-icon icon-split-cell');
		splitCellAction.setListener(this._cellContext);
		splitCellAction.enabled = this.cellModel.cellType !== 'markdown';
		this._disposableActions.add(splitCellAction);

		let deleteAction = this.instantiationService.createInstance(DeleteCellAction, 'notebook.DeleteCell', 'masked-icon delete', this.buttonDelete);
		this._disposableActions.add(deleteAction);

		let moreActionsContainer = DOM.$('li.action-item');
		this._cellToggleMoreActions = this.instantiationService.createInstance(CellToggleMoreActions);
		this._cellToggleMoreActions.onInit(moreActionsContainer, this._cellContext);

		this._editCellAction = this.instantiationService.createInstance(EditCellAction, 'notebook.EditCell', true, this.cellModel.isEditMode);
		this._editCellAction.enabled = true;
		this._disposableActions.add(this._editCellAction);

		let addCellDropdownContainer = DOM.$('li.action-item');
		addCellDropdownContainer.setAttribute('role', 'presentation');
		let dropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			toggleAddCellDropdown,
			[addCodeCellAction, addTextCellAction],
			this.contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'codicon masked-icon new',
			'',
			undefined
		);
		dropdownMenuActionViewItem.render(addCellDropdownContainer);
		dropdownMenuActionViewItem.setActionContext(this._cellContext);

		let taskbarContent: ITaskbarContent[] = [];
		if (this.cellModel.cellType === CellTypes.Markdown) {
			taskbarContent.push(
				{ action: this._editCellAction }
			);
		}
		taskbarContent.push(
			{ element: addCellDropdownContainer },
			{ action: moveCellDownAction },
			{ action: moveCellUpAction },
			{ action: splitCellAction },
			{ action: deleteAction },
			{ element: moreActionsContainer });

		this._actionBar.setContent(taskbarContent);
	}

	public getEditCellAction(): EditCellAction {
		return this._editCellAction;
	}
}
