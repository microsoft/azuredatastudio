/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { deepClone } from 'vs/base/common/objects';

export class NotebookExtension<TNotebookMeta, TCellMeta> {
	readonly version = 1;
	readonly extensionNamespace = 'extensions';

	private _extensionName: string;

	public constructor(extensionName: string) {
		this._extensionName = extensionName;
	}

	public get extensionName(): string {
		return this._extensionName;
	}

	public getExtensionMetadata(notebook: INotebookModel): TNotebookMeta {
		const metadata = notebook.getMetaValue(this.extensionNamespace) || {};
		return metadata[this.extensionName] as TNotebookMeta;
	}

	public setExtensionMetadata(notebook: INotebookModel, metadata: TNotebookMeta) {
		const meta = {};
		meta[this.extensionName] = metadata;
		notebook.setMetaValue(this.extensionNamespace, meta);
		notebook.serializationStateChanged(NotebookChangeType.MetadataChanged);
	}

	public getExtensionCellMetadata(cell: ICellModel): TCellMeta {
		const namespaceMeta = cell.metadata[this.extensionNamespace] || {};
		return namespaceMeta[this.extensionName] as TCellMeta;
	}

	public setExtensionCellMetadata(cell: ICellModel, metadata: TCellMeta) {
		const meta = {};
		meta[this.extensionName] = metadata;
		cell.metadata[this.extensionNamespace] = meta;
		cell.metadata = deepClone(cell.metadata); // creating a new reference for change detection
		cell.sendChangeToNotebook(NotebookChangeType.CellsModified);
	}
}
