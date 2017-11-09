/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { IConnectionManagementService, MetadataType } from 'sql/parts/connection/common/connectionManagement';
import {
	NewQueryAction, ScriptSelectAction, EditDataAction, ScriptCreateAction,
	BackupAction, BaseActionContext, ManageAction
} from 'sql/workbench/common/actions';
import { IDisasterRecoveryUiService } from 'sql/parts/disasterRecovery/common/interfaces';

import { TPromise } from 'vs/base/common/winjs.base';
import { IAction } from 'vs/base/common/actions';

export function GetExplorerActions(type: MetadataType, isCloud: boolean, dashboardService: DashboardServiceInterface): TPromise<IAction[]> {
	let actions: IAction[] = [];

	// When context menu on database
	if (type === undefined) {
		actions.push(dashboardService.instantiationService.createInstance(DashboardNewQueryAction, DashboardNewQueryAction.ID, NewQueryAction.LABEL, NewQueryAction.ICON));
		if (!isCloud) {
			actions.push(dashboardService.instantiationService.createInstance(DashboardBackupAction, DashboardBackupAction.ID, DashboardBackupAction.LABEL));
		}
		actions.push(dashboardService.instantiationService.createInstance(ManageAction, ManageAction.ID, ManageAction.LABEL));
		return TPromise.as(actions);
	}

	if (type === MetadataType.View || type === MetadataType.Table) {
		actions.push(dashboardService.instantiationService.createInstance(ScriptSelectAction, ScriptSelectAction.ID, ScriptSelectAction.LABEL));
	}

	if (type === MetadataType.Table) {
		actions.push(dashboardService.instantiationService.createInstance(EditDataAction, EditDataAction.ID, EditDataAction.LABEL));
	}

	actions.push(dashboardService.instantiationService.createInstance(ScriptCreateAction, ScriptCreateAction.ID, ScriptCreateAction.LABEL));

	return TPromise.as(actions);
}

export class DashboardBackupAction extends BackupAction {
	public static ID = 'dashboard.' + BackupAction.ID;

	constructor(
		id: string, label: string,
		@IDisasterRecoveryUiService disasterRecoveryService: IDisasterRecoveryUiService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService
	) {
		super(id, label, BackupAction.ICON, disasterRecoveryService, );
	}

	run(actionContext: BaseActionContext): TPromise<boolean> {
		let self = this;
		// change database before performing action
		return new TPromise<boolean>((resolve, reject) => {
			self.connectionManagementService.changeDatabase(actionContext.uri, actionContext.profile.databaseName).then(() => {
				actionContext.connInfo = self.connectionManagementService.getConnectionInfo(actionContext.uri);
				super.run(actionContext).then((result) => {
					resolve(result);
				});
			},
				() => {
					resolve(false);
				});
		});
	}
}

export class DashboardNewQueryAction extends NewQueryAction {
	public static ID = 'dashboard.' + NewQueryAction.ID;

	run(actionContext: BaseActionContext): TPromise<boolean> {
		let self = this;
		// change database before performing action
		return new TPromise<boolean>((resolve, reject) => {
			self._connectionManagementService.changeDatabase(actionContext.uri, actionContext.profile.databaseName).then(() => {
				actionContext.profile = self._connectionManagementService.getConnectionProfile(actionContext.uri);
				super.run(actionContext).then((result) => {
					resolve(result);
				});
			},
				() => {
					resolve(false);
				});
		});
	}
}