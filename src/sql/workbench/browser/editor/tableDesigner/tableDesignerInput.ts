/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { TableDesignerComponentInput } from 'sql/workbench/services/tableDesigner/browser/tableDesignerComponentInput';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import * as azdata from 'azdata';
import { GroupIdentifier, IRevertOptions, ISaveOptions } from 'vs/workbench/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Schemas } from 'sql/base/common/schemas';
import { INotificationService } from 'vs/platform/notification/common/notification';

enum TableIcon {
	Basic = 'Basic',
	Temporal = 'Temporal',
	GraphEdge = 'GraphEdge',
	GraphNode = 'GraphNode'
}
export class TableDesignerInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.tableDesignerInput';
	private _designerComponentInput: TableDesignerComponentInput;
	private _title: string;
	private _name: string;
	private _tableIcon: azdata.designers.TableIcon;
	private _tableIconMap: Map<TableIcon, string> = new Map<TableIcon, string>([
		[TableIcon.Basic, 'table-basic'],
		[TableIcon.Temporal, 'table-temporal'],
		[TableIcon.GraphEdge, 'table-graphedge'],
		[TableIcon.GraphNode, 'table-graphnode']
	]);


	constructor(
		private _provider: TableDesignerProvider,
		tableInfo: azdata.designers.TableInfo,
		telemetryInfo: { [key: string]: string },
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@INotificationService private readonly _notificationService: INotificationService) {
		super();
		this._designerComponentInput = this._instantiationService.createInstance(TableDesignerComponentInput, this._provider, tableInfo, telemetryInfo);
		this._register(this._designerComponentInput.onStateChange((e) => {
			if (e.previousState.pendingAction === 'publish') {
				this.setEditorLabel();
			}
			if (e.currentState.dirty !== e.previousState.dirty) {
				this._onDidChangeDirty.fire();
			}
		}));
		this._register(this._designerComponentInput.onInitialized(() => {
			this.setEditorLabel();
		}));

		// default to basic if icon is null (new table) or no sub type
		this._tableIcon = tableInfo.tableIcon ? tableInfo.tableIcon as TableIcon : TableIcon.Basic;
		this.setEditorLabel();
	}

	get typeId(): string {
		return TableDesignerInput.ID;
	}

	public get resource(): URI {
		return URI.from({
			scheme: Schemas.tableDesigner,
			path: this._tableIconMap.get(this._tableIcon)
		});
	}

	public getComponentInput(): TableDesignerComponentInput {
		return this._designerComponentInput;
	}

	override getName(): string {
		return this._name;
	}

	override getTitle(): string {
		return this._title;
	}

	override isDirty(): boolean {
		return this._designerComponentInput.dirty;
	}

	override isSaving(): boolean {
		return this._designerComponentInput.pendingAction === 'publish';
	}

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<EditorInput | undefined> {
		if (this._designerComponentInput.pendingAction) {
			this._notificationService.warn(localize('tableDesigner.OperationInProgressWarning', "The operation cannot be performed while another operation is in progress."));
		} else {
			await this._designerComponentInput.save();
		}
		return this;
	}

	override async revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> {
		await this._designerComponentInput.revert();
	}

	override matches(otherInput: any): boolean {
		return otherInput instanceof TableDesignerInput
			&& this._provider.providerId === otherInput._provider.providerId
			&& this._designerComponentInput.tableInfo.id === otherInput._designerComponentInput.tableInfo.id;
	}

	override dispose(): void {
		super.dispose();
		this._provider.disposeTableDesigner(this._designerComponentInput.tableInfo).then(undefined, err => onUnexpectedError(err));
	}

	private setEditorLabel(): void {
		this._name = this._designerComponentInput.tableInfo.title;
		this._title = this._designerComponentInput.tableInfo.tooltip;
		this._onDidChangeLabel.fire();
	}
}
