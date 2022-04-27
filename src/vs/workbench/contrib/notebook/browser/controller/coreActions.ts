/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI, UriComponents } from 'vs/base/common/uri';
import { getIconClasses } from 'vs/editor/common/services/getIconClasses';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { localize } from 'vs/nls';
import { Action2, IAction2Options, MenuId, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from 'vs/platform/quickinput/common/quickInput';
import { BaseCellRenderTemplate, CellEditState, getNotebookEditorFromEditorPane, IActiveNotebookEditor, ICellViewModel, NOTEBOOK_CELL_TYPE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT, CHANGE_CELL_LANGUAGE, NOTEBOOK_CELL_EXECUTING, NOTEBOOK_MISSING_KERNEL_EXTENSION, cellRangeToViewCells } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CellEditType, CellKind, ICellEditOperation, SelectionStateType, ICellReplaceEdit } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ICellRange, isICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorCommandsContext } from 'vs/workbench/common/editor';
import { INotebookEditorService } from 'vs/workbench/contrib/notebook/browser/notebookEditorService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { WorkbenchActionExecutedClassification, WorkbenchActionExecutedEvent } from 'vs/base/common/actions';
import { NotebookViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/notebookViewModel';
import { flatten } from 'vs/base/common/arrays';
import { Mimes } from 'vs/base/common/mime';
import { TypeConstraint } from 'vs/base/common/types';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { ILanguageDetectionService } from 'vs/workbench/services/languageDetection/common/languageDetectionWorkerService';
import { MarshalledId } from 'vs/base/common/marshalling';

// Kernel Command
export const SELECT_KERNEL_ID = 'notebook.selectKernel';
export const NOTEBOOK_ACTIONS_CATEGORY = { value: localize('notebookActions.category', "Notebook"), original: 'Notebook' };

export const CELL_TITLE_CELL_GROUP_ID = 'inline/cell';
export const CELL_TITLE_OUTPUT_GROUP_ID = 'inline/output';

export const NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT = KeybindingWeight.EditorContrib; // smaller than Suggest Widget, etc

export const enum CellToolbarOrder {
	EditCell,
	ExecuteAboveCells,
	ExecuteCellAndBelow,
	SplitCell,
	SaveCell,
	ClearCellOutput
}

export const enum CellOverflowToolbarGroups {
	Copy = '1_copy',
	Insert = '2_insert',
	Edit = '3_edit',
	Collapse = '4_collapse',
}

export interface INotebookActionContext {
	readonly cellTemplate?: BaseCellRenderTemplate;
	readonly cell?: ICellViewModel;
	readonly notebookEditor: IActiveNotebookEditor;
	readonly ui?: boolean;
	readonly selectedCells?: readonly ICellViewModel[];
	readonly autoReveal?: boolean;
}

export interface INotebookCellToolbarActionContext extends INotebookActionContext {
	readonly ui: true;
	readonly cell: ICellViewModel;
}

export interface INotebookCommandContext extends INotebookActionContext {
	readonly ui: false;
	readonly selectedCells: readonly ICellViewModel[];
}

export interface INotebookCellActionContext extends INotebookActionContext {
	cell: ICellViewModel;
}

export function getContextFromActiveEditor(editorService: IEditorService): INotebookActionContext | undefined {
	const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
	if (!editor || !editor.hasModel()) {
		return undefined; // {{SQL CARBON EDIT}} Strict nulls
	}

	const activeCell = editor.getActiveCell();
	const selectedCells = editor.getSelectionViewModels();
	return {
		cell: activeCell,
		selectedCells,
		notebookEditor: editor
	};
}

function getWidgetFromUri(accessor: ServicesAccessor, uri: URI) {
	const notebookEditorService = accessor.get(INotebookEditorService);
	const widget = notebookEditorService.listNotebookEditors().find(widget => widget.hasModel() && widget.textModel.uri.toString() === uri.toString());

	if (widget && widget.hasModel()) {
		return widget;
	}

	return undefined;
}

export function getContextFromUri(accessor: ServicesAccessor, context?: any) {
	const uri = URI.revive(context);

	if (uri) {
		const widget = getWidgetFromUri(accessor, uri);

		if (widget) {
			return {
				notebookEditor: widget,
			};
		}
	}

	return undefined;
}

export abstract class NotebookAction extends Action2 {
	constructor(desc: IAction2Options) {
		if (desc.f1 !== false) {
			desc.f1 = false;
			const f1Menu = {
				id: MenuId.CommandPalette,
				when: NOTEBOOK_IS_ACTIVE_EDITOR
			};

			if (!desc.menu) {
				desc.menu = [];
			} else if (!Array.isArray(desc.menu)) {
				desc.menu = [desc.menu];
			}

			desc.menu = [
				...desc.menu,
				f1Menu
			];
		}

		desc.category = NOTEBOOK_ACTIONS_CATEGORY;

		super(desc);
	}

	async run(accessor: ServicesAccessor, context?: any, ...additionalArgs: any[]): Promise<void> {
		const isFromUI = !!context;
		const from = isFromUI ? (this.isNotebookActionContext(context) ? 'notebookToolbar' : 'editorToolbar') : undefined;
		if (!this.isNotebookActionContext(context)) {
			context = this.getEditorContextFromArgsOrActive(accessor, context, ...additionalArgs);
			if (!context) {
				return;
			}
		}

		if (from !== undefined) {
			const telemetryService = accessor.get(ITelemetryService);
			telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: this.desc.id, from: from });
		}

		return this.runWithContext(accessor, context);
	}

	abstract runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void>;

	private isNotebookActionContext(context?: unknown): context is INotebookActionContext {
		return !!context && !!(context as INotebookActionContext).notebookEditor;
	}

	protected getEditorContextFromArgsOrActive(accessor: ServicesAccessor, context?: any, ...additionalArgs: any[]): INotebookActionContext | undefined {
		return getContextFromActiveEditor(accessor.get(IEditorService));
	}
}

// todo@rebornix, replace NotebookAction with this
export abstract class NotebookMultiCellAction extends Action2 {
	constructor(desc: IAction2Options) {
		if (desc.f1 !== false) {
			desc.f1 = false;
			const f1Menu = {
				id: MenuId.CommandPalette,
				when: NOTEBOOK_IS_ACTIVE_EDITOR
			};

			if (!desc.menu) {
				desc.menu = [];
			} else if (!Array.isArray(desc.menu)) {
				desc.menu = [desc.menu];
			}

			desc.menu = [
				...desc.menu,
				f1Menu
			];
		}

		desc.category = NOTEBOOK_ACTIONS_CATEGORY;

		super(desc);
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookCommandContext | undefined {
		return undefined;
	}

	abstract runWithContext(accessor: ServicesAccessor, context: INotebookCommandContext | INotebookCellToolbarActionContext): Promise<void>;

	private isCellToolbarContext(context?: unknown): context is INotebookCellToolbarActionContext {
		return !!context && !!(context as INotebookActionContext).notebookEditor && (context as any).$mid === MarshalledId.NotebookCellActionContext;
	}
	private isEditorContext(context?: unknown): boolean {
		return !!context && (context as IEditorCommandsContext).groupId !== undefined;
	}

	/**
	 * The action/command args are resolved in following order
	 * `run(accessor, cellToolbarContext)` from cell toolbar
	 * `run(accessor, ...args)` from command service with arguments
	 * `run(accessor, undefined)` from keyboard shortcuts, command palatte, etc
	 */
	async run(accessor: ServicesAccessor, ...additionalArgs: any[]): Promise<void> {
		const context = additionalArgs[0];
		const isFromCellToolbar = this.isCellToolbarContext(context);
		const isFromEditorToolbar = this.isEditorContext(context);
		const from = isFromCellToolbar ? 'cellToolbar' : (isFromEditorToolbar ? 'editorToolbar' : 'other');
		const telemetryService = accessor.get(ITelemetryService);

		if (isFromCellToolbar) {
			telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: this.desc.id, from: from });
			return this.runWithContext(accessor, context);
		}

		// handle parsed args

		const parsedArgs = this.parseArgs(accessor, ...additionalArgs);
		if (parsedArgs) {
			telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: this.desc.id, from: from });
			return this.runWithContext(accessor, parsedArgs);
		}

		// no parsed args, try handle active editor
		const editor = getEditorFromArgsOrActivePane(accessor);
		if (editor) {
			telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: this.desc.id, from: from });

			return this.runWithContext(accessor, {
				ui: false,
				notebookEditor: editor,
				selectedCells: cellRangeToViewCells(editor.viewModel, editor.getSelections())
			});
		}
	}
}

export abstract class NotebookCellAction<T = INotebookCellActionContext> extends NotebookAction {
	protected isCellActionContext(context?: unknown): context is INotebookCellActionContext {
		return !!context && !!(context as INotebookCellActionContext).notebookEditor && !!(context as INotebookCellActionContext).cell;
	}

	protected getCellContextFromArgs(accessor: ServicesAccessor, context?: T, ...additionalArgs: any[]): INotebookCellActionContext | undefined {
		return undefined;
	}

	override async run(accessor: ServicesAccessor, context?: INotebookCellActionContext, ...additionalArgs: any[]): Promise<void> {
		if (this.isCellActionContext(context)) {
			const telemetryService = accessor.get(ITelemetryService);
			telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: this.desc.id, from: 'cellToolbar' });

			return this.runWithContext(accessor, context);
		}

		const contextFromArgs = this.getCellContextFromArgs(accessor, context, ...additionalArgs);

		if (contextFromArgs) {
			return this.runWithContext(accessor, contextFromArgs);
		}

		const activeEditorContext = this.getEditorContextFromArgsOrActive(accessor);
		if (this.isCellActionContext(activeEditorContext)) {
			return this.runWithContext(accessor, activeEditorContext);
		}
	}

	abstract override runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void>;
}

// If this changes, update getCodeCellExecutionContextKeyService to match
export const executeCondition = ContextKeyExpr.and(
	NOTEBOOK_CELL_TYPE.isEqualTo('code'),
	ContextKeyExpr.or(
		ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0),
		NOTEBOOK_MISSING_KERNEL_EXTENSION
	));

export const executeThisCellCondition = ContextKeyExpr.and(
	executeCondition,
	NOTEBOOK_CELL_EXECUTING.toNegated());

export const executeNotebookCondition = ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0);

interface IMultiCellArgs {
	ranges: ICellRange[];
	document?: URI;
	autoReveal?: boolean;
}

function isMultiCellArgs(arg: unknown): arg is IMultiCellArgs {
	if (arg === undefined) {
		return false;
	}
	const ranges = (arg as IMultiCellArgs).ranges;
	if (!ranges) {
		return false;
	}

	if (!Array.isArray(ranges) || ranges.some(range => !isICellRange(range))) {
		return false;
	}

	if ((arg as IMultiCellArgs).document) {
		const uri = URI.revive((arg as IMultiCellArgs).document);

		if (!uri) {
			return false;
		}
	}

	return true;
}

export function getEditorFromArgsOrActivePane(accessor: ServicesAccessor, context?: UriComponents): IActiveNotebookEditor | undefined {
	const editorFromUri = getContextFromUri(accessor, context)?.notebookEditor;

	if (editorFromUri) {
		return editorFromUri;
	}

	const editor = getNotebookEditorFromEditorPane(accessor.get(IEditorService).activeEditorPane);
	if (!editor || !editor.hasModel()) {
		return undefined; // {{SQL CARBON EDIT}} strict nulls
	}

	return editor;
}

export function parseMultiCellExecutionArgs(accessor: ServicesAccessor, ...args: any[]): INotebookCommandContext | undefined {
	const firstArg = args[0];

	if (isMultiCellArgs(firstArg)) {
		const editor = getEditorFromArgsOrActivePane(accessor, firstArg.document);
		if (!editor) {
			return undefined; // {{SQL CARBON EDIT}} strict nulls
		}

		const ranges = firstArg.ranges;
		const selectedCells = flatten(ranges.map(range => editor.viewModel.getCells(range).slice(0)));
		const autoReveal = firstArg.autoReveal;
		return {
			ui: false,
			notebookEditor: editor,
			selectedCells,
			autoReveal
		};
	}

	// handle legacy arguments
	if (isICellRange(firstArg)) {
		// cellRange, document
		const secondArg = args[1];
		const editor = getEditorFromArgsOrActivePane(accessor, secondArg);
		if (!editor) {
			return undefined; // {{SQL CARBON EDIT}} strict nulls
		}

		return {
			ui: false,
			notebookEditor: editor,
			selectedCells: editor.viewModel.getCells(firstArg)
		};
	}

	// let's just execute the active cell
	const context = getContextFromActiveEditor(accessor.get(IEditorService));
	return context ? {
		ui: false,
		notebookEditor: context.notebookEditor,
		selectedCells: context.selectedCells ?? []
	} : undefined;
}

export const cellExecutionArgs: ReadonlyArray<{
	readonly name: string;
	readonly isOptional?: boolean;
	readonly description?: string;
	readonly constraint?: TypeConstraint;
	readonly schema?: IJSONSchema;
}> = [
		{
			isOptional: true,
			name: 'options',
			description: 'The cell range options',
			schema: {
				'type': 'object',
				'required': ['ranges'],
				'properties': {
					'ranges': {
						'type': 'array',
						items: [
							{
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
						]
					},
					'document': {
						'type': 'object',
						'description': 'The document uri',
					},
					'autoReveal': {
						'type': 'boolean',
						'description': 'Whether the cell should be revealed into view automatically'
					}
				}
			}
		}
	];


MenuRegistry.appendMenuItem(MenuId.NotebookCellTitle, {
	submenu: MenuId.NotebookCellInsert,
	title: localize('notebookMenu.insertCell', "Insert Cell"),
	group: CellOverflowToolbarGroups.Insert,
	when: NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true)
});

MenuRegistry.appendMenuItem(MenuId.EditorContext, {
	submenu: MenuId.NotebookCellTitle,
	title: localize('notebookMenu.cellTitle', "Notebook Cell"),
	group: CellOverflowToolbarGroups.Insert,
	when: NOTEBOOK_EDITOR_FOCUSED
});

export async function changeCellToKind(kind: CellKind, context: INotebookActionContext, language?: string, mime?: string): Promise<void> {
	const { notebookEditor } = context;
	if (!notebookEditor.viewModel) {
		return;
	}

	if (notebookEditor.viewModel.options.isReadOnly) {
		return;
	}

	if (context.ui && context.cell) {
		// action from UI
		const { cell } = context;

		if (cell.cellKind === kind) {
			return;
		}

		const text = cell.getText();
		const idx = notebookEditor.viewModel.getCellIndex(cell);

		if (language === undefined) {
			const availableLanguages = notebookEditor.activeKernel?.supportedLanguages ?? [];
			language = availableLanguages[0] ?? 'plaintext';
		}

		notebookEditor.textModel.applyEdits([
			{
				editType: CellEditType.Replace,
				index: idx,
				count: 1,
				cells: [{
					cellKind: kind,
					source: text,
					language: language!,
					mime: mime ?? cell.mime,
					outputs: cell.model.outputs,
					metadata: cell.metadata,
				}]
			}
		], true, {
			kind: SelectionStateType.Index,
			focus: notebookEditor.getFocus(),
			selections: notebookEditor.getSelections()
		}, () => {
			return {
				kind: SelectionStateType.Index,
				focus: notebookEditor.getFocus(),
				selections: notebookEditor.getSelections()
			};
		}, undefined, true);
		const newCell = notebookEditor.viewModel.cellAt(idx);

		if (!newCell) {
			return;
		}

		notebookEditor.focusNotebookCell(newCell, cell.getEditState() === CellEditState.Editing ? 'editor' : 'container');
	} else if (context.selectedCells) {
		const selectedCells = context.selectedCells;
		const rawEdits: ICellEditOperation[] = [];

		selectedCells.forEach(cell => {
			if (cell.cellKind === kind) {
				return;
			}
			const text = cell.getText();
			const idx = notebookEditor.viewModel.getCellIndex(cell);

			if (language === undefined) {
				const availableLanguages = notebookEditor.activeKernel?.supportedLanguages ?? [];
				language = availableLanguages[0] ?? 'plaintext';
			}

			rawEdits.push(
				{
					editType: CellEditType.Replace,
					index: idx,
					count: 1,
					cells: [{
						cellKind: kind,
						source: text,
						language: language!,
						mime: mime ?? cell.mime,
						outputs: cell.model.outputs,
						metadata: cell.metadata,
					}]
				}
			);
		});

		notebookEditor.textModel.applyEdits(rawEdits, true, {
			kind: SelectionStateType.Index,
			focus: notebookEditor.getFocus(),
			selections: notebookEditor.getSelections()
		}, () => {
			return {
				kind: SelectionStateType.Index,
				focus: notebookEditor.getFocus(),
				selections: notebookEditor.getSelections()
			};
		}, undefined, true);
	}
}

export function runDeleteAction(viewModel: NotebookViewModel, cell: ICellViewModel) {
	const selections = viewModel.getSelections();
	const targetCellIndex = viewModel.getCellIndex(cell);
	const containingSelection = selections.find(selection => selection.start <= targetCellIndex && targetCellIndex < selection.end);

	if (containingSelection) {
		const edits: ICellReplaceEdit[] = selections.reverse().map(selection => ({
			editType: CellEditType.Replace, index: selection.start, count: selection.end - selection.start, cells: []
		}));

		const nextCellAfterContainingSelection = viewModel.cellAt(containingSelection.end);

		viewModel.notebookDocument.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: viewModel.getFocus(), selections: viewModel.getSelections() }, () => {
			if (nextCellAfterContainingSelection) {
				const cellIndex = viewModel.notebookDocument.cells.findIndex(cell => cell.handle === nextCellAfterContainingSelection.handle);
				return { kind: SelectionStateType.Index, focus: { start: cellIndex, end: cellIndex + 1 }, selections: [{ start: cellIndex, end: cellIndex + 1 }] };
			} else {
				if (viewModel.notebookDocument.length) {
					const lastCellIndex = viewModel.notebookDocument.length - 1;
					return { kind: SelectionStateType.Index, focus: { start: lastCellIndex, end: lastCellIndex + 1 }, selections: [{ start: lastCellIndex, end: lastCellIndex + 1 }] };

				} else {
					return { kind: SelectionStateType.Index, focus: { start: 0, end: 0 }, selections: [{ start: 0, end: 0 }] };
				}
			}
		}, undefined);
	} else {
		const focus = viewModel.getFocus();
		const edits: ICellReplaceEdit[] = [{
			editType: CellEditType.Replace, index: targetCellIndex, count: 1, cells: []
		}];

		let finalSelections: ICellRange[] = [];
		for (let i = 0; i < selections.length; i++) {
			const selection = selections[i];

			if (selection.end <= targetCellIndex) {
				finalSelections.push(selection);
			} else if (selection.start > targetCellIndex) {
				finalSelections.push({ start: selection.start - 1, end: selection.end - 1 });
			} else {
				finalSelections.push({ start: targetCellIndex, end: targetCellIndex + 1 });
			}
		}

		if (viewModel.cellAt(focus.start) === cell) {
			// focus is the target, focus is also not part of any selection
			const newFocus = focus.end === viewModel.length ? { start: focus.start - 1, end: focus.end - 1 } : focus;

			viewModel.notebookDocument.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: viewModel.getFocus(), selections: viewModel.getSelections() }, () => ({
				kind: SelectionStateType.Index, focus: newFocus, selections: finalSelections
			}), undefined);
		} else {
			// users decide to delete a cell out of current focus/selection
			const newFocus = focus.start > targetCellIndex ? { start: focus.start - 1, end: focus.end - 1 } : focus;

			viewModel.notebookDocument.applyEdits(edits, true, { kind: SelectionStateType.Index, focus: viewModel.getFocus(), selections: viewModel.getSelections() }, () => ({
				kind: SelectionStateType.Index, focus: newFocus, selections: finalSelections
			}), undefined);
		}
	}
}

export interface ILanguagePickInput extends IQuickPickItem {
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
			return undefined; // {{SQL CARBON EDIT}} strict nulls
		}

		const language = additionalArgs.length && typeof additionalArgs[0] === 'string' ? additionalArgs[0] : undefined;
		const activeEditorContext = this.getEditorContextFromArgsOrActive(accessor);

		if (!activeEditorContext || !activeEditorContext.notebookEditor.viewModel || context.start >= activeEditorContext.notebookEditor.viewModel.length) {
			return undefined; // {{SQL CARBON EDIT}} Fix strict null
		}

		// TODO@rebornix, support multiple cells
		return {
			notebookEditor: activeEditorContext.notebookEditor,
			cell: activeEditorContext.notebookEditor.viewModel.cellAt(context.start)!,
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

		const modeService = accessor.get(IModeService);
		const modelService = accessor.get(IModelService);
		const quickInputService = accessor.get(IQuickInputService);
		const languageDetectionService = accessor.get(ILanguageDetectionService);

		const providerLanguages = new Set([
			...(context.notebookEditor.activeKernel?.supportedLanguages ?? modeService.getRegisteredModes()),
			'markdown'
		]);

		providerLanguages.forEach(languageId => {
			let description: string;
			if (context.cell.cellKind === CellKind.Markup ? (languageId === 'markdown') : (languageId === context.cell.language)) {
				description = localize('languageDescription', "({0}) - Current Language", languageId);
			} else {
				description = localize('languageDescriptionConfigured', "({0})", languageId);
			}

			const languageName = modeService.getLanguageName(languageId);
			if (!languageName) {
				// Notebook has unrecognized language
				return;
			}

			const item = <ILanguagePickInput>{
				label: languageName,
				iconClasses: getIconClasses(modelService, modeService, this.getFakeResource(languageName, modeService)),
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
		let languageId = selection === autoDetectMode
			? await languageDetectionService.detectLanguage(context.cell.uri)
			: selection?.languageId;

		if (languageId) {
			await this.setLanguage(context, languageId);
		}
	}

	private async setLanguage(context: IChangeCellContext, languageId: string) {
		if (languageId === 'markdown' && context.cell?.language !== 'markdown') {
			const idx = context.notebookEditor.viewModel.getCellIndex(context.cell);
			await changeCellToKind(CellKind.Markup, { cell: context.cell, notebookEditor: context.notebookEditor }, 'markdown', Mimes.markdown);
			const newCell = context.notebookEditor.viewModel.cellAt(idx);

			if (newCell) {
				context.notebookEditor.focusNotebookCell(newCell, 'editor');
			}
		} else if (languageId !== 'markdown' && context.cell?.cellKind === CellKind.Markup) {
			await changeCellToKind(CellKind.Code, { cell: context.cell, notebookEditor: context.notebookEditor }, languageId);
		} else {
			const index = context.notebookEditor.textModel.cells.indexOf(context.cell.model);
			context.notebookEditor.textModel.applyEdits(
				[{ editType: CellEditType.CellLanguage, index, language: languageId }],
				true, undefined, () => undefined, undefined
			);
		}
	}

	/**
	 * Copied from editorStatus.ts
	 */
	private getFakeResource(lang: string, modeService: IModeService): URI | undefined {
		let fakeResource: URI | undefined;

		const extensions = modeService.getExtensions(lang);
		if (extensions?.length) {
			fakeResource = URI.file(extensions[0]);
		} else {
			const filenames = modeService.getFilenames(lang);
			if (filenames?.length) {
				fakeResource = URI.file(filenames[0]);
			}
		}

		return fakeResource;
	}
});
