/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Designer } from 'sql/workbench/browser/designer/designer';
import { DesignerEdit, DesignerEditType } from 'sql/workbench/browser/designer/interfaces';
import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';

export class AddBeforeSelectedColumn extends Action {
	public static ID = 'tableDesigner.addBeforeSelectedColumn';
	public static LABEL = localize('tableDesigner.addBeforeSelectedColumn', 'Add new column before');

	constructor(private designer: Designer) {
		super(AddBeforeSelectedColumn.ID, AddBeforeSelectedColumn.LABEL, 'addBeforeSelectedColumn');
		this.designer = designer;
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		return new Promise((resolve, reject) => {
			// First add the column
			this.designer.handleEdit(edit);

			// Then move the column
			let moveEdit: DesignerEdit = Object.assign({}, edit);
			moveEdit.type = DesignerEditType.Move;
			moveEdit.value['toIndex'] = moveEdit.value['fromIndex'] - 1;
			this.designer.handleEdit(edit);
			resolve();
		});
	}
}

export class AddAfterSelectedColumn extends Action {
	public static ID = 'tableDesigner.addAfterSelectedColumn';
	public static LABEL = localize('tableDesigner.addAfterSelectedColumn', 'Add new column after');

	constructor(private designer: Designer) {
		super(AddAfterSelectedColumn.ID, AddAfterSelectedColumn.LABEL, 'addAfterSelectedColumn');
	}

	public override async run(edit: DesignerEdit): Promise<void> {
		return new Promise((resolve, reject) => {
			// First add the column
			this.designer.handleEdit(edit);

			// Then move the column
			let moveEdit: DesignerEdit = Object.assign({}, edit);
			moveEdit.type = DesignerEditType.Move;
			moveEdit.value['toIndex'] = moveEdit.value['fromIndex'] + 1;
			this.designer.handleEdit(edit);
			resolve();
		});
	}
}
