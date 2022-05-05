/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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

export class AddRowAction extends Action {
	public static ID = 'designer.addColumnAction';
	public static ICON = 'add-row-button new codicon';
	public static LABEL = localize('designer.addColumnAction', 'Add New');

	constructor(private designer: Designer, tableProperties: DesignerTableProperties) {
		super(AddRowAction.ID, tableProperties.labelForAddNewButton || AddRowAction.LABEL, AddRowAction.ICON);
		this.designer = designer;
		this._tooltip = localize('designer.newRowButtonAriaLabel', "Add new row to '{0}' table", tableProperties.ariaLabel);
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
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

export class MoveRowUpAction extends Action {
	public static ID = 'designer.moveRowUpAction';
	public static ICON = 'move-row-up-button arrow-up codicon';
	public static LABEL = localize('designer.moveRowUpAction', 'Move Up');

	constructor(private designer: Designer) {
		super(MoveRowUpAction.ID, MoveRowUpAction.LABEL, MoveRowUpAction.ICON);
		this.designer = designer;
		this._tooltip = localize('designer.moveRowUpButtonAriaLabel', "Move selected row up one position");
		this.enabled = false;
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		let rowIndex = context.table.getSelectedRows()[0];
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
}

export class MoveRowDownAction extends Action {
	public static ID = 'designer.moveRowDownAction';
	public static ICON = 'move-row-down-button arrow-down codicon';
	public static LABEL = localize('designer.moveRowDownAction', 'Move Down');

	constructor(private designer: Designer) {
		super(MoveRowDownAction.ID, MoveRowDownAction.LABEL, MoveRowDownAction.ICON);
		this.designer = designer;
		this._tooltip = localize('designer.moveRowDownButtonAriaLabel', "Move selected row down one position");
		this.enabled = false;
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		let rowIndex = context.table.getSelectedRows()[0];
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
}

export class AddBeforeSelectedRowAction extends Action {
	public static ID = 'designer.addBeforeSelectedRow';
	public static LABEL = localize('designer.addBeforeSelectedRow', 'Add new row before');

	constructor(private designer: Designer) {
		super(AddBeforeSelectedRowAction.ID, AddBeforeSelectedRowAction.LABEL, 'addBeforeSelectedRow');
		this.designer = designer;
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		let rowIndex = context.selectedRow;
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

export class AddAfterSelectedRowAction extends Action {
	public static ID = 'designer.addAfterSelectedColumn';
	public static LABEL = localize('designer.addAfterSelectedRow', 'Add new row after');

	constructor(private designer: Designer) {
		super(AddAfterSelectedRowAction.ID, AddAfterSelectedRowAction.LABEL, 'addAfterSelectedRow');
	}

	public override async run(context: DesignerTableActionContext): Promise<void> {
		let rowIndex = context.selectedRow;
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
