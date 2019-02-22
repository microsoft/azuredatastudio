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
import { JobsViewComponent } from 'sql/parts/jobManagement/views/jobsView.component';
import { AlertsViewComponent } from 'sql/parts/jobManagement/views/alertsView.component';
import { OperatorsViewComponent } from 'sql/parts/jobManagement/views/operatorsView.component';
import { ProxiesViewComponent } from 'sql/parts/jobManagement/views/proxiesView.component';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export const successLabel: string = nls.localize('jobaction.successLabel', 'Success');
export const errorLabel: string = nls.localize('jobaction.faillabel', 'Error');

export enum JobActions {
	Run = 'run',
	Stop = 'stop'
}

export class IJobActionInfo {
	ownerUri: string;
	targetObject: any;
	jobHistoryComponent?: JobHistoryComponent;
	jobViewComponent?: JobsViewComponent;
}

// Job actions

export class JobsRefreshAction extends Action {
	public static ID = 'jobaction.refresh';
	public static LABEL = nls.localize('jobaction.refresh', "Refresh");

	constructor(
	) {
		super(JobsRefreshAction.ID, JobsRefreshAction.LABEL, 'refreshIcon');
	}

	public run(context: IJobActionInfo): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			if (context) {
				context.jobHistoryComponent.refreshJobs();
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class NewJobAction extends Action {
	public static ID = 'jobaction.newJob';
	public static LABEL = nls.localize('jobaction.newJob', "New Job");

	constructor(
	) {
		super(NewJobAction.ID, NewJobAction.LABEL, 'newStepIcon');
	}

	public run(context: JobsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateJobDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class RunJobAction extends Action {
	public static ID = 'jobaction.runJob';
	public static LABEL = nls.localize('jobaction.run', "Run");

	constructor(
		@INotificationService private notificationService: INotificationService,
		@IErrorMessageService private errorMessageService: IErrorMessageService,
		@IJobManagementService private jobManagementService: IJobManagementService,
		@IInstantiationService private instantationService: IInstantiationService,
		@ITelemetryService private telemetryService: ITelemetryService
	) {
		super(RunJobAction.ID, RunJobAction.LABEL, 'start');
	}

	public run(context: IJobActionInfo): TPromise<boolean> {
		let jobName = context.targetObject.name;
		let ownerUri = context.ownerUri;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this.telemetryService.publicLog(TelemetryKeys.RunAgentJob);
		return new TPromise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Run).then(result => {
				if (result.success) {
					var startMsg = nls.localize('jobSuccessfullyStarted', ': The job was successfully started.');
					this.notificationService.info(jobName+startMsg);
					refreshAction.run(context);
					resolve(true);
				} else {
					this.errorMessageService.showDialog(Severity.Error, errorLabel, result.errorMessage);
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
		@IErrorMessageService private errorMessageService: IErrorMessageService,
		@IJobManagementService private jobManagementService: IJobManagementService,
		@IInstantiationService private instantationService: IInstantiationService,
		@ITelemetryService private telemetryService: ITelemetryService
	) {
		super(StopJobAction.ID, StopJobAction.LABEL, 'stop');
	}

	public run(context: IJobActionInfo): TPromise<boolean> {
		let jobName = context.targetObject.name;
		let ownerUri = context.ownerUri;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this.telemetryService.publicLog(TelemetryKeys.StopAgentJob);
		return new TPromise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Stop).then(result => {
				if (result.success) {
					refreshAction.run(context);
					var stopMsg = nls.localize('jobSuccessfullyStopped', ': The job was successfully stopped.');
					this.notificationService.info(jobName+stopMsg);
					resolve(true);
				} else {
					this.errorMessageService.showDialog(Severity.Error, 'Error', result.errorMessage);
					resolve(false);
				}
			});
		});
	}
}

export class EditJobAction extends Action {
	public static ID = 'jobaction.editJob';
	public static LABEL = nls.localize('jobaction.editJob', "Edit Job");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(EditJobAction.ID, EditJobAction.LABEL, 'edit');
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		this._commandService.executeCommand(
			'agent.openJobDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject);
		return TPromise.as(true);
	}
}

export class DeleteJobAction extends Action {
	public static ID = 'jobaction.deleteJob';
	public static LABEL = nls.localize('jobaction.deleteJob', "Delete Job");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		super(DeleteJobAction.ID, DeleteJobAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let job = actionInfo.targetObject as sqlops.AgentJobInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteJobConfirm', "Are you sure you'd like to delete the job '{0}'?", job.name),
			[{
				label: DeleteJobAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentJob);
					self._jobService.deleteJob(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteJob", "Could not delete job '{0}'.\nError: {1}",
								job.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedJob', 'The job was successfully deleted');
							self._notificationService.info(successMessage);
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

// Step Actions

export class NewStepAction extends Action {
	public static ID = 'jobaction.newStep';
	public static LABEL = nls.localize('jobaction.newStep', "New Step");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(NewStepAction.ID, NewStepAction.LABEL, 'newStepIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let ownerUri = context.ownerUri;
		let server = context.serverName;
		let jobInfo = context.agentJobInfo;
		return new TPromise<boolean>((resolve, reject) => {
			resolve(this._commandService.executeCommand('agent.openNewStepDialog', ownerUri, server, jobInfo, null));
		});
	}
}

export class DeleteStepAction extends Action {
	public static ID = 'jobaction.deleteStep';
	public static LABEL = nls.localize('jobaction.deleteStep', "Delete Step");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@IInstantiationService private instantationService: IInstantiationService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		super(DeleteStepAction.ID, DeleteStepAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let step = actionInfo.targetObject as sqlops.AgentJobStepInfo;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteStepConfirm', "Are you sure you'd like to delete the step '{0}'?", step.stepName),
			[{
				label: DeleteStepAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentJobStep);
					self._jobService.deleteJobStep(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize('jobaction.failedToDeleteStep', "Could not delete step '{0}'.\nError: {1}",
								step.stepName, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
							refreshAction.run(actionInfo);
						} else {
							let successMessage = nls.localize('jobaction.deletedStep', 'The job step was successfully deleted');
							self._notificationService.info(successMessage);
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


// Alert Actions

export class NewAlertAction extends Action {
	public static ID = 'jobaction.newAlert';
	public static LABEL = nls.localize('jobaction.newAlert', "New Alert");

	constructor(
	) {
		super(NewAlertAction.ID, NewAlertAction.LABEL, 'newStepIcon');
	}

	public run(context: AlertsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateAlertDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class EditAlertAction extends Action {
	public static ID = 'jobaction.editAlert';
	public static LABEL = nls.localize('jobaction.editAlert', "Edit Alert");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(EditAlertAction.ID, EditAlertAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		this._commandService.executeCommand(
			'agent.openAlertDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject);
		return TPromise.as(true);
	}
}

export class DeleteAlertAction extends Action {
	public static ID = 'jobaction.deleteAlert';
	public static LABEL = nls.localize('jobaction.deleteAlert', "Delete Alert");
	public static CancelLabel = nls.localize('jobaction.Cancel', "Cancel");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		super(DeleteAlertAction.ID, DeleteAlertAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let alert = actionInfo.targetObject as sqlops.AgentAlertInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteAlertConfirm', "Are you sure you'd like to delete the alert '{0}'?", alert.name),
			[{
				label: DeleteAlertAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentAlert);
					self._jobService.deleteAlert(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteAlert", "Could not delete alert '{0}'.\nError: {1}",
								alert.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedAlert', 'The alert was successfully deleted');
							self._notificationService.info(successMessage);
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

// Operator Actions

export class NewOperatorAction extends Action {
	public static ID = 'jobaction.newOperator';
	public static LABEL = nls.localize('jobaction.newOperator', "New Operator");

	constructor(
	) {
		super(NewOperatorAction.ID, NewOperatorAction.LABEL, 'newStepIcon');
	}

	public run(context: OperatorsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateOperatorDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class EditOperatorAction extends Action {
	public static ID = 'jobaction.editAlert';
	public static LABEL = nls.localize('jobaction.editOperator', "Edit Operator");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(EditOperatorAction.ID, EditOperatorAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		this._commandService.executeCommand(
			'agent.openOperatorDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject);
		return TPromise.as(true);
	}
}

export class DeleteOperatorAction extends Action {
	public static ID = 'jobaction.deleteOperator';
	public static LABEL = nls.localize('jobaction.deleteOperator', "Delete Operator");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		super(DeleteOperatorAction.ID, DeleteOperatorAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		const self = this;
		let operator = actionInfo.targetObject as sqlops.AgentOperatorInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteOperatorConfirm', "Are you sure you'd like to delete the operator '{0}'?", operator.name),
			[{
				label: DeleteOperatorAction.LABEL,
				run: () => {
					self._telemetryService.publicLog(TelemetryKeys.DeleteAgentOperator);
					self._jobService.deleteOperator(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteOperator", "Could not delete operator '{0}'.\nError: {1}",
								operator.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('joaction.deletedOperator', 'The operator was deleted successfully');
							self._notificationService.info(successMessage);
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


// Proxy Actions

export class NewProxyAction extends Action {
	public static ID = 'jobaction.newProxy';
	public static LABEL = nls.localize('jobaction.newProxy', "New Proxy");

	constructor(
	) {
		super(NewProxyAction.ID, NewProxyAction.LABEL, 'newStepIcon');
	}

	public run(context: ProxiesViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateProxyDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class EditProxyAction extends Action {
	public static ID = 'jobaction.editProxy';
	public static LABEL = nls.localize('jobaction.editProxy', "Edit Proxy");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(EditProxyAction.ID, EditProxyAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		this._commandService.executeCommand(
			'agent.openProxyDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject);
		return TPromise.as(true);
	}
}

export class DeleteProxyAction extends Action {
	public static ID = 'jobaction.deleteProxy';
	public static LABEL = nls.localize('jobaction.deleteProxy', "Delete Proxy");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		super(DeleteProxyAction.ID, DeleteProxyAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let proxy = actionInfo.targetObject as sqlops.AgentProxyInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteProxyConfirm', "Are you sure you'd like to delete the proxy '{0}'?", proxy.accountName),
			[{
				label: DeleteProxyAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentProxy);
					self._jobService.deleteProxy(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteProxy", "Could not delete proxy '{0}'.\nError: {1}",
								proxy.accountName, result.errorMessage ? result.errorMessage : 'Unknown error');
								self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedProxy', 'The proxy was deleted successfully');
							self._notificationService.info(successMessage);
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