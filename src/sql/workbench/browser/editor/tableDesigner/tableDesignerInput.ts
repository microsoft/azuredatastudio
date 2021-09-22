/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/workbench/workbench.web.api';
import { TableDesignerComponentInput } from 'sql/workbench/services/tableDesigner/browser/tableDesignerComponentInput';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import * as azdata from 'azdata';

const NewTable: string = localize('tableDesigner.newTable', "New Table");

export class TableDesignerInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.tableDesignerInput';
	private _designerComponentInput: TableDesignerComponentInput;
	constructor(provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo) {
		super();
		this._designerComponentInput = new TableDesignerComponentInput(provider, this._tableInfo);
	}

	get typeId(): string {
		return TableDesignerInput.ID;
	}

	get resource(): URI {
		return undefined;
	}

	public getComponentInput(): TableDesignerComponentInput {
		return this._designerComponentInput;
	}

	override getName(): string {
		const tableName = this._tableInfo.isNewTable ? NewTable : `${this._tableInfo.schema}.${this._tableInfo.name}`;
		return `${this._tableInfo.server}.${this._tableInfo.database} - ${tableName}`;
	}
}
