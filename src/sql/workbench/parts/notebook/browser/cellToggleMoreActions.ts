/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ElementRef } from '@angular/core';

import { localize } from 'vs/nls';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { getErrorMessage } from 'vs/base/common/errors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import * as DOM from 'vs/base/browser/dom';

import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { CellActionBase, CellContext } from 'sql/workbench/parts/notebook/browser/cellViews/codeActions';
import { CellTypes, CellType } from 'sql/workbench/parts/notebook/common/models/contracts';
import { NotebookModel } from 'sql/workbench/parts/notebook/browser/models/notebookModel';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { ToggleMoreWidgetAction } from 'sql/workbench/parts/dashboard/browser/core/actions';
import { CellModel } from 'sql/workbench/parts/notebook/browser/models/cell';

export const HIDDEN_CLASS = 'actionhidden';

export class CellToggleMoreActions {
	private _actions: CellActionBase[] = [];
	private _moreActions: ActionBar;
	private _moreActionsElement: HTMLElement;
	constructor(
		@IInstantiationService private instantiationService: IInstantiationService) {
		this._actions.push(
			instantiationService.createInstance(DeleteCellAction, 'delete', localize('delete', "Delete")),
			instantiationService.createInstance(AddCellFromContextAction, 'codeBefore', localize('codeBefore', "Insert Code Before"), CellTypes.Code, false),
			instantiationService.createInstance(AddCellFromContextAction, 'codeAfter', localize('codeAfter', "Insert Code After"), CellTypes.Code, true),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownBefore', localize('markdownBefore', "Insert Text Before"), CellTypes.Markdown, false),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownAfter', localize('markdownAfter', "Insert Text After"), CellTypes.Markdown, true),
			instantiationService.createInstance(RunCellsAction, 'runAllBefore', localize('runAllBefore', "Run Cells Before"), false),
			instantiationService.createInstance(RunCellsAction, 'runAllAfter', localize('runAllAfter', "Run Cells After"), true),
			instantiationService.createInstance(ClearCellOutputAction, 'clear', localize('clear', "Clear Output"))
		);
	}

	public onInit(elementRef: ElementRef, model: NotebookModel, cellModel: ICellModel) {
		let context = new CellContext(model, cellModel);
		this._moreActionsElement = <HTMLElement>elementRef.nativeElement;
		if (this._moreActionsElement.childNodes.length > 0) {
			this._moreActionsElement.removeChild(this._moreActionsElement.childNodes[0]);
		}
		this._moreActions = new ActionBar(this._moreActionsElement, { orientation: ActionsOrientation.VERTICAL });
		this._moreActions.context = { target: this._moreActionsElement };
		let validActions = this._actions.filter(a => a.canRun(context));
		this._moreActions.push(this.instantiationService.createInstance(ToggleMoreWidgetAction, validActions, context), { icon: true, label: false });
	}

	public toggleVisible(visible: boolean): void {
		if (!this._moreActionsElement) {
			return;
		}
		if (visible) {
			DOM.addClass(this._moreActionsElement, HIDDEN_CLASS);
		} else {
			DOM.removeClass(this._moreActionsElement, HIDDEN_CLASS);
		}
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

export class DeleteCellAction extends CellActionBase {
	constructor(id: string, label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
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
