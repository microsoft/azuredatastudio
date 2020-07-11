/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IAngularEventingService, AngularEventType } from 'sql/platform/angularEventing/browser/angularEventingService';
import { IInsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { Task } from 'sql/workbench/services/tasks/browser/tasksRegistry';

import { ObjectMetadata } from 'azdata';

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { ILogService } from 'vs/platform/log/common/log';

export interface BaseActionContext {
	object?: ObjectMetadata;
	profile?: IConnectionProfile;
}

export interface InsightActionContext extends BaseActionContext {
	insight: IInsightsConfig;
}

export interface ManageActionContext extends BaseActionContext {
	uri: string;
}

export class ManageAction extends Action {
	public static ID = 'manage';
	public static LABEL = nls.localize('manage', "Manage");

	constructor(
		id: string, label: string,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IAngularEventingService protected _angularEventingService: IAngularEventingService
	) {
		super(id, label);
	}

	run(actionContext: ManageActionContext): Promise<boolean> {
		return this._connectionManagementService.connect(actionContext.profile, actionContext.uri, { showDashboard: true, saveTheConnection: false, params: undefined, showConnectionDialogOnError: false, showFirewallRuleOnError: true }).then(
			() => {
				this._angularEventingService.sendAngularEvent(actionContext.uri, AngularEventType.NAV_DATABASE);
				return true;
			}
		);
	}
}

export class InsightAction extends Action {
	public static ID = 'showInsight';
	public static LABEL = nls.localize('showDetails', "Show Details");

	constructor(
		id: string, label: string,
		@IInsightsDialogService protected _insightsDialogService: IInsightsDialogService
	) {
		super(id, label);
	}

	async run(actionContext: InsightActionContext): Promise<void> {
		await this._insightsDialogService.show(actionContext.insight, actionContext.profile);
	}
}

export class ConfigureDashboardAction extends Task {
	public static readonly ID = 'configureDashboard';
	public static readonly LABEL = nls.localize('configureDashboardLearnMore', "Learn More");
	public static readonly ICON = 'info';
	private static readonly configHelpUri = 'https://aka.ms/sqldashboardconfig';

	constructor() {
		super({
			id: ConfigureDashboardAction.ID,
			title: ConfigureDashboardAction.LABEL,
			iconPath: undefined,
			iconClass: ConfigureDashboardAction.ICON
		});
	}

	async runTask(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IOpenerService).open(URI.parse(ConfigureDashboardAction.configHelpUri));
	}
}

export class ClearSavedAccountsAction extends Task {
	public static readonly ID = 'clearSavedAccounts';
	public static readonly LABEL = nls.localize('clearSavedAccounts', "Clear all saved accounts");

	constructor() {
		super({
			id: ClearSavedAccountsAction.ID,
			title: ClearSavedAccountsAction.LABEL,
			iconPath: undefined
		});
	}

	async runTask(accessor: ServicesAccessor): Promise<void> {
		const logService = accessor.get(ILogService);
		try {
			await accessor.get(IAccountManagementService).removeAccounts();
		} catch (ex) {
			logService.error(ex);
		}
	}
}
