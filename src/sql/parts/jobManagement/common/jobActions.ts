/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import * as sqlops from 'sqlops';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';
import { IJobManagementService } from '../common/interfaces';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConnectionManagementService } from '../../connection/common/connectionManagement';

export enum JobActions {
	Run = 'run',
	Stop = 'stop',
	NewStep = 'newStep'
}

export interface IJobActionInfo {
	ownerUri: string;
	targetObject: any;
}

export class RunJobAction extends Action {
	public static ID = 'jobaction.runJob';
	public static LABEL = nls.localize('jobaction.run', "Run");

	constructor(
		@INotificationService private notificationService: INotificationService,
		@IJobManagementService private jobManagementService: IJobManagementService
	) {
		super(RunJobAction.ID, RunJobAction.LABEL, 'runJobIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let jobName = context.agentJobInfo.name;
		let ownerUri = context.ownerUri;
		return new TPromise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Run).then(result => {
				if (result.success) {
					var startMsg = nls.localize('jobSuccessfullyStarted', ': The job was successfully started.');
					this.notificationService.notify({
						severity: Severity.Info,
						message: jobName+ startMsg
					});
					resolve(true);
				} else {
					this.notificationService.notify({
						severity: Severity.Error,
						message: result.errorMessage
					});
					resolve(false);
				}
			});
		});
	}
}

export class StopJobAction extends Action {
	public static ID = 'jobaction.stopJob';
	public static LABEL = nls.localize('jobaction.stop', "Stop");

	constructor(
		@INotificationService private notificationService: INotificationService,
		@IJobManagementService private jobManagementService: IJobManagementService
	) {
		super(StopJobAction.ID, StopJobAction.LABEL, 'stopJobIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let jobName = context.agentJobInfo.name;
		let ownerUri = context.ownerUri;
		return new TPromise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Stop).then(result => {
				if (result.success) {
						var stopMsg = nls.localize('jobSuccessfullyStopped', ': The job was successfully stopped.');
						this.notificationService.notify({
							severity: Severity.Info,
							message: jobName+ stopMsg
						});
					resolve(true);
				} else {
					this.notificationService.notify({
						severity: Severity.Error,
						message: result.errorMessage
					});
					resolve(false);
				}
			});
		});
	}
}

export class NewStepAction extends Action {
	public static ID = 'jobaction.newStep';
	public static LABEL = nls.localize('jobaction.newStep', "New Step");

	constructor(
		@INotificationService private notificationService: INotificationService,
		@ICommandService private _commandService: ICommandService,
		@IConnectionManagementService private _connectionService
	) {
		super(NewStepAction.ID, NewStepAction.LABEL, 'newStepIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let ownerUri = context.ownerUri;
		let jobName = context.agentJobInfo.name;
		let server = context.serverName;
		let stepId = 0;
		if (context.agentJobHistoryInfo && context.agentJobHistoryInfo.steps) {
			stepId = context.agentJobHistoryInfo.steps.length + 1;
		}
		return new TPromise<boolean>((resolve, reject) => {
			resolve(this._commandService.executeCommand('agent.openNewStepDialog', ownerUri, jobName, server, stepId));
		});
	}
}

export class EditJobAction extends Action {
	public static ID = 'jobaction.editJob';
	public static LABEL = nls.localize('jobaction.editJob', "Edit Job");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteJobAction extends Action {
	public static ID = 'jobaction.deleteJob';
	public static LABEL = nls.localize('jobaction.deleteJob', "Delete Job");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class EditAlertAction extends Action {
	public static ID = 'jobaction.editAlert';
	public static LABEL = nls.localize('jobaction.editAlert', "Edit Alert");

	constructor() {
		super(EditAlertAction.ID, EditAlertAction.LABEL);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteAlertAction extends Action {
	public static ID = 'jobaction.deleteAlert';
	public static LABEL = nls.localize('jobaction.deleteAlert', "Delete Alert");
	public static CancelLabel = nls.localize('jobaction.Cancel', "Cancel");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IJobManagementService private _jobService: IJobManagementService
	) {
		super(DeleteAlertAction.ID, DeleteAlertAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let alert = actionInfo.targetObject as sqlops.AgentAlertInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteAlertConfirm,', "Are you sure you'd like to delete the alert '{0}'?", alert.name),
			[{
				label: DeleteAlertAction.LABEL,
				run: () => {
					self._jobService.deleteAlert(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteAlert", "Could not delete alert '{0}'.\nError: {1}",
								alert.name, result.errorMessage ? result.errorMessage : 'Unknown error');
								self._notificationService.error(errorMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return TPromise.as(true);
	}
}

export class EditOperatorAction extends Action {
	public static ID = 'jobaction.editAlert';
	public static LABEL = nls.localize('jobaction.editOperator', "Edit Operator");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteOperatorAction extends Action {
	public static ID = 'jobaction.deleteOperator';
	public static LABEL = nls.localize('jobaction.deleteOperator', "Delete Operator");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}


export class EditProxyAction extends Action {
	public static ID = 'jobaction.editProxy';
	public static LABEL = nls.localize('jobaction.editProxy', "Edit Proxy");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteProxyAction extends Action {
	public static ID = 'jobaction.deleteOperator';
	public static LABEL = nls.localize('jobaction.deleteProxy', "Delete Proxy");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}