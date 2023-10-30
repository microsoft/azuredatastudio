/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import { groupBy } from 'vs/base/common/arrays'; {{SQL CARBON EDIT}}
import { CancellationToken } from 'vs/base/common/cancellation';
// import { compare } from 'vs/base/common/strings'; {{SQL CARBON EDIT}}
import { isObject } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { ResourceEdit } from 'vs/editor/browser/services/bulkEditService';
import { WorkspaceEditMetadata } from 'vs/editor/common/languages';
import { IProgress } from 'vs/platform/progress/common/progress';
import { UndoRedoGroup, UndoRedoSource } from 'vs/platform/undoRedo/common/undoRedo';
// import { getNotebookEditorFromEditorPane } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CellUri, ICellPartialMetadataEdit, ICellReplaceEdit, IDocumentMetadataEdit, IWorkspaceNotebookCellEdit } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { INotebookEditorModelResolverService } from 'vs/workbench/contrib/notebook/common/notebookEditorModelResolverService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class ResourceNotebookCellEdit extends ResourceEdit implements IWorkspaceNotebookCellEdit {

	static is(candidate: any): candidate is IWorkspaceNotebookCellEdit {
		if (candidate instanceof ResourceNotebookCellEdit) {
			return true;
		}
		return URI.isUri((<IWorkspaceNotebookCellEdit>candidate).resource)
			&& isObject((<IWorkspaceNotebookCellEdit>candidate).cellEdit);
	}

	static lift(edit: IWorkspaceNotebookCellEdit): ResourceNotebookCellEdit {
		if (edit instanceof ResourceNotebookCellEdit) {
			return edit;
		}
		return new ResourceNotebookCellEdit(edit.resource, edit.cellEdit, edit.notebookVersionId, edit.metadata);
	}

	constructor(
		readonly resource: URI,
		readonly cellEdit: ICellPartialMetadataEdit | IDocumentMetadataEdit | ICellReplaceEdit,
		readonly notebookVersionId: number | undefined = undefined,
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
		@IEditorService readonly _editorService: IEditorService,
		@INotebookEditorModelResolverService _notebookModelService: INotebookEditorModelResolverService,
	) {
		_edits = _edits.map(e => {
			if (e.resource.scheme === CellUri.scheme) {
				const uri = CellUri.parse(e.resource)?.notebook;
				if (!uri) {
					throw new Error(`Invalid notebook URI: ${e.resource}`);
				}

				return new ResourceNotebookCellEdit(uri, e.cellEdit, e.notebookVersionId, e.metadata);
			} else {
				return e;
			}
		});
	}

	async apply(): Promise<readonly URI[]> {
		const resources: URI[] = [];
		// {{SQL CARBON EDIT}} Use our own notebooks
		// const editsByNotebook = groupBy(this._edits, (a, b) => compare(a.resource.toString(), b.resource.toString()));

		// for (const group of editsByNotebook) {
		// 	if (this._token.isCancellationRequested) {
		// 		break;
		// 	}
		// 	const [first] = group;
		// 	const ref = await this._notebookModelService.resolve(first.resource);

		// 	// check state
		// 	if (typeof first.notebookVersionId === 'number' && ref.object.notebook.versionId !== first.notebookVersionId) {
		// 		ref.dispose();
		// 		throw new Error(`Notebook '${first.resource}' has changed in the meantime`);
		// 	}

		// 	// apply edits
		// 	const edits = group.map(entry => entry.cellEdit);
		//	const computeUndo = !ref.object.isReadonly();
		//	const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
		//	const initialSelectionState: ISelectionState | undefined = editor?.textModel?.uri.toString() === ref.object.notebook.uri.toString() ? {
		//		kind: SelectionStateType.Index,
		//		focus: editor.getFocus(),
		//		selections: editor.getSelections()
		//	} : undefined;
		//	ref.object.notebook.applyEdits(edits, true, undefined, () => undefined, this._undoRedoGroup, true);
		// 	ref.dispose();

		// 	this._progress.report(undefined);

		//	resources.push(first.resource);
		// }

		return resources;
	}
}
