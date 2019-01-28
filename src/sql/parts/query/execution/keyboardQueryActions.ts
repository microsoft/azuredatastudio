/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');

import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TPromise } from 'vs/base/common/winjs.base';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';

import * as sqlops from 'sqlops';

import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import * as Constants from 'sql/parts/query/common/constants';
import * as ConnectionConstants from 'sql/platform/connection/common/constants';
import { EditDataEditor } from 'sql/parts/editData/editor/editDataEditor';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';

const singleQuote = '\'';

export function isConnected(editor: QueryEditor, connectionManagementService: IConnectionManagementService): boolean {
	if (!editor || !editor.currentQueryInput) {
		return false;
	}
	return connectionManagementService.isConnected(editor.currentQueryInput.uri);
}

function runActionOnActiveQueryEditor(editorService: IEditorService, action: (QueryEditor) => void): void {
	const candidates = [editorService.activeControl, ...editorService.visibleControls].filter(e => e instanceof QueryEditor);
	if (candidates.length > 0) {
		action(candidates[0]);
	}
}

function escapeSqlString(input: string, escapeChar: string) {
	if (!input) {
		return input;
	}
	let output = '';
	for (let i = 0; i < input.length; i++) {
		let char = input.charAt(i);
		output += char;
		if (escapeChar === char) {
			output += char;
		}
	}
	return output;
}


/**
 * Locates the active editor and call focus() on the editor if it is a QueryEditor.
 */
export class FocusOnCurrentQueryKeyboardAction extends Action {

	public static ID = 'focusOnCurrentQueryKeyboardAction';
	public static LABEL = nls.localize('focusOnCurrentQueryKeyboardAction', 'Focus on Current Query');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.focus();
		}
		return TPromise.as(null);
	}
}

/**
 * Locates the active editor and calls runQuery() on the editor if it is a QueryEditor.
 */
export class RunQueryKeyboardAction extends Action {

	public static ID = 'runQueryKeyboardAction';
	public static LABEL = nls.localize('runQueryKeyboardAction', 'Run Query');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && (editor instanceof QueryEditor || editor instanceof EditDataEditor)) {
			let queryEditor: QueryEditor | EditDataEditor = editor;
			queryEditor.runQuery();
		}
		return TPromise.as(null);
	}
}

/**
 * Locates the active editor and calls runCurrentQuery() on the editor if it is a QueryEditor.
 */
export class RunCurrentQueryKeyboardAction extends Action {
	public static ID = 'runCurrentQueryKeyboardAction';
	public static LABEL = nls.localize('runCurrentQueryKeyboardAction', 'Run Current Query');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.runCurrentQuery();
		}
		return TPromise.as(null);
	}
}

export class RunCurrentQueryWithActualPlanKeyboardAction extends Action {
	public static ID = 'runCurrentQueryWithActualPlanKeyboardAction';
	public static LABEL = nls.localize('runCurrentQueryWithActualPlanKeyboardAction', 'Run Current Query with Actual Plan');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.runCurrentQueryWithActualPlan();
		}
		return TPromise.as(null);
	}
}

/**
 * Locates the active editor and calls cancelQuery() on the editor if it is a QueryEditor.
 */
export class CancelQueryKeyboardAction extends Action {

	public static ID = 'cancelQueryKeyboardAction';
	public static LABEL = nls.localize('cancelQueryKeyboardAction', 'Cancel Query');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && (editor instanceof QueryEditor || editor instanceof EditDataEditor)) {
			let queryEditor: QueryEditor | EditDataEditor = editor;
			queryEditor.cancelQuery();
		}
		return TPromise.as(null);
	}
}

/**
 * Refresh the IntelliSense cache
 */
export class RefreshIntellisenseKeyboardAction extends Action {
	public static ID = 'refreshIntellisenseKeyboardAction';
	public static LABEL = nls.localize('refreshIntellisenseKeyboardAction', 'Refresh IntelliSense Cache');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.rebuildIntelliSenseCache();
		}
		return TPromise.as(null);
	}
}


/**
 * Hide the query results
 */
export class ToggleQueryResultsKeyboardAction extends Action {
	public static ID = 'toggleQueryResultsKeyboardAction';
	public static LABEL = nls.localize('toggleQueryResultsKeyboardAction', 'Toggle Query Results');

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			queryEditor.toggleResultsEditorVisibility();
		}
		return TPromise.as(null);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryShortcutAction extends Action {
	public static ID = 'runQueryShortcutAction';

	constructor(
		@IEditorService private _editorService: IEditorService,
		@IQueryModelService protected _queryModelService: IQueryModelService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IWorkspaceConfigurationService private _workspaceConfigurationService: IWorkspaceConfigurationService
	) {
		super(RunQueryShortcutAction.ID);
	}

	public run(index: number): TPromise<void> {
		let promise: Thenable<void> = TPromise.as(null);
		runActionOnActiveQueryEditor(this._editorService, (editor) => {
			promise = this.runQueryShortcut(editor, index);
		});
		return new TPromise((resolve, reject) => {
			promise.then(success => resolve(null), err => resolve(null));
		});
	}

	/**
	 * Runs one of the optionally registered query shortcuts. This will lookup the shortcut's stored procedure
	 * reference from the settings, and if found will execute it plus any
	 *
	 * @param {QueryEditor} editor
	 * @param {number} shortcutIndex which shortcut should be run?
	 * @memberof RunQueryShortcutAction
	 */
	public runQueryShortcut(editor: QueryEditor, shortcutIndex: number): Thenable<void> {
		if (!editor) {
			throw new Error(nls.localize('queryShortcutNoEditor', 'Editor parameter is required for a shortcut to be executed'));
		}

		if (isConnected(editor, this._connectionManagementService)) {
			let shortcutText = this.getShortcutText(shortcutIndex);
			if (!shortcutText.trim()) {
				// no point going further
				return TPromise.as(null);
			}

			// if the selection isn't empty then execute the selection
			// otherwise, either run the statement or the script depending on parameter
			let parameterText: string = editor.getSelectionText();
			return this.escapeStringParamIfNeeded(editor, shortcutText, parameterText).then((escapedParam) => {
				let queryString = `${shortcutText} ${escapedParam}`;
				editor.currentQueryInput.runQueryString(queryString);
			}).then(success => null, err => {
				// swallow errors for now
				return null;
			});
		} else {
			return TPromise.as(null);
		}
	}

	private getShortcutText(shortcutIndex: number) {
		let shortcutSetting = Constants.shortcutStart + shortcutIndex;
		let querySettings = WorkbenchUtils.getSqlConfigSection(this._workspaceConfigurationService, Constants.querySection);
		let shortcutText = querySettings[shortcutSetting];
		return shortcutText;
	}

	private escapeStringParamIfNeeded(editor: QueryEditor, shortcutText: string, parameterText: string): Thenable<string> {
		if (parameterText && parameterText.length > 0) {
			if (this.canQueryProcMetadata(editor)) {
				let dbName = this.getDatabaseName(editor);
				let query = `exec dbo.sp_sproc_columns @procedure_name = N'${escapeSqlString(shortcutText, singleQuote)}', @procedure_owner = null, @procedure_qualifier = N'${escapeSqlString(dbName, singleQuote)}'`;
				return this._queryManagementService.runQueryAndReturn(editor.uri, query)
					.then(result => {
						switch (this.isProcWithSingleArgument(result)) {
							case 1:
								// sproc was found and it meets criteria of having 1 string param
								// if selection is quoted, leave as-is. Else quote
								let trimmedText = parameterText.trim();
								if (trimmedText.length > 0) {
									if (trimmedText.charAt(0) !== singleQuote || trimmedText.charAt(trimmedText.length - 1) !== singleQuote) {
										// Note: SSMS uses the original text, but this causes issues if you have spaces. We intentionally use
										// trimmed text since it's likely to be more accurate in this case. For non-quoted cases it shouldn't matter
										return `'${trimmedText}'`;
									}
								}
								break;
							case -1:
							// sproc was found but didn't meet criteria, so append as-is
							case 0:
								// sproc wasn't found, just append as-is and hope it works
								break;
						}
						return parameterText;
					}, err => {
						return parameterText;
					});
			}
			return TPromise.as(parameterText);
		}
		return TPromise.as('');
	}

	private isProcWithSingleArgument(result: sqlops.SimpleExecuteResult): number {
		let columnTypeOrdinal = this.getColumnIndex(result.columnInfo, 'COLUMN_TYPE');
		let dataTypeOrdinal = this.getColumnIndex(result.columnInfo, 'DATA_TYPE');
		if (columnTypeOrdinal && dataTypeOrdinal) {
			let count = 0;
			for (let row of result.rows) {
				let columnType = parseInt(row[columnTypeOrdinal].displayValue);
				if (columnType !== 5) {
					if (count > 0) // more than one argument.
					{
						return -1;
					}

					let dataType = parseInt(row[dataTypeOrdinal].displayValue);

					if (dataType === -9 || // nvarchar
						dataType === 12 || // varchar
						dataType === -8 || // nchar
						dataType === 1 ||  // char
						dataType === -1 || // text
						dataType === -10   // ntext
					) {
						count++;
					} else {
						// not a string
						return -1;
					}
				}
			}
			return count;
		}
		return -1; // Couldn't process so return default value
	}

	private getColumnIndex(columnInfo: sqlops.IDbColumn[], columnName: string): number {
		return columnInfo ? columnInfo.findIndex(c => c.columnName === columnName) : undefined;
	}

	private canQueryProcMetadata(editor: QueryEditor): boolean {
		let info = this._connectionManagementService.getConnectionInfo(editor.uri);
		return (info && info.providerId === ConnectionConstants.mssqlProviderName);
	}

	private getDatabaseName(editor: QueryEditor): string {
		let info = this._connectionManagementService.getConnectionInfo(editor.uri);
		return info.connectionProfile.databaseName;
	}
}

/**
 * Action class that parses the query string in the current SQL text document.
 */
export class ParseSyntaxAction extends Action {

	public static ID = 'parseQueryAction';
	public static LABEL = nls.localize('parseSyntaxLabel', 'Parse Query');

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IEditorService private _editorService: IEditorService,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let editor = this._editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			if (!queryEditor.isSelectionEmpty()) {
				if (this.isConnected(queryEditor)) {
					let text = queryEditor.getSelectionText();
					if (text === '') {
						text = queryEditor.getAllText();
					}
					this._queryManagementService.parseSyntax(queryEditor.connectedUri, text).then(result => {
						if (result && result.parseable) {
							this._notificationService.notify({
								severity: Severity.Info,
								message: nls.localize('queryActions.parseSyntaxSuccess', 'Commands completed successfully')
							});
						} else if (result && result.errors.length > 0) {
							let errorMessage = nls.localize('queryActions.parseSyntaxFailure', 'Command failed: ');
							this._notificationService.error(`${errorMessage}${result.errors[0]}`);

						}
					});
				} else {
					this._notificationService.notify({
						severity: Severity.Error,
						message: nls.localize('queryActions.notConnected', 'Please connect to a server')
					});
				}
			}

		}

		return TPromise.as(null);
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	private isConnected(editor: QueryEditor): boolean {
		if (!editor || !editor.currentQueryInput) {
			return false;
		}
		return this._connectionManagementService.isConnected(editor.currentQueryInput.uri);
	}
}