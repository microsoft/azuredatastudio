/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import * as DOM from 'vs/base/browser/dom';
import { Component, Inject, ViewChild, ElementRef, Input } from '@angular/core';
import { localize } from 'vs/nls';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DeleteCellAction, EditCellAction, CellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { AddCellAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';

export const CELL_TOOLBAR_SELECTOR: string = 'cell-toolbar-component';

@Component({
	selector: CELL_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./cellToolbar.component.html'))
})
export class CellToolbarComponent {
	@ViewChild('celltoolbar', { read: ElementRef }) private celltoolbar: ElementRef;

	public buttonEdit = localize('buttonEdit', "Edit");
	public buttonClose = localize('buttonClose', "Close");
	public buttonAdd = localize('buttonAdd', "Add new cell");
	public buttonDelete = localize('buttonDelete', "Delete cell");
	public buttonMoreActions = localize('buttonMoreActions', "More actions");

	@Input() cellModel: ICellModel;
	@Input() model: NotebookModel;

	private _actionBar: Taskbar;
	private _editCellAction: EditCellAction;
	public _cellToggleMoreActions: CellToggleMoreActions;

	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService
	) {
	}

	ngOnInit() {
		this.initActionBar();
	}

	protected initActionBar(): void {
		let _context = new CellContext(this.model, this.cellModel);
		let addCodeCellButton = new AddCellAction('notebook.AddCodeCell', localize('codePreview', "Code cell"), 'notebook-button masked-pseudo code');
		addCodeCellButton.cellType = CellTypes.Code;

		let addTextCellButton = new AddCellAction('notebook.AddTextCell', localize('textPreview', "Markdown cell"), 'notebook-button masked-pseudo markdown');
		addTextCellButton.cellType = CellTypes.Markdown;

		let deleteButton = this.instantiationService.createInstance(DeleteCellAction, 'delete', 'codicon masked-icon delete', localize('delete', "Delete"));

		// Todo: Get this to show the list of actions specific to code or markdown cell.
		//this._cellToggleMoreActions = this.instantiationService.createInstance(CellToggleMoreActions, 'codicon masked-icon more');

		// Todo: Wire up toolbarToggleEditMode
		// Todo: Wire up toolbarUnselectActiveCell
		this._editCellAction = this.instantiationService.createInstance(EditCellAction, 'notebook.editCell', true, this.cellModel.isEditMode);
		this._editCellAction.enabled = true;

		let taskbar = <HTMLElement>this.celltoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = _context;

		let buttonDropdownContainer = DOM.$('li.action-item');
		buttonDropdownContainer.setAttribute('role', 'presentation');
		let dropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			addCodeCellButton,
			[addCodeCellButton, addTextCellButton],
			this.contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'codicon masked-icon new',
			localize('addCell', "Cell"),
			undefined
		);
		dropdownMenuActionViewItem.render(buttonDropdownContainer);
		dropdownMenuActionViewItem.setActionContext(this);

		this._actionBar.setContent([
			{ action: this._editCellAction },
			{ element: buttonDropdownContainer },
			{ action: deleteButton },
			//{ action: this._cellToggleMoreActions }
		]);
	}
}
