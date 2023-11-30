/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IAngularEventingService, AngularEventType } from 'sql/platform/angularEventing/browser/angularEventingService';
import { IInsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { Task } from 'sql/workbench/services/tasks/browser/tasksRegistry';

import * as azdata from 'azdata';

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { IInsightsConfig } from 'sql/platform/extensions/common/extensions';

export interface BaseActionContext extends azdata.ConnectedContext {
	object?: azdata.ObjectMetadata;
	/**
	 * Override connectionProfile from ConnectedContext
	 * with IConnectionProfile type
	 */
	connectionProfile?: IConnectionProfile | undefined;
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

	override async run(actionContext: ManageActionContext): Promise<void> {
		if (actionContext.connectionProfile) {
			await this._connectionManagementService.connect(actionContext.connectionProfile, actionContext.uri, { showDashboard: true, saveTheConnection: false, showConnectionDialogOnError: false, showFirewallRuleOnError: true });
			this._angularEventingService.sendAngularEvent(actionContext.uri, AngularEventType.NAV_DATABASE);
		}
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

	override async run(actionContext: InsightActionContext): Promise<void> {
		if (actionContext.connectionProfile) {
			await this._insightsDialogService.show(actionContext.insight, actionContext.connectionProfile);
		}
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
