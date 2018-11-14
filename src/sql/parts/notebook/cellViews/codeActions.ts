/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { CellType } from 'sql/parts/notebook/models/contracts';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { getErrorMessage } from 'sql/parts/notebook/notebookUtils';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { NOTFOUND } from 'dns';
import { NsfwWatcherService } from 'vs/workbench/services/files/node/watcher/nsfw/nsfwWatcherService';

let notebookMoreActionMsg = localize('notebook.failed', "Please select active cell and try again");
export class RunCellAction extends Action {
	public static ID = 'jobaction.notebookRunCell';
	public static LABEL = 'Run cell';

	constructor(
	) {
		super(RunCellAction.ID, '', 'toolbarIconRun');
		this.tooltip = localize('runCell', 'Run cell');
	}

	public run(context: any): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class AddCellAction extends Action {
	constructor(
		id: string, label: string, private cellType: CellType, private isAfter: boolean, private notificationService: INotificationService
	) {
		super(id, label);
	}
	public run(model: NotebookModel): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				if (!model) {
					return;
				}
				if (model.activeCell === undefined) {
					this.notificationService.notify({
						severity: Severity.Error,
						message: notebookMoreActionMsg
					});
				}
				else {
					let index = model.cells.findIndex((cell) => cell.id === model.activeCell.id);
					if (index !== undefined && this.isAfter) {
						index += 1;
					}
					model.addCell(this.cellType, index);
				}
			} catch (error) {
				let message = getErrorMessage(error);

				this.notificationService.notify({
					severity: Severity.Error,
					message: message
				});
			}
		});
	}
}

export class DeleteCellAction extends Action {
	constructor(
		id: string, label: string, private cellType: CellType, private isAfter: boolean, private notificationService: INotificationService
	) {
		super(id, label);
	}
	public run(model: NotebookModel): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				if (!model) {
					return;
				}
				if (model.activeCell === undefined) {
					this.notificationService.notify({
						severity: Severity.Error,
						message: notebookMoreActionMsg
					});
				}
				else {
					model.deleteCell(model.activeCell);
				}
			} catch (error) {
				let message = getErrorMessage(error);

				this.notificationService.notify({
					severity: Severity.Error,
					message: message
				});
			}
		});
	}
}