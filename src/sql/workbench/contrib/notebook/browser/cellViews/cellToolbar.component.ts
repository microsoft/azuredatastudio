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
import { DeleteCellAction, EditCellAction, CellToggleMoreActions, MoveCellAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { AddCellAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';

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

	@Input() cellModel: ICellModel;
	@Input() model: NotebookModel;

	private _actionBar: Taskbar;
	private _editCellAction: EditCellAction;
	public _cellToggleMoreActions: CellToggleMoreActions;

	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService
	) {
		this._cellToggleMoreActions = this.instantiationService.createInstance(CellToggleMoreActions);
	}

	ngOnInit() {
		this.initActionBar();
	}

	protected initActionBar(): void {
		let context = new CellContext(this.model, this.cellModel);
		let taskbar = <HTMLElement>this.celltoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = context;

		let addCellsButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddCodeCell', localize('codeCellsPreview', "Add cell"), 'notebook-button masked-pseudo code');

		let addCodeCellButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddCodeCell', localize('codePreview', "Code cell"), 'notebook-button masked-pseudo code');
		addCodeCellButton.cellType = CellTypes.Code;

		let addTextCellButton = this.instantiationService.createInstance(AddCellAction, 'notebook.AddTextCell', localize('textPreview', "Text cell"), 'notebook-button masked-pseudo markdown');
		addTextCellButton.cellType = CellTypes.Markdown;

		let moveCellDownButton = this.instantiationService.createInstance(MoveCellAction, 'notebook.MoveCellDown', 'masked-icon move-down', this.buttonMoveDown);
		let moveCellUpButton = this.instantiationService.createInstance(MoveCellAction, 'notebook.MoveCellUp', 'masked-icon move-up', this.buttonMoveUp);

		let deleteButton = this.instantiationService.createInstance(DeleteCellAction, 'notebook.DeleteCell', 'masked-icon delete', this.buttonDelete);

		let moreActionsContainer = DOM.$('li.action-item');
		this._cellToggleMoreActions = this.instantiationService.createInstance(CellToggleMoreActions);
		this._cellToggleMoreActions.onInit(moreActionsContainer, context);

		this._editCellAction = this.instantiationService.createInstance(EditCellAction, 'notebook.EditCell', true, this.cellModel.isEditMode);
		this._editCellAction.enabled = true;

		let addCellDropdownContainer = DOM.$('li.action-item');
		addCellDropdownContainer.setAttribute('role', 'presentation');
		let dropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			addCellsButton,
			[addCodeCellButton, addTextCellButton],
			this.contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'codicon masked-icon new',
			'',
			undefined
		);
		dropdownMenuActionViewItem.render(addCellDropdownContainer);
		dropdownMenuActionViewItem.setActionContext(context);

		let taskbarContent: ITaskbarContent[] = [];
		if (this.cellModel?.cellType === CellTypes.Markdown) {
			taskbarContent.push({ action: this._editCellAction });
		}
		taskbarContent.push(
			{ element: addCellDropdownContainer },
			{ action: moveCellDownButton },
			{ action: moveCellUpButton },
			{ action: deleteButton },
			{ element: moreActionsContainer });

		this._actionBar.setContent(taskbarContent);
	}
}
