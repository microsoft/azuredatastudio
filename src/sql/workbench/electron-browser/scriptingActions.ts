/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IScriptingService, ScriptOperation } from 'sql/platform/scripting/common/scriptingService';
import { BaseActionContext } from 'sql/workbench/browser/actions';
import { scriptSelect, script, scriptEditSelect } from 'sql/workbench/electron-browser/scriptingUtils';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class ScriptSelectAction extends Action {
	public static ID = 'selectTop';
	public static LABEL = nls.localize('scriptSelect', "Select Top 1000");

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return scriptSelect(
			actionContext.profile,
			actionContext.object,
			this._connectionManagementService,
			this._queryEditorService,
			this._scriptingService
		).then(() => true);
	}
}

export class ScriptExecuteAction extends Action {
	public static ID = 'scriptExecute';
	public static LABEL = nls.localize('scriptExecute', "Script as Execute");

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
		return script(
			actionContext.profile,
			actionContext.object,
			this._connectionManagementService,
			this._queryEditorService,
			this._scriptingService,
			ScriptOperation.Execute,
			this._errorMessageService
		).then(() => true);
	}
}

export class ScriptAlterAction extends Action {
	public static ID = 'scriptAlter';
	public static LABEL = nls.localize('scriptAlter', "Script as Alter");

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
		return script(
			actionContext.profile,
			actionContext.object,
			this._connectionManagementService,
			this._queryEditorService,
			this._scriptingService,
			ScriptOperation.Alter,
			this._errorMessageService
		).then(() => true);
	}
}

export class EditDataAction extends Action {
	public static ID = 'editData';
	public static LABEL = nls.localize('editData', "Edit Data");

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IScriptingService protected _scriptingService: IScriptingService
	) {
		super(id, label);
	}

	public run(actionContext: BaseActionContext): Promise<boolean> {
		return scriptEditSelect(
			actionContext.profile,
			actionContext.object,
			this._connectionManagementService,
			this._queryEditorService,
			this._scriptingService
		).then(() => true);
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
		return script(
			actionContext.profile,
			actionContext.object,
			this._connectionManagementService,
			this._queryEditorService,
			this._scriptingService,
			ScriptOperation.Create,
			this._errorMessageService
		).then(() => true);
	}
}

export class ScriptDeleteAction extends Action {
	public static ID = 'scriptDelete';
	public static LABEL = nls.localize('scriptDelete', "Script as Drop");

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
		return script(
			actionContext.profile,
			actionContext.object,
			this._connectionManagementService,
			this._queryEditorService,
			this._scriptingService,
			ScriptOperation.Delete,
			this._errorMessageService
		).then(() => true);
	}
}
