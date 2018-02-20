/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IErrorMessageService } from 'sql/parts/connection/common/connectionManagement';
import * as TaskUtilities from './taskUtilities';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { IScriptingService } from 'sql/services/scripting/scriptingService';
import { IRestoreDialogController } from 'sql/parts/disasterRecovery/restore/common/restoreService';
import { IBackupUiService } from 'sql/parts/disasterRecovery/backup/common/backupService';
import { IAngularEventingService, AngularEventType } from 'sql/services/angularEventing/angularEventingService';
import { IInsightsDialogService } from 'sql/parts/insights/common/interfaces';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import * as Constants from 'sql/common/constants';
import { ObjectMetadata } from 'sqlops';
import { ScriptOperation } from 'sql/workbench/common/taskUtilities';
import { TaskAction } from 'sql/platform/tasks/taskRegistry';

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { IWindowsService } from 'vs/platform/windows/common/windows';

import * as nls from 'vs/nls';
import { IObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';

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
export class NewQueryAction extends TaskAction {
	public static ID = 'newQuery';
	public static LABEL = nls.localize('newQuery', 'New Query');
	public static ICON = 'new-query';

	constructor(
		id: string, label: string, icon: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService protected _objectExplorerService: IObjectExplorerService,
		@IWorkbenchEditorService protected _workbenchEditorService: IWorkbenchEditorService
	) {
		super(id, label, icon);
	}

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.newQuery(
				actionContext.profile,
				this._connectionManagementService,
				this._queryEditorService,
				this._objectExplorerService,
				this._workbenchEditorService
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

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
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

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				ScriptOperation.Execute,
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

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				ScriptOperation.Alter,
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
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.editData(
				actionContext.profile,
				actionContext.object.name,
				actionContext.object.schema,
				this._connectionManagementService,
				this._queryEditorService
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

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				ScriptOperation.Create,
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
	public static LABEL = nls.localize('scriptDelete', 'Script as Delete');

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService,
		@IErrorMessageService protected _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.script(
				actionContext.profile,
				actionContext.object,
				this._connectionManagementService,
				this._queryEditorService,
				this._scriptingService,
				ScriptOperation.Delete,
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

export class BackupAction extends TaskAction {
	public static ID = Constants.BackupFeatureName;
	public static LABEL = nls.localize('backup', 'Backup');
	public static ICON = Constants.BackupFeatureName;

	constructor(
		id: string, label: string, icon: string,
		@IBackupUiService protected _backupUiService: IBackupUiService
	) {
		super(id, label, icon);
	}

	run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.showBackup(
				actionContext.profile,
				this._backupUiService,
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

export class RestoreAction extends TaskAction {
	public static ID = Constants.RestoreFeatureName;
	public static LABEL = nls.localize('restore', 'Restore');
	public static ICON = Constants.RestoreFeatureName;

	constructor(
		id: string, label: string, icon: string,
		@IRestoreDialogController protected _restoreService: IRestoreDialogController
	) {
		super(id, label, icon);
	}

	run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.showRestore(
				actionContext.profile,
				this._restoreService
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

	run(actionContext: ManageActionContext): TPromise<boolean> {
		let self = this;
		return new TPromise<boolean>((resolve, reject) => {
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

	run(actionContext: InsightActionContext): TPromise<boolean> {
		let self = this;
		return new TPromise<boolean>((resolve, reject) => {
			self._insightsDialogService.show(actionContext.insight, actionContext.profile);
			resolve(true);
		});
	}
}

export class NewDatabaseAction extends TaskAction {
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

	run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.showCreateDatabase(actionContext.profile, this._adminService, this._errorMessageService);
		});
	}
}

export class ConfigureDashboardAction extends TaskAction {
	public static ID = 'configureDashboard';
	public static LABEL = nls.localize('configureDashboard', 'Configure');
	public static ICON = 'configure-dashboard';
	private static readonly configHelpUri = 'https://aka.ms/sqldashboardconfig';
	constructor(
		id: string, label: string, icon: string,
		@IWindowsService private _windowsService
	) {
		super(id, label, icon);
	}

	run(actionContext: BaseActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			this._windowsService.openExternal(ConfigureDashboardAction.configHelpUri).then((result) => {
				resolve(result);
			}, err => {
				resolve(err);
			});
		});
	}
}
