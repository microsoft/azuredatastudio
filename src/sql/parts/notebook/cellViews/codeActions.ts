/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { nb } from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as types from 'vs/base/common/types';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';

import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { getErrorMessage } from 'sql/parts/notebook/notebookUtils';
import { ICellModel, CellExecutionState } from 'sql/parts/notebook/models/modelInterfaces';
import { MultiStateAction, IMultiStateData, IActionStateData } from 'sql/parts/notebook/notebookActions';

let notebookMoreActionMsg = localize('notebook.failed', "Please select active cell and try again");
const emptyExecutionCountLabel = '[ ]';

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

export class RunCellAction extends MultiStateAction<CellExecutionState> {
	public static ID = 'notebook.runCell';
	public static LABEL = 'Run cell';
	private _executionChangedDisposable: IDisposable;
	private _context: CellContext;
	constructor(context: CellContext, @INotificationService private notificationService: INotificationService) {
		super(RunCellAction.ID, new IMultiStateData<CellExecutionState>([
			{ key: CellExecutionState.Hidden, value: { label: emptyExecutionCountLabel, className: '', tooltip: '', hideIcon: true }},
			{ key: CellExecutionState.Stopped, value: { label: '', className: 'toolbarIconRun', tooltip: localize('runCell', 'Run cell') }},
			{ key: CellExecutionState.Running, value: { label: '', className: 'toolbarIconStop', tooltip: localize('stopCell', 'Cancel execution') }},
			{ key: CellExecutionState.Error, value: { label: '', className: 'toolbarIconRunError', tooltip: localize('errorRunCell', 'Error on last run. Click to run again') }},
		], CellExecutionState.Hidden ));
		this.ensureContextIsUpdated(context);
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
			this.updateStateAndExecutionCount(context.cell.executionState);
			this._executionChangedDisposable = this._context.cell.onExecutionStateChange((state) => {
				this.updateStateAndExecutionCount(state);
			});
		}
	}

	private updateStateAndExecutionCount(state: CellExecutionState) {
		let label = emptyExecutionCountLabel;
		let className = '';
		if (!types.isUndefinedOrNull(this._context.cell.executionCount)) {
			label = `[${this._context.cell.executionCount}]`;
			// Heuristic to try and align correctly independent of execution count length. Moving left margin
			// back by a few px seems to make things "work" OK, but isn't a super clean solution
			if (label.length === 4) {
				className = 'execCountTen';
			} else if (label.length > 4) {
				className = 'execCountHundred';
			}
		}
		this.states.updateStateData(CellExecutionState.Hidden, (data) => {
			data.label = label;
			data.className = className;
		});
		this.updateState(state);
	}
}
