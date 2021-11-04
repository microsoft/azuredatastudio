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
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { onUnexpectedError } from 'vs/base/common/errors';

const NewTable: string = localize('tableDesigner.newTable', "New Table");

export class TableDesignerInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.tableDesignerInput';
	private _designerComponentInput: TableDesignerComponentInput;
	private _name: string;

	constructor(
		private _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IEditorService editorService: IEditorService) {
		super();
		this._designerComponentInput = this._instantiationService.createInstance(TableDesignerComponentInput, this._provider, this._tableInfo);
		this._register(this._designerComponentInput.onStateChange((e) => {
			if (e.currentState.dirty !== e.previousState.dirty) {
				this._onDidChangeDirty.fire();
			}
		}));
		const existingNames = editorService.editors.map(editor => editor.getName());

		if (this._tableInfo.isNewTable) {
			// Find the next available unique name for the new table designer
			let idx = 1;
			do {
				this._name = `${this._tableInfo.server}.${this._tableInfo.database} - ${NewTable} ${idx}`;
				idx++;
			} while (existingNames.indexOf(this._name) !== -1);
		} else {
			this._name = `${this._tableInfo.server}.${this._tableInfo.database} - ${this._tableInfo.schema}.${this._tableInfo.name}`;
		}
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
		return this._name;
	}

	override isDirty(): boolean {
		return this._designerComponentInput.dirty;
	}

	override isSaving(): boolean {
		return this._designerComponentInput.pendingAction === 'save';
	}

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		await this._designerComponentInput.save();
		return this;
	}

	override async revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> {
		await this._designerComponentInput.revert();
	}

	override matches(otherInput: any): boolean {
		return otherInput instanceof TableDesignerInput
			&& this._provider.providerId === otherInput._provider.providerId
			&& this._tableInfo.id === otherInput._tableInfo.id;
	}

	override dispose(): void {
		super.dispose();
		this._provider.disposeTableDesigner(this._tableInfo).then(undefined, err => onUnexpectedError(err));
	}
}
