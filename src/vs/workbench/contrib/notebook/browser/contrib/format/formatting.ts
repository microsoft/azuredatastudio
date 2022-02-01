/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAction2, Action2, MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { localize } from 'vs/nls';
import { NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE, getNotebookEditorFromEditorPane } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { NOTEBOOK_ACTIONS_CATEGORY } from 'vs/workbench/contrib/notebook/browser/contrib/coreActions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { getDocumentFormattingEditsUntilResult, formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorkerService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IBulkEditService, ResourceTextEdit } from 'vs/editor/browser/services/bulkEditService';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { registerEditorAction, EditorAction } from 'vs/editor/browser/editorExtensions';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Progress } from 'vs/platform/progress/common/progress';
import { flatten } from 'vs/base/common/arrays';

// format notebook
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'notebook.format',
			title: { value: localize('format.title', "Format Notebook"), original: 'Format Notebook' },
			category: NOTEBOOK_ACTIONS_CATEGORY,
			precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE),
			keybinding: {
				when: EditorContextKeys.editorTextFocus.toNegated(),
				primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KEY_F,
				linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_I },
				weight: KeybindingWeight.WorkbenchContrib
			},
			f1: true,
			menu: {
				id: MenuId.EditorContext,
				when: ContextKeyExpr.and(EditorContextKeys.inCompositeEditor, EditorContextKeys.hasDocumentFormattingProvider),
				group: '1_modification',
				order: 1.3
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const textModelService = accessor.get(ITextModelService);
		const editorWorkerService = accessor.get(IEditorWorkerService);
		const bulkEditService = accessor.get(IBulkEditService);

		const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
		if (!editor || !editor.viewModel) {
			return;
		}

		const notebook = editor.viewModel.notebookDocument;
		const disposable = new DisposableStore();
		try {
			const allCellEdits = await Promise.all(notebook.cells.map(async cell => {
				const ref = await textModelService.createModelReference(cell.uri);
				disposable.add(ref);

				const model = ref.object.textEditorModel;

				const formatEdits = await getDocumentFormattingEditsUntilResult(
					editorWorkerService, model,
					model.getOptions(), CancellationToken.None
				);

				const edits: ResourceTextEdit[] = [];

				if (formatEdits) {
					for (let edit of formatEdits) {
						edits.push(new ResourceTextEdit(model.uri, edit, model.getVersionId()));
					}

					return edits;
				}

				return [];
			}));

			await bulkEditService.apply(/* edit */flatten(allCellEdits), { label: localize('label', "Format Notebook") });

		} finally {
			disposable.dispose();
		}
	}
});

// format cell
registerEditorAction(class FormatCellAction extends EditorAction {
	constructor() {
		super({
			id: 'notebook.formatCell',
			label: localize('formatCell.label', "Format Cell"),
			alias: 'Format Cell',
			precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE, EditorContextKeys.inCompositeEditor, EditorContextKeys.writable, EditorContextKeys.hasDocumentFormattingProvider),
			kbOpts: {
				kbExpr: ContextKeyExpr.and(EditorContextKeys.editorTextFocus),
				primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KEY_F,
				linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_I },
				weight: KeybindingWeight.EditorContrib
			},
			contextMenuOpts: {
				group: '1_modification',
				order: 1.301
			}
		});
	}

	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		if (editor.hasModel()) {
			const instaService = accessor.get(IInstantiationService);
			await instaService.invokeFunction(formatDocumentWithSelectedProvider, editor, FormattingMode.Explicit, Progress.None, CancellationToken.None);
		}
	}
});
