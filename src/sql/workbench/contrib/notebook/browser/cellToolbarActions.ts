/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Action, IAction, Separator } from 'vs/base/common/actions';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { CellActionBase, CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { CellTypes, CellType } from 'sql/workbench/services/notebook/common/contracts';
import { ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { firstIndex } from 'vs/base/common/arrays';
import { getErrorMessage } from 'vs/base/common/errors';
import Severity from 'vs/base/common/severity';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';


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

	public run(context: CellContext): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			try {
				self.editMode = !self.editMode;
				context.cell.isEditMode = self.editMode;
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
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

export class CellToggleMoreActions {
	private _actions: (Action | CellActionBase)[] = [];
	private _moreActions: ActionBar;
	private _moreActionsElement: HTMLElement;
	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		this._actions.push(
			instantiationService.createInstance(ConvertCellAction, 'convertCell', localize('convertCell', "Convert Cell")),
			new Separator(),
			instantiationService.createInstance(RunCellsAction, 'runAllAbove', localize('runAllAbove', "Run Cells Above"), false),
			instantiationService.createInstance(RunCellsAction, 'runAllBelow', localize('runAllBelow', "Run Cells Below"), true),
			new Separator(),
			instantiationService.createInstance(AddCellFromContextAction, 'codeAbove', localize('codeAbove', "Insert Code Above"), CellTypes.Code, false),
			instantiationService.createInstance(AddCellFromContextAction, 'codeBelow', localize('codeBelow', "Insert Code Below"), CellTypes.Code, true),
			new Separator(),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownAbove', localize('markdownAbove', "Insert Text Above"), CellTypes.Markdown, false),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownBelow', localize('markdownBelow', "Insert Text Below"), CellTypes.Markdown, true),
			new Separator(),
			instantiationService.createInstance(CollapseCellAction, 'collapseCell', localize('collapseCell', "Collapse Cell"), true),
			instantiationService.createInstance(CollapseCellAction, 'expandCell', localize('expandCell', "Expand Cell"), false),
			new Separator(),
			instantiationService.createInstance(ClearCellOutputAction, 'clear', localize('clear', "Clear Result")),
		);
	}

	public onInit(elementRef: HTMLElement, context: CellContext) {
		this._moreActionsElement = elementRef;
		if (this._moreActionsElement.childNodes.length > 0) {
			this._moreActionsElement.removeChild(this._moreActionsElement.childNodes[0]);
		}
		this._moreActions = new ActionBar(this._moreActionsElement, { orientation: ActionsOrientation.VERTICAL });
		this._moreActions.context = { target: this._moreActionsElement };
		let validActions = this._actions.filter(a => a instanceof Separator || a instanceof CellActionBase && a.canRun(context));
		removeDuplicatedAndStartingSeparators(validActions);
		this._moreActions.push(this.instantiationService.createInstance(ToggleMoreActions, validActions, context), { icon: true, label: false });
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
			let index = firstIndex(model.cells, (cell) => cell.id === context.cell.id);
			if (index !== undefined && this.isAfter) {
				index += 1;
			}
			model.addCell(this.cellType, index);
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

	public canRun(context: CellContext): boolean {
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

	public canRun(context: CellContext): boolean {
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

	public canRun(context: CellContext): boolean {
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

export class ToggleMoreActions extends Action {

	private static readonly ID = 'toggleMore';
	private static readonly LABEL = localize('toggleMore', "Toggle More");
	private static readonly ICON = 'masked-icon more';

	constructor(
		private readonly _actions: Array<IAction>,
		private readonly _context: CellContext,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService
	) {
		super(ToggleMoreActions.ID, ToggleMoreActions.LABEL, ToggleMoreActions.ICON);
	}

	run(context: StandardKeyboardEvent): Promise<boolean> {
		this._contextMenuService.showContextMenu({
			getAnchor: () => context.target,
			getActions: () => this._actions,
			getActionsContext: () => this._context
		});
		return Promise.resolve(true);
	}
}
