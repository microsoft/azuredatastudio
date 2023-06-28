/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* {{SQL CARBON EDIT}} Disable notebook breakpoints because the debug service is not enabled
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ResourceMap } from 'vs/base/common/map';
import { Schemas } from 'vs/base/common/network';
import { isEqual } from 'vs/base/common/resources';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContribution, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { IBreakpoint, IDebugService } from 'vs/workbench/contrib/debug/common/debug';
import { getNotebookEditorFromEditorPane } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { NotebookTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookTextModel';
import { CellUri, NotebookCellsChangeType } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';

class NotebookBreakpoints extends Disposable implements IWorkbenchContribution {
	constructor(
		@IDebugService private readonly _debugService: IDebugService,
		@INotebookService _notebookService: INotebookService,
		@IEditorService private readonly _editorService: IEditorService,
	) {
		super();

		const listeners = new ResourceMap<IDisposable>();
		this._register(_notebookService.onWillAddNotebookDocument(model => {
			listeners.set(model.uri, model.onWillAddRemoveCells(e => {
				// When deleting a cell, remove its breakpoints
				const debugModel = this._debugService.getModel();
				if (!debugModel.getBreakpoints().length) {
					return;
				}

				if (e.rawEvent.kind !== NotebookCellsChangeType.ModelChange) {
					return;
				}

				for (const change of e.rawEvent.changes) {
					const [start, deleteCount] = change;
					if (deleteCount > 0) {
						const deleted = model.cells.slice(start, start + deleteCount);
						for (const deletedCell of deleted) {
							const cellBps = debugModel.getBreakpoints({ uri: deletedCell.uri });
							cellBps.forEach(cellBp => this._debugService.removeBreakpoints(cellBp.getId()));
						}
					}
				}
			}));
		}));

		this._register(_notebookService.onWillRemoveNotebookDocument(model => {
			this.updateBreakpoints(model);
			listeners.get(model.uri)?.dispose();
			listeners.delete(model.uri);
		}));

		this._register(this._debugService.getModel().onDidChangeBreakpoints(e => {
			const newCellBp = e?.added?.find(bp => 'uri' in bp && bp.uri.scheme === Schemas.vscodeNotebookCell) as IBreakpoint | undefined;
			if (newCellBp) {
				const parsed = CellUri.parse(newCellBp.uri);
				if (!parsed) {
					return;
				}

				const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
				if (!editor || !editor.hasModel() || editor.textModel.uri.toString() !== parsed.notebook.toString()) {
					return;
				}


				const cell = editor.getCellByHandle(parsed.handle);
				if (!cell) {
					return;
				}

				editor.focusElement(cell);
			}
		}));
	}

	private updateBreakpoints(model: NotebookTextModel): void {
		const bps = this._debugService.getModel().getBreakpoints();
		if (!bps.length || !model.cells.length) {
			return;
		}

		const idxMap = new ResourceMap<number>();
		model.cells.forEach((cell, i) => {
			idxMap.set(cell.uri, i);
		});

		bps.forEach(bp => {
			const idx = idxMap.get(bp.uri);
			if (typeof idx !== 'number') {
				return;
			}

			const notebook = CellUri.parse(bp.uri)?.notebook;
			if (!notebook) {
				return;
			}

			const newUri = CellUri.generate(notebook, idx);
			if (isEqual(newUri, bp.uri)) {
				return;
			}

			this._debugService.removeBreakpoints(bp.getId());
			this._debugService.addBreakpoints(newUri, [
				{
					column: bp.column,
					condition: bp.condition,
					enabled: bp.enabled,
					hitCondition: bp.hitCondition,
					logMessage: bp.logMessage,
					lineNumber: bp.lineNumber
				}
			]);
		});
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookBreakpoints, LifecyclePhase.Restored);
*/
