/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { nb } from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { CellType } from 'sql/parts/notebook/models/contracts';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { getErrorMessage } from 'sql/parts/notebook/notebookUtils';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { ICellModel, FutureInternal } from 'sql/parts/notebook/models/modelInterfaces';
import { ToggleableAction } from 'sql/parts/notebook/notebookActions';

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

	public run(context: CellContext): TPromise<boolean> {
		if (hasModelAndCell(context, this.notificationService)) {
			return TPromise.wrap(this.runCellAction(context).then(() => true));
		}
		return TPromise.as(true);
	}

	abstract runCellAction(context: CellContext): Promise<void>;
}

export class RunCellAction extends ToggleableAction {
	public static ID = 'notebook.runCell';
	public static LABEL = 'Run cell';

	constructor(@INotificationService private notificationService: INotificationService) {
		super(RunCellAction.ID, {
			shouldToggleTooltip: true,
			toggleOnLabel: localize('runCell', 'Run cell'),
			toggleOnClass: 'toolbarIconRun',
			toggleOffLabel: localize('stopCell', 'Cancel execution'),
			toggleOffClass: 'toolbarIconStop',
			isOn: true
		});
	}

	public run(context: CellContext): TPromise<boolean> {
		if (hasModelAndCell(context, this.notificationService)) {
			return TPromise.wrap(this.runCellAction(context).then(() => true));
		}
		return TPromise.as(true);
	}

	public async runCellAction(context: CellContext): Promise<void> {
		try {
			let model = context.model;
			let cell = context.cell;
			let kernel = await this.getOrStartKernel(model);
			if (!kernel) {
				return;
			}
			// If cell is currently running and user clicks the stop/cancel button, call kernel.interrupt()
			// This matches the same behavior as JupyterLab
			if (cell.future && cell.future.inProgress) {
				cell.future.inProgress = false;
				await kernel.interrupt();
			} else {
				// TODO update source based on editor component contents
				let content = cell.source;
				if (content) {
					this.toggle(false);
					let future = await kernel.requestExecute({
						code: content,
						stop_on_error: true
					}, false);
					cell.setFuture(future as FutureInternal);
					// For now, await future completion. Later we should just track and handle cancellation based on model notifications
					let reply = await future.done;
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.error(message);
		} finally {
			this.toggle(true);
		}
	}

	private async getOrStartKernel(model: NotebookModel): Promise<nb.IKernel> {
		let clientSession = model && model.clientSession;
		if (!clientSession) {
			this.notificationService.error(localize('notebookNotReady', 'The session for this notebook is not yet ready'));
			return undefined;
		} else if (!clientSession.isReady || clientSession.status === 'dead') {
			this.notificationService.info(localize('sessionNotReady', 'The session for this notebook will start momentarily'));
			await clientSession.kernelChangeCompleted;
		}
		if (!clientSession.kernel) {
			let defaultKernel = model && model.defaultKernel && model.defaultKernel.name;
			if (!defaultKernel) {
				this.notificationService.error(localize('noDefaultKernel', 'No kernel is available for this notebook'));
				return undefined;
			}
			await clientSession.changeKernel({
				name: defaultKernel
			});
		}
		return clientSession.kernel;
	}
}
