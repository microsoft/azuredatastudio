/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Action, IAction, IActionRunner, Separator } from 'vs/base/common/actions';
import { CellActionBase, CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { CellTypes, CellType } from 'sql/workbench/services/notebook/common/contracts';
import { AddCodeCellAction, AddTextCellAction, ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { getErrorMessage } from 'vs/base/common/errors';
import Severity from 'vs/base/common/severity';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { CellEditModes, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { DropdownMenuActionViewItem } from 'vs/base/browser/ui/dropdown/dropdownActionViewItem';
import { AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import { moreActionsLabel } from 'sql/workbench/contrib/notebook/common/notebookLoc';

const addCellLabel = localize('addCellLabel', "Add cell");

export class EditCellAction extends ToggleableAction {
	// Constants
	private static readonly editLabel = localize('editLabel', "Edit");
	private static readonly closeLabel = localize('closeLabel', "Close");
	private static readonly baseClass = 'codicon';
	private static readonly editCssClass = 'edit';
	private static readonly closeCssClass = 'close';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(
		id: string, toggleTooltip: boolean, isEditMode: boolean
	) {
		super(id, {
			baseClass: EditCellAction.baseClass,
			toggleOnLabel: EditCellAction.closeLabel,
			toggleOnClass: EditCellAction.closeCssClass,
			toggleOffLabel: EditCellAction.editLabel,
			toggleOffClass: EditCellAction.editCssClass,
			maskedIconClass: EditCellAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: isEditMode
		});
	}

	public get editMode(): boolean {
		return this.state.isOn;
	}
	public set editMode(value: boolean) {
		this.toggle(value);
	}

	public override async run(context: CellContext): Promise<void> {
		this.editMode = !this.editMode;
		context.cell.isEditMode = this.editMode;
	}
}

export class SplitCellAction extends CellActionBase {
	public cellType: CellType;

	constructor(
		id: string,
		label: string,
		cssClass: string,
		@INotificationService notificationService: INotificationService,
		@INotebookService private notebookService: INotebookService,
	) {
		super(id, label, cssClass, notificationService);
		this._cssClass = cssClass;
		this._tooltip = label;
		this._label = '';
	}
	doRun(context: CellContext): Promise<void> {
		let model = context.model;
		let index = model.cells.findIndex((cell) => cell.id === context.cell.id);
		context.model?.splitCell(context.cell.cellType, this.notebookService, index, context.cell.metadata?.language);
		return Promise.resolve();
	}
	public setListener(context: CellContext) {
		this._register(context.cell.onCurrentEditModeChanged(currentMode => {
			this.enabled = currentMode === CellEditModes.WYSIWYG ? false : true;
		}));
		this._register(context.cell.notebookModel.onCellTypeChanged(_ => {
			this.enabled = context.cell.currentMode === CellEditModes.WYSIWYG ? false : true;
		}));
	}
}

export class MoveCellAction extends CellActionBase {
	constructor(
		id: string,
		cssClass: string,
		label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
		this._cssClass = cssClass;
		this._tooltip = label;
		this._label = '';
	}

	doRun(context: CellContext): Promise<void> {
		let moveDirection = this._cssClass.includes('move-down') ? MoveDirection.Down : MoveDirection.Up;
		try {
			context.model.moveCell(context.cell, moveDirection);
			context.model.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.MoveCell, { moveDirection: moveDirection });
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class DeleteCellAction extends CellActionBase {
	constructor(
		id: string,
		cssClass: string,
		label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
		this._cssClass = cssClass;
		this._tooltip = label;
		this._label = '';
	}

	doRun(context: CellContext): Promise<void> {
		try {
			context.model.deleteCell(context.cell);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export function removeDuplicatedAndStartingSeparators(actions: (Action | CellActionBase)[]): void {
	let indexesToRemove: number[] = [];
	for (let i = 0; i < actions.length; i++) {
		// Handle multiple separators in a row
		if (i > 0 && actions[i] instanceof Separator && actions[i - 1] instanceof Separator) {
			indexesToRemove.push(i);
		}
	}
	if (indexesToRemove.length > 0) {
		for (let i = indexesToRemove.length - 1; i >= 0; i--) {
			actions.splice(indexesToRemove[i], 1);
		}
	}
	if (actions[0] instanceof Separator) {
		actions.splice(0, 1);
	}
	if (actions[actions.length - 1] instanceof Separator) {
		actions.splice(actions.length - 1, 1);
	}
}

export class ConvertCellAction extends CellActionBase {
	constructor(id: string, label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	doRun(context: CellContext): Promise<void> {
		try {
			context?.model?.convertCellType(context?.cell);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class AddCellFromContextAction extends CellActionBase {
	constructor(
		id: string, label: string, private cellType: CellType, private isAfter: boolean,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	doRun(context: CellContext): Promise<void> {
		try {
			let model = context.model;
			let index = model.cells.findIndex((cell) => cell.id === context.cell.id);
			if (index !== undefined && this.isAfter) {
				index += 1;
			}
			model.addCell(this.cellType, index, context.cell.metadata?.language);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class ClearCellOutputAction extends CellActionBase {
	constructor(id: string, label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	public override canRun(context: CellContext): boolean {
		return context.cell && context.cell.cellType === CellTypes.Code;
	}


	doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				(cell as CellModel).clearOutputs();
			}
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}

}

export class RunCellsAction extends CellActionBase {
	constructor(id: string,
		label: string,
		private isAfter: boolean,
		@INotificationService notificationService: INotificationService,
		@INotebookService private notebookService: INotebookService,
	) {
		super(id, label, undefined, notificationService);
	}

	public override canRun(context: CellContext): boolean {
		return context.cell && context.cell.cellType === CellTypes.Code;
	}

	async doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				let editor = this.notebookService.findNotebookEditor(cell.notebookModel.notebookUri);
				if (editor) {
					if (this.isAfter) {
						await editor.runAllCells(cell, undefined);
					} else {
						await editor.runAllCells(undefined, cell);
					}
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class CollapseCellAction extends CellActionBase {
	constructor(id: string,
		label: string,
		private collapseCell: boolean,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	public override canRun(context: CellContext): boolean {
		return context.cell && context.cell.cellType === CellTypes.Code;
	}

	async doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				if (this.collapseCell) {
					if (!cell.isCollapsed) {
						cell.isCollapsed = true;
					}
				} else {
					if (cell.isCollapsed) {
						cell.isCollapsed = false;
					}
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class ToggleAddCellDropdownAction extends Action {

	public static readonly ID = 'notebook.toggleAddCell';
	public static readonly LABEL = addCellLabel;
	public static readonly ICON = 'codicon masked-icon new';

	constructor(

	) {
		super(ToggleAddCellDropdownAction.ID);
		this.tooltip = ToggleAddCellDropdownAction.LABEL;
	}
}

export class ToggleAddCellActionViewItem extends DropdownMenuActionViewItem {
	constructor(
		action: IAction,
		actionRunner: IActionRunner,
		cellContext: CellContext,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(action,
			[
				instantiationService.createInstance(AddCodeCellAction),
				instantiationService.createInstance(AddTextCellAction)
			],
			contextMenuService,
			{
				actionRunner,
				classNames: ToggleAddCellDropdownAction.ICON,
				anchorAlignmentProvider: () => AnchorAlignment.LEFT
			});
		this.setActionContext(cellContext);
	}
}

export class CellToggleMoreAction extends Action {
	public static readonly ID = 'notebook.toggleMore';
	public static readonly LABEL = moreActionsLabel;
	public static readonly ICON = 'codicon masked-icon more';

	constructor() {
		super(CellToggleMoreAction.ID);
		this.tooltip = CellToggleMoreAction.LABEL;
	}
}

export class CellToggleMoreActionViewItem extends DropdownMenuActionViewItem {
	private _actions: (Action | CellActionBase)[];
	constructor(
		action: IAction,
		actionRunner: IActionRunner,
		private _cellContext: CellContext,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(action,
			{
				getActions: () => { return this.getValidActions(); }
			},
			contextMenuService,
			{
				actionRunner,
				classNames: CellToggleMoreAction.ICON,
				anchorAlignmentProvider: () => AnchorAlignment.LEFT
			});
		this.setActionContext(this._cellContext);
		this._actions = [
			instantiationService.createInstance(ConvertCellAction, 'convertCell', localize('convertCell', "Convert Cell")),
			<any>new Separator(),
			instantiationService.createInstance(RunCellsAction, 'runAllAbove', localize('runAllAbove', "Run Cells Above"), false),
			instantiationService.createInstance(RunCellsAction, 'runAllBelow', localize('runAllBelow', "Run Cells Below"), true),
			<any>new Separator(),
			instantiationService.createInstance(AddCellFromContextAction, 'codeAbove', localize('codeAbove', "Insert Code Above"), CellTypes.Code, false),
			instantiationService.createInstance(AddCellFromContextAction, 'codeBelow', localize('codeBelow', "Insert Code Below"), CellTypes.Code, true),
			<any>new Separator(),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownAbove', localize('markdownAbove', "Insert Text Above"), CellTypes.Markdown, false),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownBelow', localize('markdownBelow', "Insert Text Below"), CellTypes.Markdown, true),
			<any>new Separator(),
			instantiationService.createInstance(CollapseCellAction, 'collapseCell', localize('collapseCell', "Collapse Cell"), true),
			instantiationService.createInstance(CollapseCellAction, 'expandCell', localize('expandCell', "Expand Cell"), false),
			<any>new Separator(),
			instantiationService.createInstance(ParametersCellAction, 'makeParameterCell', localize('makeParameterCell', "Make parameter cell"), true),
			instantiationService.createInstance(ParametersCellAction, 'removeParameterCell', localize('RemoveParameterCell', "Remove parameter cell"), false),
			<any>new Separator(),
			instantiationService.createInstance(ClearCellOutputAction, 'clear', localize('clear', "Clear Result")),
		];
	}

	/**
	 * Gets the actions that are valid for the current cell context
	 * @returns The list of valid actions
	 */
	public getValidActions(): readonly IAction[] {
		const validActions = this._actions.filter(a => a instanceof Separator || a instanceof CellActionBase && a.canRun(this._cellContext));
		removeDuplicatedAndStartingSeparators(validActions);
		return validActions;
	}
}

export class ParametersCellAction extends CellActionBase {
	constructor(id: string,
		label: string,
		private parametersCell: boolean,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	public override canRun(context: CellContext): boolean {
		return context.cell?.cellType === CellTypes.Code;
	}

	async doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				if (this.parametersCell) {
					if (!cell.isParameter) {
						cell.isParameter = true;
					}
				} else {
					if (cell.isParameter) {
						cell.isParameter = false;
					}
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
	}
}
