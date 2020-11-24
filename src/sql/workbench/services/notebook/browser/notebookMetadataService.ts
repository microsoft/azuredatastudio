/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { INotebookViewCellMetadata, INotebookViewMetadata } from 'sql/workbench/services/notebook/browser/models/notebookViewModel';

export class NotebookMetadataService {
	readonly version = 1;
	readonly serviceName = 'azuredatastudio';
	readonly serviceNamespace = 'extensions';

	public getNotebookMetadata(notebook: INotebookModel): INotebookViewMetadata {
		const metadata = notebook.getMetaValue(this.serviceNamespace) || {};
		return metadata[this.serviceName] as INotebookViewMetadata;
	}

	public setNotebookMetadata(notebook: INotebookModel, metadata: INotebookViewMetadata) {
		const meta = {};
		meta[this.serviceName] = metadata;
		notebook.setMetaValue(this.serviceNamespace, meta);
		notebook.serializationStateChanged(NotebookChangeType.MetadataChanged);
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCellMetadata {
		const namespaceMeta = cell.metadata[this.serviceNamespace] || {};
		return namespaceMeta[this.serviceName];
	}

	public setCellMetadata(cell: ICellModel, metadata: INotebookViewCellMetadata) {
		const meta = {};
		meta[this.serviceName] = metadata;
		cell.metadata[this.serviceNamespace] = meta;
		cell.sendChangeToNotebook(NotebookChangeType.CellsModified);
	}
}
