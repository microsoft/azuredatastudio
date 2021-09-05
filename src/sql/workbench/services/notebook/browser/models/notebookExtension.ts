/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { deepClone } from 'vs/base/common/objects';

export class NotebookExtension<TNotebookMeta, TCellMeta> {
	readonly version = 1;
	readonly extensionName = 'azuredatastudio';
	readonly extensionNamespace = 'extensions';

	public getNotebookMetadata(notebook: INotebookModel): TNotebookMeta {
		const metadata = notebook.getMetaValue(this.extensionNamespace) || {};
		return metadata[this.extensionName] as TNotebookMeta;
	}

	public setNotebookMetadata(notebook: INotebookModel, metadata: TNotebookMeta) {
		const meta = {};
		meta[this.extensionName] = metadata;
		notebook.setMetaValue(this.extensionNamespace, meta);
		notebook.serializationStateChanged(NotebookChangeType.MetadataChanged);
	}

	public getCellMetadata(cell: ICellModel): TCellMeta {
		const namespaceMeta = cell.metadata[this.extensionNamespace] || {};
		return namespaceMeta[this.extensionName] as TCellMeta;
	}

	public setCellMetadata(cell: ICellModel, metadata: TCellMeta) {
		const meta = {};
		meta[this.extensionName] = metadata;
		cell.metadata[this.extensionNamespace] = meta;
		cell.metadata = deepClone(cell.metadata); // creating a new reference for change detection
		cell.sendChangeToNotebook(NotebookChangeType.CellsModified);
	}
}
