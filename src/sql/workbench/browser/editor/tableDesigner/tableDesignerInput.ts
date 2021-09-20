/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/workbench/workbench.web.api';

const NewTable: string = localize('tableDesigner.newTable', "New Table");

export class TableDesignerInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.tableDesignerInput';

	constructor(public readonly _connectionProfile: IConnectionProfile, private readonly tableName: string | undefined) {
		super();
	}

	get typeId(): string {
		return TableDesignerInput.ID;
	}

	get resource(): URI {
		return undefined;
	}

	override getName(): string {
		const tableName = this.tableName ?? NewTable;
		return `${this._connectionProfile.serverName}.${this._connectionProfile.databaseName} - ${tableName}`;
	}
}
