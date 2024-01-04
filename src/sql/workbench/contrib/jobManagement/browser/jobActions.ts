/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { TelemetryView, TelemetryAction } from 'sql/platform/telemetry/common/telemetryKeys';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { JobManagementView } from 'sql/workbench/contrib/jobManagement/browser/jobManagementView';
import { NotebooksViewComponent } from 'sql/workbench/contrib/jobManagement/browser/notebooksView.component';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

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

	public override async run(context?: IJobActionInfo): Promise<void> {
		context?.component?.refreshJobs();
	}
}

export class NewJobAction extends Action {
	public static ID = 'jobaction.newJob';
	public static LABEL = nls.localize('jobaction.newJob', "New Job");

	constructor(
	) {
		super(NewJobAction.ID, NewJobAction.LABEL, 'newStepIcon');
	}

	public override async run(context: IJobActionInfo): Promise<void> {
		const component = context.component as JobsViewComponent;
		await component.openCreateJobDialog();
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
		@IAdsTelemetryService private telemetryService: IAdsTelemetryService
	) {
		super(RunJobAction.ID, RunJobAction.LABEL, 'start');
	}

	public override async run(context: IJobActionInfo): Promise<void> {
		let jobName = context.targetObject.job.name;
		let ownerUri = context.ownerUri;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this.telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.RunAgentJob);
		const result = await this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Run);
		if (result.success) {
			let startMsg = nls.localize('jobSuccessfullyStarted', ": The job was successfully started.");
			this.notificationService.info(jobName + startMsg);
			await refreshAction.run(context);
		} else {
			this.errorMessageService.showDialog(Severity.Error, errorLabel, result.errorMessage);
		}
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
		@IAdsTelemetryService private telemetryService: IAdsTelemetryService
	) {
		super(StopJobAction.ID, StopJobAction.LABEL, 'stop');
	}

	public override async run(context: IJobActionInfo): Promise<void> {
		let jobName = context.targetObject.name;
		let ownerUri = context.ownerUri;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this.telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.StopAgentJob);
		const result = await this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Stop);
		if (result.success) {
			await refreshAction.run(context);
			let stopMsg = nls.localize('jobSuccessfullyStopped', ": The job was successfully stopped.");
			this.notificationService.info(jobName + stopMsg);
		} else {
			this.errorMessageService.showDialog(Severity.Error, 'Error', result.errorMessage);
		}
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

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		await this._commandService.executeCommand(
			'agent.openJobDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject.job);
	}
}

export class OpenMaterializedNotebookAction extends Action {
	public static ID = 'notebookAction.openNotebook';
	public static LABEL = nls.localize('notebookAction.openNotebook', "Open");

	constructor() {
		super(OpenMaterializedNotebookAction.ID, OpenMaterializedNotebookAction.LABEL, 'openNotebook');
	}

	public override async run(context: any): Promise<void> {
		context.component.openNotebook(context.history);
	}
}

export class DeleteJobAction extends Action {
	public static ID = 'jobaction.deleteJob';
	public static LABEL = nls.localize('jobaction.deleteJob', "Delete Job");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(DeleteJobAction.ID, DeleteJobAction.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		let job = actionInfo.targetObject.job as azdata.AgentJobInfo;
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteJobConfirm', "Are you sure you'd like to delete the job '{0}'?", job.name),
			[{
				label: DeleteJobAction.LABEL,
				run: () => {
					this._telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.DeleteAgentJob);
					this._jobService.deleteJob(actionInfo.ownerUri, actionInfo.targetObject.job).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteJob", "Could not delete job '{0}'.\nError: {1}",
								job.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							this._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
						} else {
							let successMessage = nls.localize('jobaction.deletedJob', "The job was successfully deleted");
							this._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
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

	public override async run(context: JobHistoryComponent): Promise<void> {
		let ownerUri = context.ownerUri;
		let server = context.serverName;
		let jobInfo = context.agentJobInfo;
		await this._commandService.executeCommand('agent.openNewStepDialog', ownerUri, server, jobInfo, undefined);
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
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(DeleteStepAction.ID, DeleteStepAction.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		let step = actionInfo.targetObject as azdata.AgentJobStepInfo;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteStepConfirm', "Are you sure you'd like to delete the step '{0}'?", step.stepName),
			[{
				label: DeleteStepAction.LABEL,
				run: () => {
					this._telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.DeleteAgentJobStep);
					this._jobService.deleteJobStep(actionInfo.ownerUri, actionInfo.targetObject).then(async (result) => {
						if (!result || !result.success) {
							let errorMessage = nls.localize('jobaction.failedToDeleteStep', "Could not delete step '{0}'.\nError: {1}",
								step.stepName, result.errorMessage ? result.errorMessage : 'Unknown error');
							this._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
							await refreshAction.run(actionInfo);
						} else {
							let successMessage = nls.localize('jobaction.deletedStep', "The job step was successfully deleted");
							this._notificationService.info(successMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
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

	public override async run(context: IJobActionInfo): Promise<void> {
		let component = context.component as AlertsViewComponent;
		await component.openCreateAlertDialog();
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

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		await this._commandService.executeCommand(
			'agent.openAlertDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject.jobInfo,
			actionInfo.targetObject.alertInfo);
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
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(DeleteAlertAction.ID, DeleteAlertAction.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		let alert = actionInfo.targetObject.alertInfo as azdata.AgentAlertInfo;
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteAlertConfirm', "Are you sure you'd like to delete the alert '{0}'?", alert.name),
			[{
				label: DeleteAlertAction.LABEL,
				run: async () => {
					this._telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.DeleteAgentAlert);
					const result = await this._jobService.deleteAlert(actionInfo.ownerUri, alert);
					if (!result || !result.success) {
						let errorMessage = nls.localize("jobaction.failedToDeleteAlert", "Could not delete alert '{0}'.\nError: {1}",
							alert.name, result.errorMessage ? result.errorMessage : 'Unknown error');
						this._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
					} else {
						let successMessage = nls.localize('jobaction.deletedAlert', "The alert was successfully deleted");
						this._notificationService.info(successMessage);
					}
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
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

	public override async run(context: IJobActionInfo): Promise<void> {
		let component = context.component as OperatorsViewComponent;
		await component.openCreateOperatorDialog();
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

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		await this._commandService.executeCommand(
			'agent.openOperatorDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject);
	}
}

export class DeleteOperatorAction extends Action {
	public static ID = 'jobaction.deleteOperator';
	public static LABEL = nls.localize('jobaction.deleteOperator', "Delete Operator");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(DeleteOperatorAction.ID, DeleteOperatorAction.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		let operator = actionInfo.targetObject as azdata.AgentOperatorInfo;
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteOperatorConfirm', "Are you sure you'd like to delete the operator '{0}'?", operator.name),
			[{
				label: DeleteOperatorAction.LABEL,
				run: async () => {
					this._telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.DeleteAgentOperator);
					const result = await this._jobService.deleteOperator(actionInfo.ownerUri, actionInfo.targetObject);
					if (!result || !result.success) {
						let errorMessage = nls.localize("jobaction.failedToDeleteOperator", "Could not delete operator '{0}'.\nError: {1}",
							operator.name, result.errorMessage ? result.errorMessage : 'Unknown error');
						this._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
					} else {
						let successMessage = nls.localize('joaction.deletedOperator', "The operator was deleted successfully");
						this._notificationService.info(successMessage);
					}
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
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

	public override async run(context: IJobActionInfo): Promise<void> {
		const component = context.component as ProxiesViewComponent;
		component.openCreateProxyDialog();
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

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		const result = await this._jobManagementService.getCredentials(actionInfo.ownerUri);
		if (result && result.credentials) {
			await this._commandService.executeCommand(
				'agent.openProxyDialog',
				actionInfo.ownerUri,
				actionInfo.targetObject,
				result.credentials);
		}
	}
}

export class DeleteProxyAction extends Action {
	public static ID = 'jobaction.deleteProxy';
	public static LABEL = nls.localize('jobaction.deleteProxy', "Delete Proxy");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IJobManagementService private _jobService: IJobManagementService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(DeleteProxyAction.ID, DeleteProxyAction.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		let proxy = actionInfo.targetObject as azdata.AgentProxyInfo;
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteProxyConfirm', "Are you sure you'd like to delete the proxy '{0}'?", proxy.accountName),
			[{
				label: DeleteProxyAction.LABEL,
				run: async () => {
					this._telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.DeleteAgentProxy);
					const result = await this._jobService.deleteProxy(actionInfo.ownerUri, actionInfo.targetObject);
					if (!result || !result.success) {
						let errorMessage = nls.localize("jobaction.failedToDeleteProxy", "Could not delete proxy '{0}'.\nError: {1}",
							proxy.accountName, result.errorMessage ? result.errorMessage : 'Unknown error');
						this._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
					} else {
						let successMessage = nls.localize('jobaction.deletedProxy', "The proxy was deleted successfully");
						this._notificationService.info(successMessage);
					}
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
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

	public override async run(context: IJobActionInfo): Promise<void> {
		let component = context.component as NotebooksViewComponent;
		await component.openCreateNotebookDialog();
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

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		await this._commandService.executeCommand(
			'agent.openNotebookDialog',
			actionInfo.ownerUri,
			actionInfo.targetObject.job);
	}
}

export class OpenTemplateNotebookAction extends Action {
	public static ID = 'notebookaction.openTemplate';
	public static LABEL = nls.localize('notebookaction.openNotebook', "Open Template Notebook");

	constructor() {
		super(OpenTemplateNotebookAction.ID, OpenTemplateNotebookAction.LABEL, 'opennotebook');
	}

	public override async run(actionInfo: any): Promise<void> {
		actionInfo.component.openTemplateNotebook();
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
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(DeleteNotebookAction.ID, DeleteNotebookAction.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		let notebook = actionInfo.targetObject.job as azdata.AgentNotebookInfo;
		let refreshAction = this.instantationService.createInstance(JobsRefreshAction);
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteNotebookConfirm', "Are you sure you'd like to delete the notebook '{0}'?", notebook.name),
			[{
				label: DeleteNotebookAction.LABEL,
				run: async () => {
					this._telemetryService.sendActionEvent(TelemetryView.Agent, TelemetryAction.DeleteAgentJob);
					const result = await this._jobService.deleteNotebook(actionInfo.ownerUri, actionInfo.targetObject.job);
					if (!result || !result.success) {
						await refreshAction.run(actionInfo);
						let errorMessage = nls.localize("jobaction.failedToDeleteNotebook", "Could not delete notebook '{0}'.\nError: {1}",
							notebook.name, result.errorMessage ? result.errorMessage : 'Unknown error');
						this._errorMessageService.showDialog(Severity.Error, errorLabel, errorMessage);
					} else {
						let successMessage = nls.localize('jobaction.deletedNotebook', "The notebook was successfully deleted");
						this._notificationService.info(successMessage);
					}
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
	}

}

export class PinNotebookMaterializedAction extends Action {
	public static ID = 'notebookaction.openTemplate';
	public static LABEL = nls.localize('notebookaction.pinNotebook', "Pin");

	constructor() {
		super(PinNotebookMaterializedAction.ID, PinNotebookMaterializedAction.LABEL);
	}

	public override async run(actionInfo: any): Promise<void> {
		actionInfo.component.toggleNotebookPin(actionInfo.history, true);
	}
}

export class DeleteMaterializedNotebookAction extends Action {
	public static ID = 'notebookaction.deleteMaterializedNotebook';
	public static LABEL = nls.localize('notebookaction.deleteMaterializedNotebook', "Delete");

	constructor() {
		super(DeleteMaterializedNotebookAction.ID, DeleteMaterializedNotebookAction.LABEL);
	}

	public override async run(actionInfo: any): Promise<void> {
		actionInfo.component.deleteMaterializedNotebook(actionInfo.history);
	}
}

export class UnpinNotebookMaterializedAction extends Action {
	public static ID = 'notebookaction.unpinNotebook';
	public static LABEL = nls.localize('notebookaction.unpinNotebook', "Unpin");

	constructor() {
		super(UnpinNotebookMaterializedAction.ID, UnpinNotebookMaterializedAction.LABEL);
	}

	public override async run(actionInfo: any): Promise<void> {
		actionInfo.component.toggleNotebookPin(actionInfo.history, false);
	}
}

export class RenameNotebookMaterializedAction extends Action {
	public static ID = 'notebookaction.openTemplate';
	public static LABEL = nls.localize('notebookaction.renameNotebook', "Rename");

	constructor() {
		super(RenameNotebookMaterializedAction.ID, RenameNotebookMaterializedAction.LABEL);
	}

	public override async run(actionInfo: any): Promise<void> {
		actionInfo.component.renameNotebook(actionInfo.history);
	}
}

export class OpenLatestRunMaterializedNotebook extends Action {
	public static ID = 'notebookaction.openLatestRun';
	public static LABEL = nls.localize('notebookaction.openLatestRun', "Open Latest Run");

	constructor() {
		super(OpenLatestRunMaterializedNotebook.ID, OpenLatestRunMaterializedNotebook.LABEL);
	}

	public override async run(actionInfo: IJobActionInfo): Promise<void> {
		actionInfo.component.openLastNRun(actionInfo.targetObject.job, 0, 1);
	}
}
