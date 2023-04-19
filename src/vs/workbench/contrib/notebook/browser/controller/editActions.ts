/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Mimes } from 'vs/base/common/mime';
import { URI } from 'vs/base/common/uri';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { getIconClasses } from 'vs/editor/common/services/getIconClasses';
import { IModelService } from 'vs/editor/common/services/model';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { localize } from 'vs/nls';
import { MenuId, MenuItemAction, registerAction2 } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { InputFocusedContext, InputFocusedContextKey } from 'vs/platform/contextkey/common/contextkeys';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from 'vs/platform/quickinput/common/quickInput';
import { changeCellToKind, runDeleteAction } from 'vs/workbench/contrib/notebook/browser/controller/cellOperations';
import { CellToolbarOrder, CELL_TITLE_CELL_GROUP_ID, CELL_TITLE_OUTPUT_GROUP_ID, executeNotebookCondition, INotebookActionContext, INotebookCellActionContext, NotebookAction, NotebookCellAction, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT } from 'vs/workbench/contrib/notebook/browser/controller/coreActions';
import { NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_TYPE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_HAS_OUTPUTS, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON } from 'vs/workbench/contrib/notebook/common/notebookContextKeys';
import { CellEditState, CHANGE_CELL_LANGUAGE, DETECT_CELL_LANGUAGE, QUIT_EDIT_CELL_COMMAND_ID } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import * as icons from 'vs/workbench/contrib/notebook/browser/notebookIcons';
import { CellEditType, CellKind, ICellEditOperation, NotebookCellExecutionState } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { ILanguageDetectionService } from 'vs/workbench/services/languageDetection/common/languageDetectionWorkerService';
import { INotebookExecutionStateService } from 'vs/workbench/contrib/notebook/common/notebookExecutionStateService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { INotebookKernelService } from 'vs/workbench/contrib/notebook/common/notebookKernelService';

const CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID = 'notebook.clearAllCellsOutputs';
const EDIT_CELL_COMMAND_ID = 'notebook.cell.edit';
const DELETE_CELL_COMMAND_ID = 'notebook.cell.delete';
const CLEAR_CELL_OUTPUTS_COMMAND_ID = 'notebook.cell.clearOutputs';

export class DeleteCellAction extends MenuItemAction {
	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService commandService: ICommandService
	) {
		super(
			{
				id: DELETE_CELL_COMMAND_ID,
				title: localize('notebookActions.deleteCell', "Delete Cell"),
				icon: icons.deleteCellIcon,
				precondition: NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true)
			},
			undefined,
			{ shouldForwardArgs: true },
			contextKeyService,
			commandService);
	}
}

registerAction2(class EditCellAction extends NotebookCellAction {
	constructor() {
		super(
			{
				id: EDIT_CELL_COMMAND_ID,
				title: localize('notebookActions.editCell', "Edit Cell"),
				keybinding: {
					when: ContextKeyExpr.and(
						NOTEBOOK_CELL_LIST_FOCUSED,
						ContextKeyExpr.not(InputFocusedContextKey),
						NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true)),
					primary: KeyCode.Enter,
					weight: KeybindingWeight.WorkbenchContrib
				},
				menu: {
					id: MenuId.NotebookCellTitle,
					when: ContextKeyExpr.and(
						NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
						NOTEBOOK_CELL_TYPE.isEqualTo('markup'),
						NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.toNegated(),
						NOTEBOOK_CELL_EDITABLE),
					order: CellToolbarOrder.EditCell,
					group: CELL_TITLE_CELL_GROUP_ID
				},
				icon: icons.editIcon,
			});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		if (!context.notebookEditor.hasModel() || context.notebookEditor.isReadOnly) {
			return;
		}

		context.notebookEditor.focusNotebookCell(context.cell, 'editor');
	}
});

const quitEditCondition = ContextKeyExpr.and(
	NOTEBOOK_EDITOR_FOCUSED,
	InputFocusedContext
);
registerAction2(class QuitEditCellAction extends NotebookCellAction {
	constructor() {
		super(
			{
				id: QUIT_EDIT_CELL_COMMAND_ID,
				title: localize('notebookActions.quitEdit', "Stop Editing Cell"),
				menu: {
					id: MenuId.NotebookCellTitle,
					when: ContextKeyExpr.and(
						NOTEBOOK_CELL_TYPE.isEqualTo('markup'),
						NOTEBOOK_CELL_MARKDOWN_EDIT_MODE,
						NOTEBOOK_CELL_EDITABLE),
					order: CellToolbarOrder.SaveCell,
					group: CELL_TITLE_CELL_GROUP_ID
				},
				icon: icons.stopEditIcon,
				keybinding: [
					{
						when: ContextKeyExpr.and(quitEditCondition,
							EditorContextKeys.hoverVisible.toNegated(),
							EditorContextKeys.hasNonEmptySelection.toNegated(),
							EditorContextKeys.hasMultipleSelections.toNegated()),
						primary: KeyCode.Escape,
						weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT - 5
					},
					{
						when: ContextKeyExpr.and(
							quitEditCondition,
							NOTEBOOK_CELL_TYPE.isEqualTo('markup')),
						primary: KeyMod.WinCtrl | KeyCode.Enter,
						win: {
							primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
						},
						weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT - 5
					},
				]
			});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext) {
		if (context.cell.cellKind === CellKind.Markup) {
			context.cell.updateEditState(CellEditState.Preview, QUIT_EDIT_CELL_COMMAND_ID);
		}

		context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
	}
});

registerAction2(class DeleteCellAction extends NotebookCellAction {
	constructor() {
		super(
			{
				id: DELETE_CELL_COMMAND_ID,
				title: localize('notebookActions.deleteCell', "Delete Cell"),
				keybinding: {
					primary: KeyCode.Delete,
					mac: {
						primary: KeyMod.CtrlCmd | KeyCode.Backspace
					},
					when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE, ContextKeyExpr.not(InputFocusedContextKey)),
					weight: KeybindingWeight.WorkbenchContrib
				},
				icon: icons.deleteCellIcon
			});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext) {
		if (!context.notebookEditor.hasModel() || context.notebookEditor.isReadOnly) {
			return;
		}

		runDeleteAction(context.notebookEditor, context.cell);
	}
});

registerAction2(class ClearCellOutputsAction extends NotebookCellAction {
	constructor() {
		super({
			id: CLEAR_CELL_OUTPUTS_COMMAND_ID,
			title: localize('clearCellOutputs', 'Clear Cell Outputs'),
			menu: [
				{
					id: MenuId.NotebookCellTitle,
					when: ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo('code'), executeNotebookCondition, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON.toNegated()),
					order: CellToolbarOrder.ClearCellOutput,
					group: CELL_TITLE_OUTPUT_GROUP_ID
				},
				{
					id: MenuId.NotebookOutputToolbar,
					when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE)
				},
			],
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey), NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
				primary: KeyMod.Alt | KeyCode.Delete,
				weight: KeybindingWeight.WorkbenchContrib
			},
			icon: icons.clearIcon
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
		const editor = context.notebookEditor;
		if (!editor.hasModel() || !editor.textModel.length) {
			return;
		}

		const cell = context.cell;
		const index = editor.textModel.cells.indexOf(cell.model);

		if (index < 0) {
			return;
		}

		editor.textModel.applyEdits([{ editType: CellEditType.Output, index, outputs: [] }], true, undefined, () => undefined, undefined, true);

		const runState = notebookExecutionStateService.getCellExecution(context.cell.uri)?.state;
		if (runState !== NotebookCellExecutionState.Executing) {
			context.notebookEditor.textModel.applyEdits([{
				editType: CellEditType.PartialInternalMetadata, index, internalMetadata: {
					runStartTime: null,
					runStartTimeAdjustment: null,
					runEndTime: null,
					executionOrder: null,
					lastRunSuccess: null
				}
			}], true, undefined, () => undefined, undefined, true);
		}
	}
});


registerAction2(class ClearAllCellOutputsAction extends NotebookAction {
	constructor() {
		super({
			id: CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID,
			title: localize('clearAllCellsOutputs', 'Clear Outputs of All Cells'),
			precondition: NOTEBOOK_HAS_OUTPUTS,
			menu: [
				{
					id: MenuId.EditorTitle,
					when: ContextKeyExpr.and(
						NOTEBOOK_IS_ACTIVE_EDITOR,
						ContextKeyExpr.notEquals('config.notebook.globalToolbar', true)
					),
					group: 'navigation',
					order: 0
				},
				{
					id: MenuId.NotebookToolbar,
					when: ContextKeyExpr.and(
						executeNotebookCondition,
						ContextKeyExpr.equals('config.notebook.globalToolbar', true)
					),
					group: 'navigation/execute',
					order: 0
				}
			],
			icon: icons.clearIcon
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
		const editor = context.notebookEditor;
		if (!editor.hasModel() || !editor.textModel.length) {
			return;
		}

		editor.textModel.applyEdits(
			editor.textModel.cells.map((cell, index) => ({
				editType: CellEditType.Output, index, outputs: []
			})), true, undefined, () => undefined, undefined, true);

		const clearExecutionMetadataEdits = editor.textModel.cells.map((cell, index) => {
			const runState = notebookExecutionStateService.getCellExecution(cell.uri)?.state;
			if (runState !== NotebookCellExecutionState.Executing) {
				return {
					editType: CellEditType.PartialInternalMetadata, index, internalMetadata: {
						runStartTime: null,
						runStartTimeAdjustment: null,
						runEndTime: null,
						executionOrder: null,
						lastRunSuccess: null
					}
				};
			} else {
				return undefined;
			}
		}).filter(edit => !!edit) as ICellEditOperation[];
		if (clearExecutionMetadataEdits.length) {
			context.notebookEditor.textModel.applyEdits(clearExecutionMetadataEdits, true, undefined, () => undefined, undefined, true);
		}
	}
});


export interface ILanguagePickInput extends IQuickPickItem {  // {{SQL CARBON EDIT}} - export interface
	languageId: string;
	description: string;
}

interface IChangeCellContext extends INotebookCellActionContext {
	// TODO@rebornix : `cells`
	// range: ICellRange;
	language?: string;
}

registerAction2(class ChangeCellLanguageAction extends NotebookCellAction<ICellRange> {
	constructor() {
		super({
			id: CHANGE_CELL_LANGUAGE,
			title: localize('changeLanguage', 'Change Cell Language'),
			description: {
				description: localize('changeLanguage', 'Change Cell Language'),
				args: [
					{
						name: 'range',
						description: 'The cell range',
						schema: {
							'type': 'object',
							'required': ['start', 'end'],
							'properties': {
								'start': {
									'type': 'number'
								},
								'end': {
									'type': 'number'
								}
							}
						}
					},
					{
						name: 'language',
						description: 'The target cell language',
						schema: {
							'type': 'string'
						}
					}
				]
			}
		});
	}

	protected override getCellContextFromArgs(accessor: ServicesAccessor, context?: ICellRange, ...additionalArgs: any[]): IChangeCellContext | undefined {
		if (!context || typeof context.start !== 'number' || typeof context.end !== 'number' || context.start >= context.end) {
			return undefined; // {{SQL CARBON EDIT}} add return value
		}

		const language = additionalArgs.length && typeof additionalArgs[0] === 'string' ? additionalArgs[0] : undefined;
		const activeEditorContext = this.getEditorContextFromArgsOrActive(accessor);

		if (!activeEditorContext || !activeEditorContext.notebookEditor.hasModel() || context.start >= activeEditorContext.notebookEditor.getLength()) {
			return undefined; // {{SQL CARBON EDIT}} add return value
		}

		// TODO@rebornix, support multiple cells
		return {
			notebookEditor: activeEditorContext.notebookEditor,
			cell: activeEditorContext.notebookEditor.cellAt(context.start)!,
			language
		};
	}


	async runWithContext(accessor: ServicesAccessor, context: IChangeCellContext): Promise<void> {
		if (context.language) {
			await this.setLanguage(context, context.language);
		} else {
			await this.showLanguagePicker(accessor, context);
		}
	}

	private async showLanguagePicker(accessor: ServicesAccessor, context: IChangeCellContext) {
		const topItems: ILanguagePickInput[] = [];
		const mainItems: ILanguagePickInput[] = [];

		const languageService = accessor.get(ILanguageService);
		const modelService = accessor.get(IModelService);
		const quickInputService = accessor.get(IQuickInputService);
		const languageDetectionService = accessor.get(ILanguageDetectionService);

		const providerLanguages = new Set([
			...(context.notebookEditor.activeKernel?.supportedLanguages ?? languageService.getRegisteredLanguageIds()),
			'markdown'
		]);

		providerLanguages.forEach(languageId => {
			let description: string;
			if (context.cell.cellKind === CellKind.Markup ? (languageId === 'markdown') : (languageId === context.cell.language)) {
				description = localize('languageDescription', "({0}) - Current Language", languageId);
			} else {
				description = localize('languageDescriptionConfigured', "({0})", languageId);
			}

			const languageName = languageService.getLanguageName(languageId);
			if (!languageName) {
				// Notebook has unrecognized language
				return;
			}

			const item = <ILanguagePickInput>{
				label: languageName,
				iconClasses: getIconClasses(modelService, languageService, this.getFakeResource(languageName, languageService)),
				description,
				languageId
			};

			if (languageId === 'markdown' || languageId === context.cell.language) {
				topItems.push(item);
			} else {
				mainItems.push(item);
			}
		});

		mainItems.sort((a, b) => {
			return a.description.localeCompare(b.description);
		});

		// Offer to "Auto Detect"
		const autoDetectMode: IQuickPickItem = {
			label: localize('autoDetect', "Auto Detect")
		};

		const picks: QuickPickInput[] = [
			autoDetectMode,
			{ type: 'separator', label: localize('languagesPicks', "languages (identifier)") },
			...topItems,
			{ type: 'separator' },
			...mainItems
		];

		const selection = await quickInputService.pick(picks, { placeHolder: localize('pickLanguageToConfigure', "Select Language Mode") }) as ILanguagePickInput | undefined;
		const languageId = selection === autoDetectMode
			? await languageDetectionService.detectLanguage(context.cell.uri)
			: selection?.languageId;

		if (languageId) {
			await this.setLanguage(context, languageId);
		}
	}

	private async setLanguage(context: IChangeCellContext, languageId: string) {
		await setCellToLanguage(languageId, context);
	}

	/**
	 * Copied from editorStatus.ts
	 */
	private getFakeResource(lang: string, languageService: ILanguageService): URI | undefined {
		let fakeResource: URI | undefined;

		const languageId = languageService.getLanguageIdByLanguageName(lang);
		if (languageId) {
			const extensions = languageService.getExtensions(languageId);
			if (extensions.length) {
				fakeResource = URI.file(extensions[0]);
			} else {
				const filenames = languageService.getFilenames(languageId);
				if (filenames.length) {
					fakeResource = URI.file(filenames[0]);
				}
			}
		}

		return fakeResource;
	}
});

registerAction2(class DetectCellLanguageAction extends NotebookCellAction {
	constructor() {
		super({
			id: DETECT_CELL_LANGUAGE,
			title: localize('detectLanguage', 'Accept Detected Language for Cell'),
			f1: true,
			precondition: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
			keybinding: { primary: KeyCode.KeyD | KeyMod.Alt | KeyMod.Shift, weight: KeybindingWeight.WorkbenchContrib }
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		const languageDetectionService = accessor.get(ILanguageDetectionService);
		const notificationService = accessor.get(INotificationService);
		const kernelService = accessor.get(INotebookKernelService);
		const kernel = kernelService.getSelectedOrSuggestedKernel(context.notebookEditor.textModel);
		const providerLanguages = [...kernel?.supportedLanguages ?? []];
		providerLanguages.push('markdown');
		const detection = await languageDetectionService.detectLanguage(context.cell.uri, providerLanguages);
		if (detection) {
			setCellToLanguage(detection, context);
		} else {
			notificationService.warn(localize('noDetection', "Unable to detect cell language"));
		}
	}
});

async function setCellToLanguage(languageId: string, context: IChangeCellContext) {
	if (languageId === 'markdown' && context.cell?.language !== 'markdown') {
		const idx = context.notebookEditor.getCellIndex(context.cell);
		await changeCellToKind(CellKind.Markup, { cell: context.cell, notebookEditor: context.notebookEditor, ui: true }, 'markdown', Mimes.markdown);
		const newCell = context.notebookEditor.cellAt(idx);

		if (newCell) {
			context.notebookEditor.focusNotebookCell(newCell, 'editor');
		}
	} else if (languageId !== 'markdown' && context.cell?.cellKind === CellKind.Markup) {
		await changeCellToKind(CellKind.Code, { cell: context.cell, notebookEditor: context.notebookEditor, ui: true }, languageId);
	} else {
		const index = context.notebookEditor.textModel.cells.indexOf(context.cell.model);
		context.notebookEditor.textModel.applyEdits(
			[{ editType: CellEditType.CellLanguage, index, language: languageId }],
			true, undefined, () => undefined, undefined, true
		);
	}
}
