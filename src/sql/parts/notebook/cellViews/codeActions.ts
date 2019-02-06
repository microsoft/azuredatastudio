/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { nb } from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { getErrorMessage } from 'sql/parts/notebook/notebookUtils';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { ToggleableAction } from 'sql/parts/notebook/notebookActions';
import { IDisposable } from 'vs/base/common/lifecycle';

let notebookMoreActionMsg = localize('notebook.failed', "Please select active cell and try again");

function hasModelAndCell(context: CellContext, notificationService: INotificationService): boolean  {
	if (!context || !context.model) {
		return false;
	}
	if (context.cell === undefined) {
		notificationService.notify({
			severity: Severity.Error,
			message: notebookMoreActionMsg
		});
		return false;
	}
	return true;
}

export class CellContext {
	constructor(public model: NotebookModel, private _cell?: ICellModel) {
	}

	public get cell(): ICellModel {
		return this._cell ? this._cell : this.model.activeCell;
	}
}

export abstract class CellActionBase extends Action {

	constructor(id: string, label: string, icon: string, protected notificationService: INotificationService) {
		super(id, label, icon);
	}

	public canRun(context: CellContext): boolean {
		return true;
	}

	public run(context: CellContext): TPromise<boolean> {
		if (hasModelAndCell(context, this.notificationService)) {
			return TPromise.wrap(this.doRun(context).then(() => true));
		}
		return TPromise.as(true);
	}

	abstract doRun(context: CellContext): Promise<void>;
}

export class RunCellAction extends ToggleableAction {
	public static ID = 'notebook.runCell';
	public static LABEL = 'Run cell';
	private _executionChangedDisposable: IDisposable;
	private _context: CellContext;
	constructor(context: CellContext, @INotificationService private notificationService: INotificationService) {
		super(RunCellAction.ID, {
			shouldToggleTooltip: true,
			toggleOffLabel: localize('runCell', 'Run cell'),
			toggleOffClass: 'toolbarIconRun',
			toggleOnLabel: localize('stopCell', 'Cancel execution'),
			toggleOnClass: 'toolbarIconStop',
			// On == running
			isOn: false
		});
		this.ensureContextIsUpdated(context);
	}

	private _handleExecutionStateChange(running: boolean): void {
		this.toggle(running);
	}

	public run(context?: CellContext): TPromise<boolean> {
		return TPromise.wrap(this.doRun(context).then(() => true));
	}

	public async doRun(context: CellContext): Promise<void> {
		this.ensureContextIsUpdated(context);
		if (!this._context) {
			// TODO should we error?
			return;
		}
		try {
			await this._context.cell.runCell(this.notificationService);
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.error(message);
		}
	}

	private ensureContextIsUpdated(context: CellContext) {
		if (context && context !== this._context) {
			if (this._executionChangedDisposable) {
				this._executionChangedDisposable.dispose();
			}
			this._context = context;
			this.toggle(context.cell.isRunning);
			this._executionChangedDisposable = this._context.cell.onExecutionStateChange(this._handleExecutionStateChange, this);
		}
	}
}
