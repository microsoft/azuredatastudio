/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import { groupBy } from 'vs/base/common/arrays'; {{SQL CARBON EDIT}}
import { CancellationToken } from 'vs/base/common/cancellation';
// import { compare } from 'vs/base/common/strings'; {{SQL CARBON EDIT}}
import { URI } from 'vs/base/common/uri';
import { ResourceEdit } from 'vs/editor/browser/services/bulkEditService';
import { WorkspaceEditMetadata } from 'vs/editor/common/languages';
import { IProgress } from 'vs/platform/progress/common/progress';
import { UndoRedoGroup, UndoRedoSource } from 'vs/platform/undoRedo/common/undoRedo';
import { ICellEditOperation } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { INotebookEditorModelResolverService } from 'vs/workbench/contrib/notebook/common/notebookEditorModelResolverService';

export class ResourceNotebookCellEdit extends ResourceEdit {

	constructor(
		readonly resource: URI,
		readonly cellEdit: ICellEditOperation,
		readonly versionId?: number,
		metadata?: WorkspaceEditMetadata
	) {
		super(metadata);
	}
}

export class BulkCellEdits {

	// {{SQL CARBON EDIT}} Remove private modifiers to fix value-not-read build errors
	constructor(
		_undoRedoGroup: UndoRedoGroup,
		undoRedoSource: UndoRedoSource | undefined,
		_progress: IProgress<void>,
		_token: CancellationToken,
		_edits: ResourceNotebookCellEdit[],
		@INotebookEditorModelResolverService _notebookModelService: INotebookEditorModelResolverService,
	) { }

	async apply(): Promise<readonly URI[]> {
		const resources: URI[] = [];
		// {{SQL CARBON EDIT}} Use our own notebooks
		// const editsByNotebook = groupBy(this._edits, (a, b) => compare(a.resource.toString(), b.resource.toString()));

		// for (let group of editsByNotebook) {
		// 	if (this._token.isCancellationRequested) {
		// 		break;
		// 	}
		// 	const [first] = group;
		// 	const ref = await this._notebookModelService.resolve(first.resource);

		// 	// check state
		// 	if (typeof first.versionId === 'number' && ref.object.notebook.versionId !== first.versionId) {
		// 		ref.dispose();
		// 		throw new Error(`Notebook '${first.resource}' has changed in the meantime`);
		// 	}

		// 	// apply edits
		// 	const edits = group.map(entry => entry.cellEdit);
		//	ref.object.notebook.applyEdits(edits, true, undefined, () => undefined, this._undoRedoGroup);
		// 	ref.dispose();

		// 	this._progress.report(undefined);

		//	resources.push(first.resource);
		// }

		return resources;
	}
}
