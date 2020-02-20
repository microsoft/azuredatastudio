/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import * as azdata from 'azdata';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { JobHistoryComponent } from 'sql/workbench/contrib/jobManagement/browser/jobHistory.component';
import { IJobManagementService } from 'sql/workbench/services/jobManagement/common/interfaces';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { JobsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/jobsView.component';
import { AlertsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/alertsView.component';
import { OperatorsViewComponent } from 'sql/workbench/contrib/jobManagement/browser/operatorsView.component';
import { ProxiesViewComponent } from 'sql/workbench/contrib/jobManagement/browser/proxiesView.component';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { JobManagementView } from 'sql/workbench/contrib/jobManagement/browser/jobManagementView';
import { NotebooksViewComponent } from 'sql/workbench/contrib/jobManagement/browser/notebooksView.component';

export const successLabel: string = nls.localize('jobaction.successLabel', "Success");
export const errorLabel: string = nls.localize('jobaction.faillabel', "Error");

export enum JobActions {
	Run = 'run',
	Stop = 'stop'
}

export class IJobActionInfo {
	ownerUri?: string;
	targetObject?: any;
	component: JobManagementView;
}

// Job actions

export class JobsRefreshAction extends Action {
	public static ID = 'jobaction.refresh';
	public static LABEL = nls.localize('jobaction.refresh', "Refresh");

	constructor(
	) {
		super(JobsRefreshAction.ID, JobsRefreshAction.LABEL, 'refreshIcon');
	}

	public run(context: IJobActionInfo): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			if (context) {
				if (context.component) {
					context.component.refreshJobs();
				}
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

	public run(context: IJobActionInfo): Promise<boolean> {
		let component = context.component as JobsViewComponent;
		return new Promise<boolean>(async (resolve, reject) => {
			try {
				await component.openCreateJobDialog();
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

	public run(context: IJobActionInfo): Promise<boolean> {
		let jobName = context.targetObject.job.name;
		let ownerUri = context.ownerUri;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this.telemetryService.publicLog(TelemetryKeys.RunAgentJob);
		return new Promise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Run).then(async (result) => {
				if (result.success) {
					let startMsg = nls.localize('jobSuccessfullyStarted', ": The job was successfully started.");
					this.notificationService.info(jobName + startMsg);
					await refreshAction.run(context);
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

	public run(context: IJobActionInfo): Promise<boolean> {
		let jobName = context.targetObject.name;
		let ownerUri = context.ownerUri;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this.telemetryService.publicLog(TelemetryKeys.StopAgentJob);
		return new Promise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Stop).then(async (result) => {
				if (result.success) {
					await refreshAction.run(context);
					let stopMsg = nls.localize('jobSuccessfullyStopped', ": The job was successfully stopped.");
					this.notificationService.info(jobName + stopMsg);
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		this._commandService.executeCommand(
			'agent.openJobDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject.job);
		return Promise.resolve(true);
	}
}

export class OpenMaterializedNotebookAction extends Action {
	public static ID = 'notebookAction.openNotebook';
	public static LABEL = nls.localize('notebookAction.openNotebook', "Open");

	constructor() {
		super(OpenMaterializedNotebookAction.ID, OpenMaterializedNotebookAction.LABEL, 'openNotebook');
	}

	public run(context: any): Promise<boolean> {
		context.component.openNotebook(context.history);
		return Promise.resolve(true);
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		let self = this;
		let job = actionInfo.targetObject.job as azdata.AgentJobInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteJobConfirm', "Are you sure you'd like to delete the job '{0}'?", job.name),
			[{
				label: DeleteJobAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentJob);
					self._jobService.deleteJob(actionInfo.ownerUri, actionInfo.targetObject.job).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteJob", "Could not delete job '{0}'.\nError: {1}",
								job.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedJob', "The job was successfully deleted");
							self._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return Promise.resolve(true);
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

	public run(context: JobHistoryComponent): Promise<boolean> {
		let ownerUri = context.ownerUri;
		let server = context.serverName;
		let jobInfo = context.agentJobInfo;
		return new Promise<boolean>((resolve, reject) => {
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		let self = this;
		let step = actionInfo.targetObject as azdata.AgentJobStepInfo;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteStepConfirm', "Are you sure you'd like to delete the step '{0}'?", step.stepName),
			[{
				label: DeleteStepAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentJobStep);
					self._jobService.deleteJobStep(actionInfo.ownerUri, actionInfo.targetObject).then(async (result) => {
						if (!result || !result.success) {
							let errorMessage = nls.localize('jobaction.failedToDeleteStep', "Could not delete step '{0}'.\nError: {1}",
								step.stepName, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
							await refreshAction.run(actionInfo);
						} else {
							let successMessage = nls.localize('jobaction.deletedStep', "The job step was successfully deleted");
							self._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return Promise.resolve(true);
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

	public run(context: IJobActionInfo): Promise<boolean> {
		let component = context.component as AlertsViewComponent;
		return new Promise<boolean>((resolve, reject) => {
			try {
				component.openCreateAlertDialog();
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		this._commandService.executeCommand(
			'agent.openAlertDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject.jobInfo,
			actionInfo.targetObject.alertInfo);
		return Promise.resolve(true);
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		let self = this;
		let alert = actionInfo.targetObject.alertInfo as azdata.AgentAlertInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteAlertConfirm', "Are you sure you'd like to delete the alert '{0}'?", alert.name),
			[{
				label: DeleteAlertAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentAlert);
					self._jobService.deleteAlert(actionInfo.ownerUri, alert).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteAlert", "Could not delete alert '{0}'.\nError: {1}",
								alert.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedAlert', "The alert was successfully deleted");
							self._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return Promise.resolve(true);
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

	public run(context: IJobActionInfo): Promise<boolean> {
		let component = context.component as OperatorsViewComponent;
		return new Promise<boolean>((resolve, reject) => {
			try {
				component.openCreateOperatorDialog();
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		this._commandService.executeCommand(
			'agent.openOperatorDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject);
		return Promise.resolve(true);
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		const self = this;
		let operator = actionInfo.targetObject as azdata.AgentOperatorInfo;
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
							let successMessage = nls.localize('joaction.deletedOperator', "The operator was deleted successfully");
							self._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return Promise.resolve(true);
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

	public run(context: IJobActionInfo): Promise<boolean> {
		let component = context.component as ProxiesViewComponent;
		return new Promise<boolean>((resolve, reject) => {
			try {
				component.openCreateProxyDialog();
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
		@ICommandService private _commandService: ICommandService,
		@IJobManagementService private _jobManagementService: IJobManagementService
	) {
		super(EditProxyAction.ID, EditProxyAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		return Promise.resolve(this._jobManagementService.getCredentials(actionInfo.ownerUri).then((result) => {
			if (result && result.credentials) {
				this._commandService.executeCommand(
					'agent.openProxyDialog',
					actionInfo.ownerUri,
					actionInfo.targetObject,
					result.credentials);
				return true;
			} else {
				return false;
			}
		}));
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

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		let self = this;
		let proxy = actionInfo.targetObject as azdata.AgentProxyInfo;
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
							let successMessage = nls.localize('jobaction.deletedProxy', "The proxy was deleted successfully");
							self._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return Promise.resolve(true);
	}
}

//Notebook Actions

export class NewNotebookJobAction extends Action {
	public static ID = 'notebookaction.newJob';
	public static LABEL = nls.localize('notebookaction.newJob', "New Notebook Job");

	constructor(
	) {
		super(NewNotebookJobAction.ID, NewNotebookJobAction.LABEL, 'newStepIcon');
	}

	public async run(context: IJobActionInfo): Promise<boolean> {
		let component = context.component as NotebooksViewComponent;
		await component.openCreateNotebookDialog();
		return true;
	}
}

export class EditNotebookJobAction extends Action {
	public static ID = 'notebookaction.editNotebook';
	public static LABEL = nls.localize('notebookaction.editJob', "Edit");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(EditNotebookJobAction.ID, EditNotebookJobAction.LABEL, 'edit');
	}

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		this._commandService.executeCommand(
			'agent.openNotebookDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject.job);
		return Promise.resolve(true);
	}
}

export class OpenTemplateNotebookAction extends Action {
	public static ID = 'notebookaction.openTemplate';
	public static LABEL = nls.localize('notebookaction.openNotebook', "Open Template Notebook");

	constructor() {
		super(OpenTemplateNotebookAction.ID, OpenTemplateNotebookAction.LABEL, 'opennotebook');
	}

	public run(actionInfo: any): Promise<boolean> {
		actionInfo.component.openTemplateNotebook();
		return Promise.resolve(true);
	}
}

export class DeleteNotebookAction extends Action {
	public static ID = 'notebookaction.deleteNotebook';
	public static LABEL = nls.localize('notebookaction.deleteNotebook', "Delete");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@IInstantiationService private instantationService: IInstantiationService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
		super(DeleteNotebookAction.ID, DeleteNotebookAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		let self = this;
		let notebook = actionInfo.targetObject.job as azdata.AgentNotebookInfo;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteNotebookConfirm', "Are you sure you'd like to delete the notebook '{0}'?", notebook.name),
			[{
				label: DeleteNotebookAction.LABEL,
				run: () => {
					this._telemetryService.publicLog(TelemetryKeys.DeleteAgentJob);
					self._jobService.deleteNotebook(actionInfo.ownerUri, actionInfo.targetObject.job).then(async (result) => {
						if (!result || !result.success) {
							await refreshAction.run(actionInfo);
							let errorMessage = nls.localize("jobaction.failedToDeleteNotebook", "Could not delete notebook '{0}'.\nError: {1}",
								notebook.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedNotebook', "The notebook was successfully deleted");
							self._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return Promise.resolve(true);
	}

}

export class PinNotebookMaterializedAction extends Action {
	public static ID = 'notebookaction.openTemplate';
	public static LABEL = nls.localize('notebookaction.pinNotebook', "Pin");

	constructor() {
		super(PinNotebookMaterializedAction.ID, PinNotebookMaterializedAction.LABEL);
	}

	public run(actionInfo: any): Promise<boolean> {
		actionInfo.component.toggleNotebookPin(actionInfo.history, true);
		return Promise.resolve(true);
	}
}

export class DeleteMaterializedNotebookAction extends Action {
	public static ID = 'notebookaction.deleteMaterializedNotebook';
	public static LABEL = nls.localize('notebookaction.deleteMaterializedNotebook', "Delete");

	constructor() {
		super(DeleteMaterializedNotebookAction.ID, DeleteMaterializedNotebookAction.LABEL);
	}

	public run(actionInfo: any): Promise<boolean> {
		actionInfo.component.deleteMaterializedNotebook(actionInfo.history);
		return Promise.resolve(true);
	}
}

export class UnpinNotebookMaterializedAction extends Action {
	public static ID = 'notebookaction.unpinNotebook';
	public static LABEL = nls.localize('notebookaction.unpinNotebook', "Unpin");

	constructor() {
		super(UnpinNotebookMaterializedAction.ID, UnpinNotebookMaterializedAction.LABEL);
	}

	public run(actionInfo: any): Promise<boolean> {
		actionInfo.component.toggleNotebookPin(actionInfo.history, false);
		return Promise.resolve(true);
	}
}

export class RenameNotebookMaterializedAction extends Action {
	public static ID = 'notebookaction.openTemplate';
	public static LABEL = nls.localize('notebookaction.renameNotebook', "Rename");

	constructor() {
		super(RenameNotebookMaterializedAction.ID, RenameNotebookMaterializedAction.LABEL);
	}

	public run(actionInfo: any): Promise<boolean> {
		actionInfo.component.renameNotebook(actionInfo.history);
		return Promise.resolve(true);
	}
}

export class OpenLatestRunMaterializedNotebook extends Action {
	public static ID = 'notebookaction.openLatestRun';
	public static LABEL = nls.localize('notebookaction.openLatestRun', "Open Latest Run");

	constructor() {
		super(OpenLatestRunMaterializedNotebook.ID, OpenLatestRunMaterializedNotebook.LABEL);
	}

	public run(actionInfo: IJobActionInfo): Promise<boolean> {
		actionInfo.component.openLastNRun(actionInfo.targetObject.job, 0, 1);
		return Promise.resolve(true);
	}
}
