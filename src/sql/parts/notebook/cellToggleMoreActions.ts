/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ElementRef } from '@angular/core';

import { nb } from 'sqlops';

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { getErrorMessage } from 'vs/base/common/errors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';

import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { CellContext, CellActionBase } from 'sql/parts/notebook/cellViews/codeActions';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { ToggleMoreWidgetAction } from 'sql/parts/dashboard/common/actions';
import { CellTypes, CellType } from 'sql/parts/notebook/models/contracts';
import { CellModel } from 'sql/parts/notebook/models/cell';

export class CellToggleMoreActions {
	private _actions: Action[] = [];
	private _moreActions: ActionBar;
	constructor(
		@IInstantiationService private instantiationService: IInstantiationService) {
		this._actions.push(
			instantiationService.createInstance(DeleteCellAction, 'delete', localize('delete', 'Delete')),
			instantiationService.createInstance(AddCellFromContextAction,'codeBefore', localize('codeBefore', 'Insert Code before'), CellTypes.Code, false),
			instantiationService.createInstance(AddCellFromContextAction, 'codeAfter', localize('codeAfter', 'Insert Code after'), CellTypes.Code, true),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownBefore', localize('markdownBefore', 'Insert Markdown before'), CellTypes.Markdown, false),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownAfter', localize('markdownAfter', 'Insert Markdown after'), CellTypes.Markdown, true),
			instantiationService.createInstance(ClearCellOutputAction, 'clear', localize('clear', 'Clear output'))
		);
	}

	public toggle(showIcon: boolean, elementRef: ElementRef, model: NotebookModel, cellModel: ICellModel) {
		let context = new CellContext(model,cellModel);
		let moreActionsElement = <HTMLElement>elementRef.nativeElement;
		if (showIcon) {
			if (moreActionsElement.childNodes.length > 0) {
				moreActionsElement.removeChild(moreActionsElement.childNodes[0]);
			}
			this._moreActions = new ActionBar(moreActionsElement, { orientation: ActionsOrientation.VERTICAL });
			this._moreActions.context = { target: moreActionsElement };
			this._moreActions.push(this.instantiationService.createInstance(ToggleMoreWidgetAction, this._actions, context), { icon: showIcon, label: false });
		}
		else if (moreActionsElement.childNodes.length > 0) {
			moreActionsElement.removeChild(moreActionsElement.childNodes[0]);
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

	doRun(context: CellContext): Promise<void> {
		try {
			(context.model.activeCell as CellModel).clearOutputs();
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
