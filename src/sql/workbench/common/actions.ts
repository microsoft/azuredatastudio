/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IRestoreDialogController } from 'sql/platform/restore/common/restoreService';
import { IAngularEventingService, AngularEventType } from 'sql/platform/angularEventing/common/angularEventingService';
import { IInsightsDialogService } from 'sql/workbench/services/insights/common/insightsDialogService';
import { IAdminService } from 'sql/workbench/services/admin/common/adminService';
import * as Constants from 'sql/common/constants';
import { Task } from 'sql/platform/tasks/common/tasks';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';

import { ObjectMetadata } from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { IWindowsService } from 'vs/platform/windows/common/windows';
import * as nls from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { INotificationService } from 'vs/platform/notification/common/notification';

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

// --- actions
export class NewQueryAction extends Task {
	public static ID = 'newQuery';
	public static LABEL = nls.localize('newQueryAction.newQuery', 'New Query');
	public static ICON = 'new-query';

	constructor() {
		super({
			id: NewQueryAction.ID,
			title: NewQueryAction.LABEL,
			iconPath: undefined,
			iconClass: NewQueryAction.ICON
		});
	}

	public runTask(accessor: ServicesAccessor, profile: IConnectionProfile): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			TaskUtilities.newQuery(
				profile,
				accessor.get<IConnectionManagementService>(IConnectionManagementService),
				accessor.get<IQueryEditorService>(IQueryEditorService),
				accessor.get<IObjectExplorerService>(IObjectExplorerService),
				accessor.get<IEditorService>(IEditorService)
			).then(
				result => {
					resolve(void 0);
				},
				error => {
					resolve(void 0);
				}
				);
		});
	}
}

export class ScriptSelectAction extends Action {
	public static ID = 'selectTop';
	public static LABEL = nls.localize('scriptSelect', 'Select Top 1000');

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.scriptSelect(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService
			).then(
				result => {
					resolve(true);
				},
				error => {
					resolve(false);
				});
		});
	}
}

export class ScriptExecuteAction extends Action {
	public static ID = 'scriptExecute';
	public static LABEL = nls.localize('scriptExecute', 'Script as Execute');

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				TaskUtilities.ScriptOperation.Execute,
				this._errorMessageService
			).then(
				result => {
					resolve(true);
				},
				error => {
					resolve(false);
				}
				);
		});
	}
}

export class ScriptAlterAction extends Action {
	public static ID = 'scriptAlter';
	public static LABEL = nls.localize('scriptAlter', 'Script as Alter');

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				TaskUtilities.ScriptOperation.Alter,
				this._errorMessageService
			).then(
				result => {
					resolve(true);
				},
				error => {
					resolve(false);
				}
				);
		});
	}
}

export class EditDataAction extends Action {
	public static ID = 'editData';
	public static LABEL = nls.localize('editData', 'Edit Data');

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.scriptEditSelect(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService
			).then(
				result => {
					resolve(true);
				},
				error => {
					resolve(false);
				}
				);
		});
	}
}

export class ScriptCreateAction extends Action {
	public static ID = 'scriptCreate';
	public static LABEL = nls.localize('scriptCreate', "Script as Create");

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				TaskUtilities.ScriptOperation.Create,
				this._errorMessageService
			).then(
				result => {
					resolve(true);
				},
				error => {
					resolve(false);
				}
				);
		});
	}
}

export class ScriptDeleteAction extends Action {
	public static ID = 'scriptDelete';
	public static LABEL = nls.localize('scriptDelete', 'Script as Drop');

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				TaskUtilities.ScriptOperation.Delete,
				this._errorMessageService
			).then(
				result => {
					resolve(true);
				},
				error => {
					resolve(false);
				}
				);
		});
	}
}

export class BackupAction extends Task {
	public static readonly ID = Constants.BackupFeatureName;
	public static readonly LABEL = nls.localize('backupAction.backup', 'Backup');
	public static readonly ICON = Constants.BackupFeatureName;

	constructor() {
		super({
			id: BackupAction.ID,
			title: BackupAction.LABEL,
			iconPath: undefined,
			iconClass: BackupAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor, profile: IConnectionProfile): Promise<void> {
		if (!profile) {
			let objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			let connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
			let workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			profile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService);
		}
		let configurationService = accessor.get<IWorkspaceConfigurationService>(IWorkspaceConfigurationService);
		let previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!previewFeaturesEnabled) {
			return new Promise<void>((resolve, reject) => {
				accessor.get<INotificationService>(INotificationService).info(nls.localize('backup.isPreviewFeature', 'You must enable preview features in order to use backup'));
			});
		}

		return new Promise<void>((resolve, reject) => {
			TaskUtilities.showBackup(
				profile,
				accessor.get<IBackupUiService>(IBackupUiService)
			).then(
				result => {
					resolve(void 0);
				},
				error => {
					resolve(void 0);
				}
				);
		});
	}
}

export class RestoreAction extends Task {
	public static readonly ID = Constants.RestoreFeatureName;
	public static readonly LABEL = nls.localize('restoreAction.restore', 'Restore');
	public static readonly ICON = Constants.RestoreFeatureName;

	constructor() {
		super({
			id: RestoreAction.ID,
			title: RestoreAction.LABEL,
			iconPath: undefined,
			iconClass: RestoreAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor, profile: IConnectionProfile): Promise<void> {
		let configurationService = accessor.get<IWorkspaceConfigurationService>(IWorkspaceConfigurationService);
		let previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!previewFeaturesEnabled) {
			return new Promise<void>((resolve, reject) => {
				accessor.get<INotificationService>(INotificationService).info(nls.localize('restore.isPreviewFeature', 'You must enable preview features in order to use restore'));
			});
		}

		return new Promise<void>((resolve, reject) => {
			TaskUtilities.showRestore(
				profile,
				accessor.get<IRestoreDialogController>(IRestoreDialogController)
			).then(
				result => {
					resolve(void 0);
				},
				error => {
					resolve(void 0);
				}
				);
		});
	}
}

export class ManageAction extends Action {
	public static ID = 'manage';
	public static LABEL = nls.localize('manage', 'Manage');

	constructor(
		id: string, label: string,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IAngularEventingService protected _angularEventingService: IAngularEventingService
	) {
		super(id, label);
	}

	run(actionContext: ManageActionContext): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			self._connectionManagementService.connect(actionContext.profile, actionContext.uri, { showDashboard: true, saveTheConnection: false, params: undefined, showConnectionDialogOnError: false, showFirewallRuleOnError: true }).then(
				() => {
					self._angularEventingService.sendAngularEvent(actionContext.uri, AngularEventType.NAV_DATABASE);
					resolve(true);
				},
				error => {
					resolve(error);
				}
			);
		});
	}
}

export class InsightAction extends Action {
	public static ID = 'showInsight';
	public static LABEL = nls.localize('showDetails', 'Show Details');

	constructor(
		id: string, label: string,
		@IInsightsDialogService protected _insightsDialogService: IInsightsDialogService
	) {
		super(id, label);
	}

	run(actionContext: InsightActionContext): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			self._insightsDialogService.show(actionContext.insight, actionContext.profile);
			resolve(true);
		});
	}
}

export class NewDatabaseAction extends Action {
	public static ID = 'newDatabase';
	public static LABEL = nls.localize('newDatabase', 'New Database');
	public static ICON = 'new-database';

	constructor(
		id: string, label: string, icon: string,
		@IAdminService private _adminService: IAdminService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
	) {
		super(id, label, icon);
	}

	run(actionContext: BaseActionContext): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			TaskUtilities.showCreateDatabase(actionContext.profile, this._adminService, this._errorMessageService);
		});
	}
}

export class ConfigureDashboardAction extends Task {
	public static readonly ID = 'configureDashboard';
	public static readonly LABEL = nls.localize('configureDashboard', 'Learn How To Configure The Dashboard');
	public static readonly ICON = 'configure-dashboard';
	private static readonly configHelpUri = 'https://aka.ms/sqldashboardconfig';

	constructor() {
		super({
			id: ConfigureDashboardAction.ID,
			title: ConfigureDashboardAction.LABEL,
			iconPath: undefined,
			iconClass: ConfigureDashboardAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			accessor.get<IWindowsService>(IWindowsService).openExternal(ConfigureDashboardAction.configHelpUri).then((result) => {
				resolve(void 0);
			}, err => {
				resolve(void 0);
			});
		});
	}
}
