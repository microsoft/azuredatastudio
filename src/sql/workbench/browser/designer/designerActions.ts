/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Designer } from 'sql/workbench/browser/designer/designer';
import { DesignerEdit, DesignerEditType, DesignerTableProperties } from 'sql/workbench/browser/designer/interfaces';
import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';

export class AddColumnAction extends Action {
	public static ID = 'tableDesigner.addColumnAction';
	public static ICON = 'add-row-button new codicon';
	public static LABEL = localize('tableDesigner.addColumnAction', 'Add new row');

	constructor(private designer: Designer, tableProperties: DesignerTableProperties) {
		super(AddColumnAction.ID, AddColumnAction.LABEL, AddColumnAction.ICON);
		this.designer = designer;
		this._tooltip = localize('designer.newRowButtonAriaLabel', "Add new row to '{0}' table", tableProperties.ariaLabel);
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		Promise.resolve(() => {
			this.designer.handleEdit({
				type: DesignerEditType.Add,
				path: edit.path,
				source: edit.source
			});
		});
	}
}

export class MoveRowUpAction extends Action {
	public static ID = 'tableDesigner.moveRowUpAction';
	public static ICON = 'move-row-up-button arrow-up codicon';
	public static LABEL = localize('tableDesigner.moveRowUpAction', 'Move row up');

	constructor(private designer: Designer) {
		super(MoveRowUpAction.ID, MoveRowUpAction.LABEL, MoveRowUpAction.ICON);
		this.designer = designer;
		this._tooltip = localize('designer.moveRowButtonAriaLabel', "Move selected row up one position");
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		Promise.resolve(() => {
			this.designer.handleEdit({
				type: DesignerEditType.Move,
				path: edit.path,
				source: edit.source
			});
		});
	}
}

export class MoveRowDownAction extends Action {
	public static ID = 'tableDesigner.moveRowDownAction';
	public static ICON = 'move-row-down-button arrow-down codicon';
	public static LABEL = localize('tableDesigner.moveRowDownAction', 'Move row down');

	constructor(private designer: Designer) {
		super(MoveRowDownAction.ID, MoveRowDownAction.LABEL, MoveRowDownAction.ICON);
		this.designer = designer;
		this._tooltip = localize('designer.moveRowButtonAriaLabel', "Move selected row up one position");
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		Promise.resolve(() => {
			this.designer.handleEdit({
				type: DesignerEditType.Move,
				path: edit.path,
				source: edit.source
			});
		});
	}
}

export class AddBeforeSelectedColumnAction extends Action {
	public static ID = 'tableDesigner.addBeforeSelectedColumn';
	public static LABEL = localize('tableDesigner.addBeforeSelectedColumn', 'Add new column before');

	constructor(private designer: Designer) {
		super(AddBeforeSelectedColumnAction.ID, AddBeforeSelectedColumnAction.LABEL, 'addBeforeSelectedColumn');
		this.designer = designer;
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		Promise.resolve(() => {
			this.designer.handleEdit({
				type: DesignerEditType.Add,
				path: edit.path,
				source: edit.source
			}); // add index
		});
	}
}

export class AddAfterSelectedColumnAction extends Action {
	public static ID = 'tableDesigner.addAfterSelectedColumn';
	public static LABEL = localize('tableDesigner.addAfterSelectedColumn', 'Add new column after');

	constructor(private designer: Designer) {
		super(AddAfterSelectedColumnAction.ID, AddAfterSelectedColumnAction.LABEL, 'addAfterSelectedColumn');
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		Promise.resolve(() => {
			this.designer.handleEdit({
				type: DesignerEditType.Add,
				path: edit.path,
				source: edit.source
			}); // add index
		});
	}
}
