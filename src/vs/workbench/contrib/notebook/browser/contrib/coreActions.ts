/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as glob from 'vs/base/common/glob';
import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { URI, UriComponents } from 'vs/base/common/uri';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { getIconClasses } from 'vs/editor/common/services/getIconClasses';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { localize } from 'vs/nls';
import { Action2, IAction2Options, MenuId, MenuItemAction, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { InputFocusedContext, InputFocusedContextKey } from 'vs/platform/contextkey/common/contextkeys';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from 'vs/platform/quickinput/common/quickInput';
import { BaseCellRenderTemplate, CellEditState, CellFocusMode, EXECUTE_CELL_COMMAND_ID, EXPAND_CELL_INPUT_COMMAND_ID, getNotebookEditorFromEditorPane, IActiveNotebookEditor, ICellViewModel, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_INPUT_COLLAPSED, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_OUTPUT_COLLAPSED, NOTEBOOK_CELL_EXECUTION_STATE, NOTEBOOK_CELL_TYPE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT, NOTEBOOK_INTERRUPTIBLE_KERNEL, NOTEBOOK_HAS_RUNNING_CELL, CHANGE_CELL_LANGUAGE, QUIT_EDIT_CELL_COMMAND_ID, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON, NOTEBOOK_HAS_OUTPUTS, NOTEBOOK_CELL_EXECUTING, NOTEBOOK_MISSING_KERNEL_EXTENSION, EXPAND_CELL_OUTPUT_COMMAND_ID } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CellEditType, CellKind, ICellEditOperation, isDocumentExcludePattern, NotebookCellMetadata, NotebookCellExecutionState, TransientCellMetadata, TransientDocumentMetadata, SelectionStateType, ICellReplaceEdit, OpenGettingStarted, GlobalToolbarShowLabel, ConsolidatedRunButton } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ICellRange, isICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';
import * as icons from 'vs/workbench/contrib/notebook/browser/notebookIcons';
import { NotebookEditorInput } from 'vs/workbench/contrib/notebook/common/notebookEditorInput';
import { EditorsOrder, IEditorCommandsContext } from 'vs/workbench/common/editor';
import { INotebookEditorService } from 'vs/workbench/contrib/notebook/browser/notebookEditorService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { WorkbenchActionExecutedClassification, WorkbenchActionExecutedEvent } from 'vs/base/common/actions';
import { CellViewModel, NotebookViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/notebookViewModel';
import { INotebookKernelService } from 'vs/workbench/contrib/notebook/common/notebookKernelService';
import { Iterable } from 'vs/base/common/iterator';
import { flatten, maxIndex, minIndex } from 'vs/base/common/arrays';
import { Codicon } from 'vs/base/common/codicons';
import { Mimes } from 'vs/base/common/mime';
import { TypeConstraint } from 'vs/base/common/types';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

// Kernel Command
export const SELECT_KERNEL_ID = 'notebook.selectKernel';

// Notebook Commands
const EXECUTE_NOTEBOOK_COMMAND_ID = 'notebook.execute';
const CANCEL_NOTEBOOK_COMMAND_ID = 'notebook.cancelExecution';
const CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID = 'notebook.clearAllCellsOutputs';
const RENDER_ALL_MARKDOWN_CELLS = 'notebook.renderAllMarkdownCells';

// Cell Commands
const INSERT_CODE_CELL_ABOVE_COMMAND_ID = 'notebook.cell.insertCodeCellAbove';
const INSERT_CODE_CELL_BELOW_COMMAND_ID = 'notebook.cell.insertCodeCellBelow';
const INSERT_CODE_CELL_ABOVE_AND_FOCUS_CONTAINER_COMMAND_ID = 'notebook.cell.insertCodeCellAboveAndFocusContainer';
const INSERT_CODE_CELL_BELOW_AND_FOCUS_CONTAINER_COMMAND_ID = 'notebook.cell.insertCodeCellBelowAndFocusContainer';
const INSERT_CODE_CELL_AT_TOP_COMMAND_ID = 'notebook.cell.insertCodeCellAtTop';
const INSERT_MARKDOWN_CELL_ABOVE_COMMAND_ID = 'notebook.cell.insertMarkdownCellAbove';
const INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID = 'notebook.cell.insertMarkdownCellBelow';
const INSERT_MARKDOWN_CELL_AT_TOP_COMMAND_ID = 'notebook.cell.insertMarkdownCellAtTop';
const CHANGE_CELL_TO_CODE_COMMAND_ID = 'notebook.cell.changeToCode';
const CHANGE_CELL_TO_MARKDOWN_COMMAND_ID = 'notebook.cell.changeToMarkdown';

const EDIT_CELL_COMMAND_ID = 'notebook.cell.edit';
const DELETE_CELL_COMMAND_ID = 'notebook.cell.delete';

const CANCEL_CELL_COMMAND_ID = 'notebook.cell.cancelExecution';
const EXECUTE_CELL_FOCUS_CONTAINER_COMMAND_ID = 'notebook.cell.executeAndFocusContainer';
const EXECUTE_CELL_SELECT_BELOW = 'notebook.cell.executeAndSelectBelow';
const EXECUTE_CELL_INSERT_BELOW = 'notebook.cell.executeAndInsertBelow';
const EXECUTE_CELL_AND_BELOW = 'notebook.cell.executeCellAndBelow';
const EXECUTE_CELLS_ABOVE = 'notebook.cell.executeCellsAbove';
const CLEAR_CELL_OUTPUTS_COMMAND_ID = 'notebook.cell.clearOutputs';
const TOGGLE_CELL_OUTPUTS_COMMAND_ID = 'notebook.cell.toggleOutputs';
const CENTER_ACTIVE_CELL = 'notebook.centerActiveCell';

const COLLAPSE_CELL_INPUT_COMMAND_ID = 'notebook.cell.collapseCellInput';
const COLLAPSE_CELL_OUTPUT_COMMAND_ID = 'notebook.cell.collapseCellOutput';

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

export interface INotebookCellActionContext extends INotebookActionContext {
	cell: ICellViewModel;
}

function getContextFromActiveEditor(editorService: IEditorService): INotebookActionContext | undefined {
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

function getContextFromUri(accessor: ServicesAccessor, context?: any) {
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
export abstract class NotebookMultiCellAction<T> extends Action2 {
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

	abstract parseArgs(accessor: ServicesAccessor, ...args: any[]): T | undefined;
	abstract runWithContext(accessor: ServicesAccessor, context: T): Promise<void>;

	protected isNotebookActionContext(context?: unknown): context is INotebookActionContext {
		return !!context && !!(context as INotebookActionContext).notebookEditor;
	}
	private isEditorContext(context?: unknown): boolean {
		return !!context && (context as IEditorCommandsContext).groupId !== undefined;
	}
	protected getEditorFromArgsOrActivePane(accessor: ServicesAccessor, context?: UriComponents): IActiveNotebookEditor | undefined {
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

	async run(accessor: ServicesAccessor, ...additionalArgs: any[]): Promise<void> {
		const context = additionalArgs[0];
		const isFromCellToolbar = this.isNotebookActionContext(context);
		const isFromEditorToolbar = this.isEditorContext(context);
		const from = isFromCellToolbar ? 'cellToolbar' : (isFromEditorToolbar ? 'editorToolbar' : 'other');
		const parsedArgs = this.parseArgs(accessor, ...additionalArgs);
		if (!parsedArgs) {
			return;
		}

		const telemetryService = accessor.get(ITelemetryService);
		telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: this.desc.id, from: from });
		return this.runWithContext(accessor, parsedArgs);
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
const executeCondition = ContextKeyExpr.and(
	NOTEBOOK_CELL_TYPE.isEqualTo('code'),
	ContextKeyExpr.or(
		ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0),
		NOTEBOOK_MISSING_KERNEL_EXTENSION
	));

const executeThisCellCondition = ContextKeyExpr.and(
	executeCondition,
	NOTEBOOK_CELL_EXECUTING.toNegated());

const executeNotebookCondition = ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0);

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

function isNotebookActionContext(context?: unknown): context is INotebookActionContext {
	return !!context && !!(context as INotebookActionContext).notebookEditor;
}

function getEditorFromArgsOrActivePane(accessor: ServicesAccessor, context?: UriComponents): IActiveNotebookEditor | undefined {
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

function parseMultiCellExecutionArgs(accessor: ServicesAccessor, ...args: any[]) {
	const firstArg = args[0];
	if (isNotebookActionContext(firstArg)) {
		// from UI
		return firstArg;
	}

	// then it's from keybindings or commands
	// todo@rebornix assertType
	if (isMultiCellArgs(firstArg)) {
		const editor = getEditorFromArgsOrActivePane(accessor, firstArg.document);
		if (!editor) {
			return undefined; // {{SQL CARBON EDIT}} strict nulls
		}

		const ranges = firstArg.ranges;
		const selectedCells = flatten(ranges.map(range => editor.viewModel.getCells(range).slice(0)));
		const autoReveal = firstArg.autoReveal;
		return {
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
			notebookEditor: editor,
			selectedCells: editor.viewModel.getCells(firstArg)
		};
	}

	// let's just execute the active cell
	const context = getContextFromActiveEditor(accessor.get(IEditorService));
	return context;
}

registerAction2(class ExecuteAboveCells extends NotebookMultiCellAction<INotebookActionContext> {
	constructor() {
		super({
			id: EXECUTE_CELLS_ABOVE,
			precondition: executeCondition,
			title: localize('notebookActions.executeAbove', "Execute Above Cells"),
			menu: [
				{
					id: MenuId.NotebookCellExecute,
					when: ContextKeyExpr.and(
						executeCondition,
						ContextKeyExpr.equals(`config.${ConsolidatedRunButton}`, true))
				},
				{
					id: MenuId.NotebookCellTitle,
					order: CellToolbarOrder.ExecuteAboveCells,
					group: CELL_TITLE_CELL_GROUP_ID,
					when: ContextKeyExpr.and(
						executeCondition,
						ContextKeyExpr.equals(`config.${ConsolidatedRunButton}`, false))
				}
			],
			icon: icons.executeAboveIcon
		});
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookActionContext | undefined {
		return parseMultiCellExecutionArgs(accessor, ...args);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		let endCellIdx: number | undefined = undefined;
		if (context.ui && context.cell) {
			endCellIdx = context.notebookEditor.viewModel.getCellIndex(context.cell);
		} else if (context.selectedCells) {
			endCellIdx = maxIndex(context.selectedCells, cell => context.notebookEditor.viewModel.getCellIndex(cell));
		}

		if (typeof endCellIdx === 'number') {
			const range = { start: 0, end: endCellIdx };
			const cells = context.notebookEditor.viewModel.getCells(range);
			context.notebookEditor.executeNotebookCells(cells);
		}
	}
});

registerAction2(class ExecuteCellAndBelow extends NotebookMultiCellAction<INotebookActionContext> {
	constructor() {
		super({
			id: EXECUTE_CELL_AND_BELOW,
			precondition: executeCondition,
			title: localize('notebookActions.executeBelow', "Execute Cell and Below"),
			menu: [
				{
					id: MenuId.NotebookCellExecute,
					when: ContextKeyExpr.and(
						executeCondition,
						ContextKeyExpr.equals(`config.${ConsolidatedRunButton}`, true))
				},
				{
					id: MenuId.NotebookCellTitle,
					order: CellToolbarOrder.ExecuteCellAndBelow,
					group: CELL_TITLE_CELL_GROUP_ID,
					when: ContextKeyExpr.and(
						executeCondition,
						ContextKeyExpr.equals(`config.${ConsolidatedRunButton}`, false))
				}
			],
			icon: icons.executeBelowIcon
		});
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookActionContext | undefined {
		return parseMultiCellExecutionArgs(accessor, ...args);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		let startCellIdx: number | undefined = undefined;
		if (context.ui && context.cell) {
			startCellIdx = context.notebookEditor.viewModel.getCellIndex(context.cell);
		} else if (context.selectedCells) {
			startCellIdx = minIndex(context.selectedCells, cell => context.notebookEditor.viewModel.getCellIndex(cell));
		}

		if (typeof startCellIdx === 'number') {
			const range = { start: startCellIdx, end: context.notebookEditor.viewModel.viewCells.length };
			const cells = context.notebookEditor.viewModel.getCells(range);
			context.notebookEditor.executeNotebookCells(cells);
		}
	}
});

const cellExecutionArgs: ReadonlyArray<{
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

registerAction2(class ExecuteCell extends NotebookMultiCellAction<INotebookActionContext> {
	constructor() {
		super({
			id: EXECUTE_CELL_COMMAND_ID,
			precondition: executeThisCellCondition,
			title: localize('notebookActions.execute', "Execute Cell"),
			keybinding: {
				when: NOTEBOOK_CELL_LIST_FOCUSED,
				primary: KeyMod.WinCtrl | KeyCode.Enter,
				win: {
					primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
				},
				weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
			},
			menu: {
				id: MenuId.NotebookCellExecute,
				when: executeThisCellCondition,
				group: 'inline'
			},
			description: {
				description: localize('notebookActions.execute', "Execute Cell"),
				args: cellExecutionArgs
			},
			icon: icons.executeIcon
		});
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookActionContext | undefined {
		return parseMultiCellExecutionArgs(accessor, ...args);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		return runCell(accessor, context);
	}
});

registerAction2(class ExecuteCellFocusContainer extends NotebookMultiCellAction<INotebookActionContext> {
	constructor() {
		super({
			id: EXECUTE_CELL_FOCUS_CONTAINER_COMMAND_ID,
			precondition: executeThisCellCondition,
			title: localize('notebookActions.executeAndFocusContainer', "Execute Cell and Focus Container"),
			description: {
				description: localize('notebookActions.executeAndFocusContainer', "Execute Cell and Focus Container"),
				args: cellExecutionArgs
			},
			icon: icons.executeIcon
		});
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookActionContext | undefined {
		return parseMultiCellExecutionArgs(accessor, ...args);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		if (context.ui && context.cell) {
			context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
		} else if (context.selectedCells) {
			const firstCell = context.selectedCells[0];

			if (firstCell) {
				context.notebookEditor.focusNotebookCell(firstCell, 'container', { skipReveal: true });
			}
		}

		await runCell(accessor, context);
	}
});

const cellCancelCondition = ContextKeyExpr.or(
	ContextKeyExpr.equals(NOTEBOOK_CELL_EXECUTION_STATE.key, 'executing'),
	ContextKeyExpr.equals(NOTEBOOK_CELL_EXECUTION_STATE.key, 'pending'),
);

registerAction2(class CancelExecuteCell extends NotebookMultiCellAction<INotebookActionContext> {
	constructor() {
		super({
			id: CANCEL_CELL_COMMAND_ID,
			precondition: cellCancelCondition,
			title: localize('notebookActions.cancel', "Stop Cell Execution"),
			icon: icons.stopIcon,
			menu: {
				id: MenuId.NotebookCellExecute,
				when: cellCancelCondition,
				group: 'inline'
			},
			description: {
				description: localize('notebookActions.cancel', "Stop Cell Execution"),
				args: [
					{
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
								}
							}
						}
					}
				]
			},
		});
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookActionContext | undefined {
		return parseMultiCellExecutionArgs(accessor, ...args);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		if (context.ui && context.cell) {
			return context.notebookEditor.cancelNotebookCells(Iterable.single(context.cell));
		} else if (context.selectedCells) {
			return context.notebookEditor.cancelNotebookCells(context.selectedCells);
		}
	}
});

registerAction2(class extends NotebookMultiCellAction<INotebookActionContext> {
	constructor() {
		super({
			id: TOGGLE_CELL_OUTPUTS_COMMAND_ID,
			precondition: NOTEBOOK_CELL_LIST_FOCUSED,
			title: localize('notebookActions.toggleOutputs', "Toggle Outputs"),
			description: {
				description: localize('notebookActions.toggleOutputs', "Toggle Outputs"),
				args: cellExecutionArgs
			}
		});
	}

	parseArgs(accessor: ServicesAccessor, ...args: any[]): INotebookActionContext | undefined {
		return parseMultiCellExecutionArgs(accessor, ...args);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		const textModel = context.notebookEditor.viewModel.notebookDocument;
		let cells: ICellViewModel[] = [];
		if (context.ui && context.cell) {
			cells = [context.cell];
		} else if (context.selectedCells) {
			cells = [...context.selectedCells];
		} else {
			cells = [...context.notebookEditor.viewModel.getCells()];
		}

		const edits: ICellEditOperation[] = [];
		for (const cell of cells) {
			const index = textModel.cells.indexOf(cell.model);
			if (index >= 0) {
				edits.push({ editType: CellEditType.Metadata, index, metadata: { ...cell.metadata, outputCollapsed: !cell.metadata.outputCollapsed } });
			}
		}

		textModel.applyEdits(edits, true, undefined, () => undefined, undefined);
	}
});

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

registerAction2(class ExecuteCellSelectBelow extends NotebookCellAction {
	constructor() {
		super({
			id: EXECUTE_CELL_SELECT_BELOW,
			precondition: ContextKeyExpr.or(executeThisCellCondition, NOTEBOOK_CELL_TYPE.isEqualTo('markup')),
			title: localize('notebookActions.executeAndSelectBelow', "Execute Notebook Cell and Select Below"),
			keybinding: {
				when: NOTEBOOK_CELL_LIST_FOCUSED,
				primary: KeyMod.Shift | KeyCode.Enter,
				weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
			},
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		const idx = context.notebookEditor.viewModel.getCellIndex(context.cell);
		if (typeof idx !== 'number') {
			return;
		}

		if (context.cell.cellKind === CellKind.Markup) {
			const nextCell = context.notebookEditor.viewModel.cellAt(idx + 1);
			context.cell.updateEditState(CellEditState.Preview, EXECUTE_CELL_SELECT_BELOW);
			if (nextCell) {
				context.notebookEditor.focusNotebookCell(nextCell, 'container');
			} else {
				const newCell = context.notebookEditor.insertNotebookCell(context.cell, CellKind.Markup, 'below');
				if (newCell) {
					context.notebookEditor.focusNotebookCell(newCell, 'editor');
				}
			}
			return;
		} else {
			// Try to select below, fall back on inserting
			const nextCell = context.notebookEditor.viewModel.cellAt(idx + 1);
			if (nextCell) {
				context.notebookEditor.focusNotebookCell(nextCell, 'container');
			} else {
				const newCell = context.notebookEditor.insertNotebookCell(context.cell, CellKind.Code, 'below');
				if (newCell) {
					context.notebookEditor.focusNotebookCell(newCell, 'editor');
				}
			}

			return runCell(accessor, context);
		}
	}
});

registerAction2(class ExecuteCellInsertBelow extends NotebookCellAction {
	constructor() {
		super({
			id: EXECUTE_CELL_INSERT_BELOW,
			precondition: executeThisCellCondition,
			title: localize('notebookActions.executeAndInsertBelow', "Execute Notebook Cell and Insert Below"),
			keybinding: {
				when: NOTEBOOK_CELL_LIST_FOCUSED,
				primary: KeyMod.Alt | KeyCode.Enter,
				weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
			},
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		const newFocusMode = context.cell.focusMode === CellFocusMode.Editor ? 'editor' : 'container';

		const executionP = runCell(accessor, context);
		const newCell = context.notebookEditor.insertNotebookCell(context.cell, CellKind.Code, 'below');
		if (newCell) {
			context.notebookEditor.focusNotebookCell(newCell, newFocusMode);
		}

		return executionP;
	}
});

registerAction2(class RenderAllMarkdownCellsAction extends NotebookAction {
	constructor() {
		super({
			id: RENDER_ALL_MARKDOWN_CELLS,
			title: localize('notebookActions.renderMarkdown', "Render All Markdown Cells"),
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		renderAllMarkdownCells(context);
	}
});

registerAction2(class ExecuteNotebookAction extends NotebookAction {
	constructor() {
		super({
			id: EXECUTE_NOTEBOOK_COMMAND_ID,
			title: localize('notebookActions.executeNotebook', "Run All"),
			icon: icons.executeAllIcon,
			description: {
				description: localize('notebookActions.executeNotebook', "Run All"),
				args: [
					{
						name: 'uri',
						description: 'The document uri'
					}
				]
			},
			menu: [
				{
					id: MenuId.EditorTitle,
					order: -1,
					group: 'navigation',
					when: ContextKeyExpr.and(
						NOTEBOOK_IS_ACTIVE_EDITOR,
						executeNotebookCondition,
						ContextKeyExpr.or(NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), NOTEBOOK_HAS_RUNNING_CELL.toNegated()),
						ContextKeyExpr.notEquals('config.notebook.globalToolbar', true)
					)
				},
				{
					id: MenuId.NotebookToolbar,
					order: -1,
					group: 'navigation/execute',
					when: ContextKeyExpr.and(
						executeNotebookCondition,
						ContextKeyExpr.or(NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), NOTEBOOK_HAS_RUNNING_CELL.toNegated()),
						ContextKeyExpr.equals('config.notebook.globalToolbar', true)
					)
				}
			]
		});
	}

	override getEditorContextFromArgsOrActive(accessor: ServicesAccessor, context?: UriComponents): INotebookActionContext | undefined {
		return getContextFromUri(accessor, context) ?? getContextFromActiveEditor(accessor.get(IEditorService));
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		renderAllMarkdownCells(context);

		const editorService = accessor.get(IEditorService);
		const editor = editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).find(
			editor => editor.editor instanceof NotebookEditorInput && editor.editor.viewType === context.notebookEditor.viewModel.viewType && editor.editor.resource.toString() === context.notebookEditor.viewModel.uri.toString());
		const editorGroupService = accessor.get(IEditorGroupsService);

		if (editor) {
			const group = editorGroupService.getGroup(editor.groupId);
			group?.pinEditor(editor.editor);
		}

		return context.notebookEditor.executeNotebookCells();
	}
});

function renderAllMarkdownCells(context: INotebookActionContext): void {
	context.notebookEditor.viewModel.viewCells.forEach(cell => {
		if (cell.cellKind === CellKind.Markup) {
			cell.updateEditState(CellEditState.Preview, 'renderAllMarkdownCells');
		}
	});
}

registerAction2(class CancelNotebook extends NotebookAction {
	constructor() {
		super({
			id: CANCEL_NOTEBOOK_COMMAND_ID,
			title: localize('notebookActions.cancelNotebook', "Stop Execution"),
			icon: icons.stopIcon,
			description: {
				description: localize('notebookActions.cancelNotebook', "Stop Execution"),
				args: [
					{
						name: 'uri',
						description: 'The document uri',
						constraint: URI
					}
				]
			},
			menu: [
				{
					id: MenuId.EditorTitle,
					order: -1,
					group: 'navigation',
					when: ContextKeyExpr.and(
						NOTEBOOK_IS_ACTIVE_EDITOR,
						NOTEBOOK_HAS_RUNNING_CELL,
						NOTEBOOK_INTERRUPTIBLE_KERNEL,
						ContextKeyExpr.notEquals('config.notebook.globalToolbar', true)
					)
				},
				{
					id: MenuId.NotebookToolbar,
					order: -1,
					group: 'navigation/execute',
					when: ContextKeyExpr.and(
						NOTEBOOK_HAS_RUNNING_CELL,
						NOTEBOOK_INTERRUPTIBLE_KERNEL,
						ContextKeyExpr.equals('config.notebook.globalToolbar', true)
					)
				}
			]
		});
	}

	override getEditorContextFromArgsOrActive(accessor: ServicesAccessor, context?: UriComponents): INotebookActionContext | undefined {
		return getContextFromUri(accessor, context) ?? getContextFromActiveEditor(accessor.get(IEditorService));
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		return context.notebookEditor.cancelNotebookCells();
	}
});

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

registerAction2(class ChangeCellToCodeAction extends NotebookCellAction {
	constructor() {
		super({
			id: CHANGE_CELL_TO_CODE_COMMAND_ID,
			title: localize('notebookActions.changeCellToCode', "Change Cell to Code"),
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
				primary: KeyCode.KEY_Y,
				weight: KeybindingWeight.WorkbenchContrib
			},
			precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_CELL_TYPE.isEqualTo('markup')),
			menu: {
				id: MenuId.NotebookCellTitle,
				when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_TYPE.isEqualTo('markup')),
				group: CellOverflowToolbarGroups.Edit,
			}
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		await changeCellToKind(CellKind.Code, context);
	}
});

registerAction2(class ChangeCellToMarkdownAction extends NotebookCellAction {
	constructor() {
		super({
			id: CHANGE_CELL_TO_MARKDOWN_COMMAND_ID,
			title: localize('notebookActions.changeCellToMarkdown', "Change Cell to Markdown"),
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
				primary: KeyCode.KEY_M,
				weight: KeybindingWeight.WorkbenchContrib
			},
			precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_CELL_TYPE.isEqualTo('code')),
			menu: {
				id: MenuId.NotebookCellTitle,
				when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_TYPE.isEqualTo('code')),
				group: CellOverflowToolbarGroups.Edit,
			}
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		await changeCellToKind(CellKind.Markup, context, 'markdown', Mimes.markdown);
	}
});

async function runCell(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {

	const editorGroupService = accessor.get(IEditorGroupsService);
	const group = editorGroupService.activeGroup;

	if (group) {
		if (group.activeEditor) {
			group.pinEditor(group.activeEditor);
		}
	}

	if (context.ui && context.cell) {
		if (context.cell.internalMetadata.runState === NotebookCellExecutionState.Executing) {
			return;
		}
		await context.notebookEditor.executeNotebookCells(Iterable.single(context.cell));
		if (context.autoReveal) {
			const cellIndex = context.notebookEditor.viewModel.getCellIndex(context.cell);
			context.notebookEditor.revealCellRangeInView({ start: cellIndex, end: cellIndex + 1 });
		}
	} else if (context.selectedCells) {
		await context.notebookEditor.executeNotebookCells(context.selectedCells);
		const firstCell = context.selectedCells[0];

		if (firstCell && context.autoReveal) {
			const cellIndex = context.notebookEditor.viewModel.getCellIndex(firstCell);
			context.notebookEditor.revealCellRangeInView({ start: cellIndex, end: cellIndex + 1 });
		}
	}
}

export async function changeCellToKind(kind: CellKind, context: INotebookCellActionContext, language?: string, mime?: string): Promise<ICellViewModel | null> {
	const { cell, notebookEditor } = context;

	if (cell.cellKind === kind) {
		return null;
	}

	if (!notebookEditor.viewModel) {
		return null;
	}

	if (notebookEditor.viewModel.options.isReadOnly) {
		return null;
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
	], true, undefined, () => undefined, undefined, true);
	const newCell = notebookEditor.viewModel.cellAt(idx);

	if (!newCell) {
		return null;
	}

	notebookEditor.focusNotebookCell(newCell, cell.getEditState() === CellEditState.Editing ? 'editor' : 'container');

	return newCell;
}

abstract class InsertCellCommand extends NotebookAction {
	constructor(
		desc: Readonly<IAction2Options>,
		private kind: CellKind,
		private direction: 'above' | 'below',
		private focusEditor: boolean
	) {
		super(desc);
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		let newCell: CellViewModel | null = null;
		if (context.ui) {
			context.notebookEditor.focus();
		}

		if (context.cell) {
			newCell = context.notebookEditor.insertNotebookCell(context.cell, this.kind, this.direction, undefined, true);
		} else {
			const focusRange = context.notebookEditor.getFocus();
			const next = focusRange.end - 1;
			newCell = context.notebookEditor.insertNotebookCell(context.notebookEditor.viewModel.viewCells[next], this.kind, this.direction, undefined, true);
		}

		if (newCell) {
			context.notebookEditor.focusNotebookCell(newCell, this.focusEditor ? 'editor' : 'container');
		}
	}
}

registerAction2(class InsertCodeCellAboveAction extends InsertCellCommand {
	constructor() {
		super(
			{
				id: INSERT_CODE_CELL_ABOVE_COMMAND_ID,
				title: localize('notebookActions.insertCodeCellAbove', "Insert Code Cell Above"),
				keybinding: {
					primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter,
					when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, InputFocusedContext.toNegated()),
					weight: KeybindingWeight.WorkbenchContrib
				},
				menu: {
					id: MenuId.NotebookCellInsert,
					order: 0
				}
			},
			CellKind.Code,
			'above',
			true);
	}
});

registerAction2(class InsertCodeCellAboveAndFocusContainerAction extends InsertCellCommand {
	constructor() {
		super(
			{
				id: INSERT_CODE_CELL_ABOVE_AND_FOCUS_CONTAINER_COMMAND_ID,
				title: localize('notebookActions.insertCodeCellAboveAndFocusContainer', "Insert Code Cell Above and Focus Container")
			},
			CellKind.Code,
			'above',
			false);
	}
});

registerAction2(class InsertCodeCellBelowAction extends InsertCellCommand {
	constructor() {
		super(
			{
				id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
				title: localize('notebookActions.insertCodeCellBelow', "Insert Code Cell Below"),
				keybinding: {
					primary: KeyMod.CtrlCmd | KeyCode.Enter,
					when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, InputFocusedContext.toNegated()),
					weight: KeybindingWeight.WorkbenchContrib
				},
				menu: {
					id: MenuId.NotebookCellInsert,
					order: 1
				}
			},
			CellKind.Code,
			'below',
			true);
	}
});

registerAction2(class InsertCodeCellBelowAndFocusContainerAction extends InsertCellCommand {
	constructor() {
		super(
			{
				id: INSERT_CODE_CELL_BELOW_AND_FOCUS_CONTAINER_COMMAND_ID,
				title: localize('notebookActions.insertCodeCellBelowAndFocusContainer', "Insert Code Cell Below and Focus Container"),
			},
			CellKind.Code,
			'below',
			false);
	}
});

registerAction2(class InsertCodeCellAtTopAction extends NotebookAction {
	constructor() {
		super(
			{
				id: INSERT_CODE_CELL_AT_TOP_COMMAND_ID,
				title: localize('notebookActions.insertCodeCellAtTop', "Add Code Cell At Top"),
				f1: false
			});
	}

	override async run(accessor: ServicesAccessor, context?: INotebookActionContext): Promise<void> {
		context = context ?? this.getEditorContextFromArgsOrActive(accessor);
		if (context) {
			this.runWithContext(accessor, context);
		}
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		const newCell = context.notebookEditor.insertNotebookCell(undefined, CellKind.Code, 'above', undefined, true);
		if (newCell) {
			context.notebookEditor.focusNotebookCell(newCell, 'editor');
		}
	}
});

registerAction2(class InsertMarkdownCellAtTopAction extends NotebookAction {
	constructor() {
		super(
			{
				id: INSERT_MARKDOWN_CELL_AT_TOP_COMMAND_ID,
				title: localize('notebookActions.insertMarkdownCellAtTop', "Add Markdown Cell At Top"),
				f1: false
			});
	}

	override async run(accessor: ServicesAccessor, context?: INotebookActionContext): Promise<void> {
		context = context ?? this.getEditorContextFromArgsOrActive(accessor);
		if (context) {
			this.runWithContext(accessor, context);
		}
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookActionContext): Promise<void> {
		const newCell = context.notebookEditor.insertNotebookCell(undefined, CellKind.Markup, 'above', undefined, true);
		if (newCell) {
			context.notebookEditor.focusNotebookCell(newCell, 'editor');
		}
	}
});

MenuRegistry.appendMenuItem(MenuId.NotebookCellBetween, {
	command: {
		id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
		title: localize('notebookActions.menu.insertCode', "$(add) Code"),
		tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
	},
	order: 0,
	group: 'inline',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left')
	)
});

MenuRegistry.appendMenuItem(MenuId.NotebookCellBetween, {
	command: {
		id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
		title: localize('notebookActions.menu.insertCode.minimalToolbar', "Add Code"),
		icon: Codicon.add,
		tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
	},
	order: 0,
	group: 'inline',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.equals('config.notebook.experimental.insertToolbarAlignment', 'left')
	)
});

MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
	command: {
		id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
		icon: Codicon.add,
		title: localize('notebookActions.menu.insertCode.ontoolbar', "Code"),
		tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
	},
	order: -5,
	group: 'navigation/add',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'betweenCells'),
		ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'hidden')
	)
});

MenuRegistry.appendMenuItem(MenuId.NotebookCellListTop, {
	command: {
		id: INSERT_CODE_CELL_AT_TOP_COMMAND_ID,
		title: localize('notebookActions.menu.insertCode', "$(add) Code"),
		tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
	},
	order: 0,
	group: 'inline',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left')
	)
});

MenuRegistry.appendMenuItem(MenuId.NotebookCellListTop, {
	command: {
		id: INSERT_CODE_CELL_AT_TOP_COMMAND_ID,
		title: localize('notebookActions.menu.insertCode.minimaltoolbar', "Add Code"),
		icon: Codicon.add,
		tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
	},
	order: 0,
	group: 'inline',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.equals('config.notebook.experimental.insertToolbarAlignment', 'left')
	)
});

registerAction2(class InsertMarkdownCellAboveAction extends InsertCellCommand {
	constructor() {
		super(
			{
				id: INSERT_MARKDOWN_CELL_ABOVE_COMMAND_ID,
				title: localize('notebookActions.insertMarkdownCellAbove', "Insert Markdown Cell Above"),
				menu: {
					id: MenuId.NotebookCellInsert,
					order: 2
				}
			},
			CellKind.Markup,
			'above',
			true);
	}
});

registerAction2(class InsertMarkdownCellBelowAction extends InsertCellCommand {
	constructor() {
		super(
			{
				id: INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID,
				title: localize('notebookActions.insertMarkdownCellBelow', "Insert Markdown Cell Below"),
				menu: {
					id: MenuId.NotebookCellInsert,
					order: 3
				}
			},
			CellKind.Markup,
			'below',
			true);
	}
});

MenuRegistry.appendMenuItem(MenuId.NotebookCellBetween, {
	command: {
		id: INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID,
		title: localize('notebookActions.menu.insertMarkdown', "$(add) Markdown"),
		tooltip: localize('notebookActions.menu.insertMarkdown.tooltip', "Add Markdown Cell")
	},
	order: 1,
	group: 'inline',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left')
	)
});

MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
	command: {
		id: INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID,
		icon: Codicon.add,
		title: localize('notebookActions.menu.insertMarkdown.ontoolbar', "Markdown"),
		tooltip: localize('notebookActions.menu.insertMarkdown.tooltip', "Add Markdown Cell")
	},
	order: -5,
	group: 'navigation/add',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'betweenCells'),
		ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'hidden'),
		ContextKeyExpr.notEquals(`config.${GlobalToolbarShowLabel}`, false)
	)
});

MenuRegistry.appendMenuItem(MenuId.NotebookCellListTop, {
	command: {
		id: INSERT_MARKDOWN_CELL_AT_TOP_COMMAND_ID,
		title: localize('notebookActions.menu.insertMarkdown', "$(add) Markdown"),
		tooltip: localize('notebookActions.menu.insertMarkdown.tooltip', "Add Markdown Cell")
	},
	order: 1,
	group: 'inline',
	when: ContextKeyExpr.and(
		NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
		ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left')
	)
});

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
		const viewModel = context.notebookEditor.viewModel;
		if (!viewModel || viewModel.options.isReadOnly) {
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

registerAction2(class DeleteCellAction extends NotebookCellAction {
	constructor() {
		super(
			{
				id: DELETE_CELL_COMMAND_ID,
				title: localize('notebookActions.deleteCell', "Delete Cell"),
				menu: {
					id: MenuId.NotebookCellTitle,
					when: NOTEBOOK_EDITOR_EDITABLE
				},
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
		const viewModel = context.notebookEditor.viewModel;
		if (!viewModel || viewModel.options.isReadOnly) {
			return;
		}

		runDeleteAction(viewModel, context.cell);
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
		const editor = context.notebookEditor;
		if (!editor.hasModel() || !editor.textModel.length) {
			return;
		}

		const cell = context.cell;
		const index = editor.textModel.cells.indexOf(cell.model);

		if (index < 0) {
			return;
		}

		editor.textModel.applyEdits([{ editType: CellEditType.Output, index, outputs: [] }], true, undefined, () => undefined, undefined);

		if (context.cell.internalMetadata.runState !== NotebookCellExecutionState.Executing) {
			context.notebookEditor.textModel.applyEdits([{
				editType: CellEditType.PartialInternalMetadata, index, internalMetadata: {
					runState: null,
					runStartTime: null,
					runStartTimeAdjustment: null,
					runEndTime: null,
					executionOrder: null,
					lastRunSuccess: null
				}
			}], true, undefined, () => undefined, undefined);
		}
	}
});

interface ILanguagePickInput extends IQuickPickItem {
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

		const picks: QuickPickInput[] = [
			...topItems,
			{ type: 'separator' },
			...mainItems
		];

		const selection = await quickInputService.pick(picks, { placeHolder: localize('pickLanguageToConfigure', "Select Language Mode") }) as ILanguagePickInput | undefined;
		if (selection && selection.languageId) {
			await this.setLanguage(context, selection.languageId);
		}
	}

	private async setLanguage(context: IChangeCellContext, languageId: string) {
		if (languageId === 'markdown' && context.cell?.language !== 'markdown') {
			const newCell = await changeCellToKind(CellKind.Markup, { cell: context.cell, notebookEditor: context.notebookEditor }, 'markdown', Mimes.markdown);
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

registerAction2(class ClearAllCellOutputsAction extends NotebookAction {
	constructor() {
		super({
			id: CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID,
			title: localize('clearAllCellsOutputs', 'Clear Outputs'),
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
		const editor = context.notebookEditor;
		if (!editor.hasModel() || !editor.textModel.length) {
			return;
		}

		editor.textModel.applyEdits(
			editor.textModel.cells.map((cell, index) => ({
				editType: CellEditType.Output, index, outputs: []
			})), true, undefined, () => undefined, undefined);

		const clearExecutionMetadataEdits = editor.textModel.cells.map((cell, index) => {
			if (cell.internalMetadata.runState !== NotebookCellExecutionState.Executing) {
				return {
					editType: CellEditType.PartialInternalMetadata, index, internalMetadata: {
						runState: null,
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
			context.notebookEditor.textModel.applyEdits(clearExecutionMetadataEdits, true, undefined, () => undefined, undefined);
		}
	}
});

registerAction2(class CenterActiveCellAction extends NotebookCellAction {
	constructor() {
		super({
			id: CENTER_ACTIVE_CELL,
			title: localize('notebookActions.centerActiveCell', "Center Active Cell"),
			keybinding: {
				when: NOTEBOOK_EDITOR_FOCUSED,
				primary: KeyMod.CtrlCmd | KeyCode.KEY_L,
				mac: {
					primary: KeyMod.WinCtrl | KeyCode.KEY_L,
				},
				weight: KeybindingWeight.WorkbenchContrib
			},
		});
	}

	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		return context.notebookEditor.revealInCenter(context.cell);
	}
});

abstract class ChangeNotebookCellMetadataAction extends NotebookCellAction {
	async runWithContext(accessor: ServicesAccessor, context: INotebookCellActionContext): Promise<void> {
		const textModel = context.notebookEditor.viewModel.notebookDocument;
		if (!textModel) {
			return;
		}

		const metadataDelta = this.getMetadataDelta();
		const edits: ICellEditOperation[] = [];
		const targetCells = (context.cell ? [context.cell] : context.selectedCells) ?? [];
		for (const cell of targetCells) {
			const index = textModel.cells.indexOf(cell.model);
			if (index >= 0) {
				edits.push({ editType: CellEditType.Metadata, index, metadata: { ...context.cell.metadata, ...metadataDelta } });
			}
		}

		textModel.applyEdits(edits, true, undefined, () => undefined, undefined);
	}

	abstract getMetadataDelta(): NotebookCellMetadata;
}

registerAction2(class CollapseCellInputAction extends ChangeNotebookCellMetadataAction {
	constructor() {
		super({
			id: COLLAPSE_CELL_INPUT_COMMAND_ID,
			title: localize('notebookActions.collapseCellInput', "Collapse Cell Input"),
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_INPUT_COLLAPSED.toNegated(), InputFocusedContext.toNegated()),
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_C),
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: {
				id: MenuId.NotebookCellTitle,
				when: ContextKeyExpr.and(NOTEBOOK_CELL_INPUT_COLLAPSED.toNegated()),
				group: CellOverflowToolbarGroups.Collapse,
				order: 0
			}
		});
	}

	getMetadataDelta(): NotebookCellMetadata {
		return { inputCollapsed: true };
	}
});

registerAction2(class ExpandCellInputAction extends ChangeNotebookCellMetadataAction {
	constructor() {
		super({
			id: EXPAND_CELL_INPUT_COMMAND_ID,
			title: localize('notebookActions.expandCellInput', "Expand Cell Input"),
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_INPUT_COLLAPSED),
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_C),
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: {
				id: MenuId.NotebookCellTitle,
				when: ContextKeyExpr.and(NOTEBOOK_CELL_INPUT_COLLAPSED),
				group: CellOverflowToolbarGroups.Collapse,
				order: 1
			}
		});
	}

	getMetadataDelta(): NotebookCellMetadata {
		return { inputCollapsed: false };
	}
});

registerAction2(class CollapseCellOutputAction extends ChangeNotebookCellMetadataAction {
	constructor() {
		super({
			id: COLLAPSE_CELL_OUTPUT_COMMAND_ID,
			title: localize('notebookActions.collapseCellOutput', "Collapse Cell Output"),
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_OUTPUT_COLLAPSED.toNegated(), InputFocusedContext.toNegated(), NOTEBOOK_CELL_HAS_OUTPUTS),
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_T),
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: {
				id: MenuId.NotebookCellTitle,
				when: ContextKeyExpr.and(NOTEBOOK_CELL_OUTPUT_COLLAPSED.toNegated(), NOTEBOOK_CELL_HAS_OUTPUTS),
				group: CellOverflowToolbarGroups.Collapse,
				order: 2
			}
		});
	}

	getMetadataDelta(): NotebookCellMetadata {
		return { outputCollapsed: true };
	}
});

registerAction2(class ExpandCellOuputAction extends ChangeNotebookCellMetadataAction {
	constructor() {
		super({
			id: EXPAND_CELL_OUTPUT_COMMAND_ID,
			title: localize('notebookActions.expandCellOutput', "Expand Cell Output"),
			keybinding: {
				when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_OUTPUT_COLLAPSED),
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyCode.KEY_T),
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: {
				id: MenuId.NotebookCellTitle,
				when: ContextKeyExpr.and(NOTEBOOK_CELL_OUTPUT_COLLAPSED),
				group: CellOverflowToolbarGroups.Collapse,
				order: 3
			}
		});
	}

	getMetadataDelta(): NotebookCellMetadata {
		return { outputCollapsed: false };
	}
});

registerAction2(class NotebookConfigureLayoutAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.notebook.layout.select',
			title: localize('workbench.notebook.layout.select.label', "Select between Notebook Layouts"),
			f1: true,
			precondition: ContextKeyExpr.equals(`config.${OpenGettingStarted}`, true),
			category: NOTEBOOK_ACTIONS_CATEGORY,
			menu: [
				{
					id: MenuId.EditorTitle,
					group: 'notebookLayout',
					when: ContextKeyExpr.and(
						NOTEBOOK_IS_ACTIVE_EDITOR,
						ContextKeyExpr.notEquals('config.notebook.globalToolbar', true),
						ContextKeyExpr.equals(`config.${OpenGettingStarted}`, true)
					),
					order: 0
				},
				{
					id: MenuId.NotebookToolbar,
					group: 'notebookLayout',
					when: ContextKeyExpr.and(
						ContextKeyExpr.equals('config.notebook.globalToolbar', true),
						ContextKeyExpr.equals(`config.${OpenGettingStarted}`, true)
					),
					order: 0
				}
			]
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(ICommandService).executeCommand('workbench.action.openWalkthrough', { category: 'notebooks', step: 'notebookProfile' }, true);
	}
});

registerAction2(class NotebookConfigureLayoutAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.notebook.layout.configure',
			title: localize('workbench.notebook.layout.configure.label', "Customize Notebook Layout"),
			f1: true,
			category: NOTEBOOK_ACTIONS_CATEGORY,
			menu: [
				{
					id: MenuId.NotebookEditorLayoutConfigure,
					group: 'notebookLayout',
					when: NOTEBOOK_IS_ACTIVE_EDITOR,
					order: 1
				},
				{
					id: MenuId.NotebookToolbar,
					group: 'notebookLayout',
					when: ContextKeyExpr.equals('config.notebook.globalToolbar', true),
					order: 1
				}
			]
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:notebookLayout' });
	}
});

MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	submenu: MenuId.NotebookEditorLayoutConfigure,
	rememberDefaultAction: false,
	title: { value: localize('customizeNotebook', "Customize Notebook..."), original: 'Customize Notebook...', },
	icon: Codicon.settingsGear,
	group: 'navigation',
	order: -1,
	when: NOTEBOOK_IS_ACTIVE_EDITOR
});

MenuRegistry.appendMenuItem(MenuId.NotebookEditorLayoutConfigure, {
	command: {
		id: 'breadcrumbs.toggle',
		title: { value: localize('cmd.toggle', "Toggle Breadcrumbs"), original: 'Toggle Breadcrumbs' },
	},
	group: 'notebookLayoutDetails',
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
	command: {
		id: 'breadcrumbs.toggle',
		title: { value: localize('cmd.toggle', "Toggle Breadcrumbs"), original: 'Toggle Breadcrumbs' },
	},
	group: 'notebookLayout',
	order: 2
});

CommandsRegistry.registerCommand('_resolveNotebookContentProvider', (accessor, args): {
	viewType: string;
	displayName: string;
	options: { transientOutputs: boolean; transientCellMetadata: TransientCellMetadata; transientDocumentMetadata: TransientDocumentMetadata; };
	filenamePattern: (string | glob.IRelativePattern | { include: string | glob.IRelativePattern, exclude: string | glob.IRelativePattern; })[];
}[] => {
	const notebookService = accessor.get<INotebookService>(INotebookService);
	const contentProviders = notebookService.getContributedNotebookTypes();
	return contentProviders.map(provider => {
		const filenamePatterns = provider.selectors.map(selector => {
			if (typeof selector === 'string') {
				return selector;
			}

			if (glob.isRelativePattern(selector)) {
				return selector;
			}

			if (isDocumentExcludePattern(selector)) {
				return {
					include: selector.include,
					exclude: selector.exclude
				};
			}

			return null;
		}).filter(pattern => pattern !== null) as (string | glob.IRelativePattern | { include: string | glob.IRelativePattern, exclude: string | glob.IRelativePattern; })[];

		return {
			viewType: provider.id,
			displayName: provider.displayName,
			filenamePattern: filenamePatterns,
			options: {
				transientCellMetadata: provider.options.transientCellMetadata,
				transientDocumentMetadata: provider.options.transientDocumentMetadata,
				transientOutputs: provider.options.transientOutputs
			}
		};
	});
});

CommandsRegistry.registerCommand('_resolveNotebookKernels', async (accessor, args: {
	viewType: string;
	uri: UriComponents;
}): Promise<{
	id?: string;
	label: string;
	description?: string;
	detail?: string;
	isPreferred?: boolean;
	preloads?: URI[];
}[]> => {
	const notebookKernelService = accessor.get(INotebookKernelService);
	const uri = URI.revive(args.uri as UriComponents);
	const kernels = notebookKernelService.getMatchingKernel({ uri, viewType: args.viewType });

	return kernels.all.map(provider => ({
		id: provider.id,
		label: provider.label,
		description: provider.description,
		detail: provider.detail,
		isPreferred: false, // todo@jrieken,@rebornix
		preloads: provider.preloadUris,
	}));
});
