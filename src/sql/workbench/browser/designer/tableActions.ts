/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { Designer } from 'sql/workbench/browser/designer/designer';
import { DesignerEditType, DesignerPropertyPath, DesignerTableProperties, DesignerUIArea } from 'sql/workbench/browser/designer/interfaces';
import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';

export interface DesignerTableActionContext {
	table: Table<Slick.SlickData>;
	path: DesignerPropertyPath;
	source: DesignerUIArea;
	selectedRow?: number;
}

export class DesignerTableAction extends Action {

	protected _table: Table<Slick.SlickData>;

	constructor(
		private _designer: Designer,
		id: string,
		label: string,
		icon: string,
		protected needsRowSelection: boolean
	) {
		super(id, label, icon);
	}


	public set table(table: Table<Slick.SlickData>) {
		this._table = table;
	}

	public updateState(row?: number) {
		if (row === undefined) {
			if (!this.needsRowSelection) {
				this.enabled = true;
			} else {
				this.enabled = false;
			}
		}
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		await this._designer.submitPendingChanges();
	}
}

export class AddRowAction extends DesignerTableAction {
	public static ID = 'designer.addRowAction';
	public static ICON = 'add-row-button new codicon';
	public static LABEL = localize('designer.addColumnAction', 'Add New');

	constructor(
		private designer: Designer,
		tableProperties: DesignerTableProperties,
	) {
		super(designer, AddRowAction.ID, tableProperties.labelForAddNewButton || AddRowAction.LABEL, AddRowAction.ICON, false);
		this.designer = designer;
		this._tooltip = localize('designer.newRowButtonAriaLabel', "Add new row to '{0}' table", tableProperties.ariaLabel);
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		await super.run(context);
		const lastIndex = context.table.getData().getItems().length;
		return new Promise((resolve) => {
			this.designer.handleEdit({
				type: DesignerEditType.Add,
				path: [...context.path, lastIndex],
				source: context.source,
			});
			resolve();
		});
	}
}

export class MoveRowUpAction extends DesignerTableAction {
	public static ID = 'designer.moveRowUpAction';
	public static ICON = 'move-row-up-button arrow-up codicon';
	public static LABEL = localize('designer.moveRowUpAction', 'Move Up');

	constructor(private designer: Designer) {
		super(designer, MoveRowUpAction.ID, MoveRowUpAction.LABEL, MoveRowUpAction.ICON, true);
		this.designer = designer;
		this._tooltip = localize('designer.moveRowUpButtonAriaLabel', "Move selected row up one position");
		this.enabled = false;
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		await super.run(context);
		let rowIndex = context.selectedRow ?? context.table.getSelectedRows()[0];
		if (rowIndex - 1 < 0) {
			return;
		}
		return new Promise((resolve) => {
			this.designer.handleEdit({
				type: DesignerEditType.Move,
				path: [...context.path, rowIndex],
				source: context.source,
				value: rowIndex - 1
			});
			resolve();
		});
	}

	public override updateState(row?: number): void {
		if (row === 0) {
			this.enabled = false;
		} else {
			this.enabled = true;
		}
		super.updateState(row);
	}
}

export class MoveRowDownAction extends DesignerTableAction {
	public static ID = 'designer.moveRowDownAction';
	public static ICON = 'move-row-down-button arrow-down codicon';
	public static LABEL = localize('designer.moveRowDownAction', 'Move Down');

	constructor(private designer: Designer) {
		super(designer, MoveRowDownAction.ID, MoveRowDownAction.LABEL, MoveRowDownAction.ICON, true);
		this.designer = designer;
		this._tooltip = localize('designer.moveRowDownButtonAriaLabel', "Move selected row down one position");
		this.enabled = false;
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		await super.run(context);
		let rowIndex = context.selectedRow ?? context.table.getSelectedRows()[0];
		const tableData = context.table.getData().getItems();
		if (rowIndex + 1 >= tableData.length) {
			return;
		}
		return new Promise((resolve) => {
			this.designer.handleEdit({
				type: DesignerEditType.Move,
				path: [...context.path, rowIndex],
				source: context.source,
				value: rowIndex + 1
			});
			resolve();
		});
	}

	public override updateState(row?: number): void {
		super.updateState(row);
		if (row === this._table.getData().getLength() - 1) {
			this.enabled = false;
		} else {
			this.enabled = true;
		}
		super.updateState(row);
	}
}

export class InsertBeforeSelectedRowAction extends Action {
	public static ID = 'designer.insertBeforeSelectedRow';
	public static LABEL = localize('designer.insertBeforeSelectedRow', 'Insert Before');

	constructor(private designer: Designer) {
		super(InsertBeforeSelectedRowAction.ID, InsertBeforeSelectedRowAction.LABEL, 'insertBeforeSelectedRow', true);
		this.designer = designer;
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		const rowIndex = context.selectedRow;
		return new Promise((resolve) => {
			this.designer.handleEdit({
				type: DesignerEditType.Add,
				path: [...context.path, rowIndex],
				source: context.source
			});
			resolve();
		});
	}
}

export class InsertAfterSelectedRowAction extends Action {
	public static ID = 'designer.insertAfterSelectedColumn';
	public static LABEL = localize('designer.insertAfterSelectedColumn', 'Insert After');

	constructor(private designer: Designer) {
		super(InsertAfterSelectedRowAction.ID, InsertAfterSelectedRowAction.LABEL, 'insertAfterSelectedColumn', true);
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		const rowIndex = context.selectedRow;
		return new Promise((resolve) => {
			this.designer.handleEdit({
				type: DesignerEditType.Add,
				path: [...context.path, rowIndex + 1],
				source: context.source
			});
			resolve();
		});
	}
}
