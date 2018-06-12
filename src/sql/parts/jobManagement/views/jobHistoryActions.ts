/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { BaseActionContext } from '../../../workbench/common/actions';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';
import { JobManagementService } from '../common/jobManagementService';
import { IJobManagementService } from '../common/interfaces';

export enum JobHistoryActions {
	Run = 'run',
	Stop = 'stop',
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
			this.jobManagementService.jobAction(ownerUri, jobName, JobHistoryActions.Run).then(result => {
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
			this.jobManagementService.jobAction(ownerUri, jobName, JobHistoryActions.Stop).then(result => {
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