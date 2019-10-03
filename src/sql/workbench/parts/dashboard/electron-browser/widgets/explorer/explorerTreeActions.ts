/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ScriptSelectAction, ScriptCreateAction, ScriptAlterAction, ScriptExecuteAction } from 'sql/workbench/electron-browser/scriptingActions';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IEditorProgressService, IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { BaseActionContext } from 'sql/workbench/browser/actions';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class ExplorerScriptSelectAction extends ScriptSelectAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IProgressService private readonly progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return this.progressService.withProgress({ location: ProgressLocation.Window }, () => super.run(actionContext));
	}
}

export class ExplorerScriptCreateAction extends ScriptCreateAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IErrorMessageService errorMessageService: IErrorMessageService,
		@IProgressService private readonly progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService, errorMessageService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return this.progressService.withProgress({ location: ProgressLocation.Window }, () => super.run(actionContext));
	}
}

export class ExplorerScriptAlterAction extends ScriptAlterAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IErrorMessageService errorMessageService: IErrorMessageService,
		@IProgressService private readonly progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService, errorMessageService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return this.progressService.withProgress({ location: ProgressLocation.Window }, () => super.run(actionContext));
	}
}

export class ExplorerScriptExecuteAction extends ScriptExecuteAction {
	constructor(
		id: string, label: string,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IScriptingService scriptingService: IScriptingService,
		@IErrorMessageService errorMessageService: IErrorMessageService,
		@IProgressService private readonly progressService: IProgressService
	) {
		super(id, label, queryEditorService, connectionManagementService, scriptingService, errorMessageService);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return this.progressService.withProgress({ location: ProgressLocation.Window }, () => super.run(actionContext));
	}
}
