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
import { GroupIdentifier, IEditorInput, IRevertOptions, ISaveOptions } from 'vs/workbench/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const NewTable: string = localize('tableDesigner.newTable', "New Table");

export class TableDesignerInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.tableDesignerInput';
	private _designerComponentInput: TableDesignerComponentInput;
	constructor(
		private _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo,
		@IInstantiationService private readonly _instantiationService: IInstantiationService) {
		super();
		this._designerComponentInput = this._instantiationService.createInstance(TableDesignerComponentInput, this._provider, this._tableInfo);
		this._register(this._designerComponentInput.onStateChange((e) => {
			this._onDidChangeDirty.fire();
		}));
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

	override isDirty(): boolean {
		return this._designerComponentInput.dirty;
	}

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		await this._designerComponentInput.save();
		return this;
	}

	override async revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> {
		this._designerComponentInput.updateState(true, false);
	}

	override matches(otherInput: any): boolean {
		if (otherInput === this) {
			return true;
		}
		return otherInput instanceof TableDesignerInput
			&& this._provider.providerId === otherInput._provider.providerId
			&& (this._tableInfo.isNewTable !== true && otherInput._tableInfo.isNewTable !== true)
			&& this._tableInfo.id === otherInput._tableInfo.id;
	}
}
