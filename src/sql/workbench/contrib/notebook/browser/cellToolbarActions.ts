/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { INotebookService, INotebookEditor } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookComponent } from 'sql/workbench/contrib/notebook/browser/notebook.component';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CellType } from 'sql/workbench/services/notebook/common/contracts';
import { CellToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/cellToggleMoreActions';
import { ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';

export const HIDDEN_CLASS = 'actionhidden';

export class CellToolbarAction extends Action {

	constructor(
		id: string,
		label: string,
		cssClass: string,
		tooltip: string,
		private _cellModel: ICellModel,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, label, cssClass);
		this._tooltip = tooltip;
	}
	// Todo: Add actions references here?
}

export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public async run(context: INotebookEditor): Promise<any> {
		//Add Cell after current selected cell.
		let index = 0;
		if (context && context.cells) {
			let notebookcomponent = context as NotebookComponent;
			let id = notebookcomponent.activeCellId;
			if (id) {
				index = context.cells.findIndex(cell => cell.id === id);
				index = index + 1;
			}
		}
		context.addCell(this.cellType, index);
	}
}

/**
 * Not yet implemeneted
 * Goal: show more actions available depending on what cell the toolbar is for.
 * (ie. runAlActions when on code cell.)
 */
export class MoreActions extends Action {
	private _cellToggleMoreActions: CellToggleMoreActions;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
}

export class EditCellAction extends ToggleableAction {
	// Constants
	private static readonly editLabel = localize('editLabel', "Edit");
	private static readonly closeLabel = localize('closeLabel', "Close");
	private static readonly baseClass = 'codicon';
	private static readonly editCssClass = 'edit';
	private static readonly closeCssClass = 'close';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(
		id: string, toggleTooltip: boolean
	) {
		super(id, {
			baseClass: EditCellAction.baseClass,
			toggleOnLabel: EditCellAction.closeLabel,
			toggleOnClass: EditCellAction.closeCssClass,
			toggleOffLabel: EditCellAction.editLabel,
			toggleOffClass: EditCellAction.editCssClass,
			maskedIconClass: EditCellAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: false
		});
	}

	public get editMode(): boolean {
		return this.state.isOn;
	}
	public set editMode(value: boolean) {
		this.toggle(value);
	}

	public run(context: INotebookEditor): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			try {
				self.editMode = !self.editMode;
				context.model.activeCell.active = self.editMode;
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}
