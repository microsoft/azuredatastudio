/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';

import { Component, Inject, Input, ViewChild, ElementRef } from '@angular/core';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/cellToggleMoreActions';
import { CellToolbarAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';

export const CELL_TOOLBAR_SELECTOR: string = 'cell-toolbar-component';

@Component({
	selector: CELL_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./cellToolbar.component.html'))
})
export class CellToolbarComponent {
	@ViewChild('celltoolbar', { read: ElementRef }) private celltoolbar: ElementRef;
	@ViewChild('moreactions', { read: ElementRef }) private moreActionsElementRef: ElementRef;

	public buttonEdit = localize('buttonEdit', "Edit");
	public buttonClose = localize('buttonClose', "Close");
	public buttonAdd = localize('buttonAdd', "Add new cell");
	public buttonDelete = localize('buttonDelete', "Delete cell");

	@Input() public cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}
	private _actionBar: Taskbar;
	private _model: NotebookModel;
	private _cellToggleMoreActions: CellToggleMoreActions;

	constructor(
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService
	) {
		this._cellToggleMoreActions = this._instantiationService.createInstance(CellToggleMoreActions);
	}

	get model(): NotebookModel {
		return this._model;
	}

	ngOnInit() {
		// Todo: Init one cell activation. Dispose when cell is inactive.
		this.initActionBar();
		// Adding this similar to how it's done in textCell.conponent
		this._cellToggleMoreActions.onInit(this.moreActionsElementRef, this.model, this.cellModel);
	}

	private initActionBar() {
		let editButton = this._instantiationService.createInstance(CellToolbarAction, 'notebook.editCell', '', 'codicon masked-icon edit', this.buttonEdit, this.cellModel);
		// Todo: Wire up toolbarToggleEditMode

		let closeButton = this._instantiationService.createInstance(CellToolbarAction, 'notebook.closeEditor', '', 'codicon masked-icon close', this.buttonClose, this.cellModel);
		// Todo: Wireup toolbarUnselectActiveCell

		let addButton = this._instantiationService.createInstance(CellToolbarAction, 'notebook.addCell', '', 'codicon masked-icon new', this.buttonAdd, this.cellModel);
		let deleteButton = this._instantiationService.createInstance(CellToolbarAction, 'notebook.deleteCell', '', 'codicon masked-icon delete', this.buttonDelete, this.cellModel);

		let taskbar = <HTMLElement>this.celltoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: editButton },
			{ action: closeButton },
			{ action: addButton },
			{ action: deleteButton }
			// Todo: Add cellToggleMoreActions to this list.
		]);
	}

	protected toggleMoreActionsButton(isActiveOrHovered: boolean) {
		this._cellToggleMoreActions.toggleVisible(!isActiveOrHovered);
	}
}
