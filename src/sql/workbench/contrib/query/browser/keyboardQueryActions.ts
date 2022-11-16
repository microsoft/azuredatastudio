/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

import * as azdata from 'azdata';
import { escape } from 'sql/base/common/strings';

import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import * as Constants from 'sql/platform/query/common/constants';
import * as ConnectionConstants from 'sql/platform/connection/common/constants';
import { EditDataEditor } from 'sql/workbench/contrib/editData/browser/editDataEditor';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { ClipboardData, IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

const singleQuote = '\'';

function isConnected(editor: QueryEditor, connectionManagementService: IConnectionManagementService): boolean {
	if (!editor || !editor.input) {
		return false;
	}
	return connectionManagementService.isConnected(editor.input.uri);
}

function runActionOnActiveQueryEditor(editorService: IEditorService, action: (QueryEditor) => void): void {
	const candidates = [editorService.activeEditorPane, ...editorService.visibleEditorPanes].filter(e => e instanceof QueryEditor);
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
	public static LABEL = nls.localize('focusOnCurrentQueryKeyboardAction', "Focus on Current Query");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.focus();
		}
		return Promise.resolve(null);
	}
}

/**
 * Locates the active editor and calls runQuery() on the editor if it is a QueryEditor.
 */
export class RunQueryKeyboardAction extends Action {

	public static ID = 'runQueryKeyboardAction';
	public static LABEL = nls.localize('runQueryKeyboardAction', "Run Query");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor || editor instanceof EditDataEditor) {
			editor.runQuery();
		}
		return Promise.resolve(null);
	}
}

/**
 * Locates the active editor and calls runCurrentQuery() on the editor if it is a QueryEditor.
 */
export class RunCurrentQueryKeyboardAction extends Action {
	public static ID = 'runCurrentQueryKeyboardAction';
	public static LABEL = nls.localize('runCurrentQueryKeyboardAction', "Run Current Query");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.runCurrentQuery();
		}
		return Promise.resolve(null);
	}
}

export class CopyQueryWithResultsKeyboardAction extends Action {
	public static ID = 'copyQueryWithResultsKeyboardAction';
	public static LABEL = nls.localize('copyQueryWithResultsKeyboardAction', "Copy Query With Results");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IQueryModelService protected readonly queryModelService: IQueryModelService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super(id, label);
	}

	public async getFormattedResults(editor): Promise<ClipboardData> {
		let queryRunner = this.queryModelService.getQueryRunner(editor.input.uri);
		let allResults = '';
		let allHtmlResults = '';

		if (queryRunner && queryRunner.batchSets.length > 0) {
			for (let i = 0; i < queryRunner.batchSets[0].resultSetSummaries.length; i++) {
				let resultSummary = queryRunner.batchSets[0].resultSetSummaries[i];
				let result = await queryRunner.getQueryRows(0, resultSummary.rowCount, resultSummary.batchId, resultSummary.id);
				let tableHeaders = resultSummary.columnInfo.map((col, i) => (col.columnName));
				let htmlTableHeaders = `<thead><tr style="background-color:DarkGray">${resultSummary.columnInfo.map((col, i) => (`<th style="border:1.0pt solid black;padding:3pt;font-size:9pt;font-weight: bold;">${escape(col.columnName)}</th>`)).join('')}</tr></thead>`;
				let copyString = '\n';
				let htmlCopyString = '';

				for (let rowEntry of result.rows) {
					htmlCopyString = htmlCopyString + '<tr>';
					for (let colIdx = 0; colIdx < rowEntry.length; colIdx++) {
						let value = rowEntry[colIdx].displayValue;
						copyString = `${copyString}${value}\t`;
						htmlCopyString = `${htmlCopyString}<td style="border:1.0pt solid black;padding:3pt;font-size:9pt;">${escape(value)}</td>`;
					}
					// Removes the tab seperator from the end of a row
					copyString = copyString.slice(0, -1 * '\t'.length) + '\n';
					htmlCopyString = htmlCopyString + '</tr>';
				}

				allResults = `${allResults}${tableHeaders.join('\t')}${copyString}\n`;
				allHtmlResults = `${allHtmlResults}<div><br/><br/>
				<table cellPadding="5" cellSpacing="1" style="border:1;border-color:Black;font-family:Segoe UI;font-size:9pt;border-collapse:collapse">
				${htmlTableHeaders}${htmlCopyString}
				</table></div>`;
			}
		}

		return { text: allResults, html: allHtmlResults };
	}

	public override async run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			let allResults = await this.getFormattedResults(editor);
			let queryText = editor.getAllText();

			let data = {
				text: `${queryText}\n\n${allResults.text}`,
				html: `<div style="font-family: Consolas, 'Courier New', monospace;font-weight: normal;font-size: 10pt;">${escape(queryText).replace(/\r\n|\n|\r/gm, '<br/>')}</div>${allResults.html}`
			};

			await this._clipboardService.write(data);

			this.notificationService.notify({
				severity: Severity.Info,
				message: nls.localize('queryActions.queryResultsCopySuccess', "Successfully copied query and results.")
			});
		}
	}
}

export class EstimatedExecutionPlanKeyboardAction extends Action {
	public static ID = 'estimatedExecutionPlanKeyboardAction';
	public static LABEL = nls.localize('estimatedExecutionPlanKeyboardAction', "Display Estimated Execution Plan");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override async run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			let queryEditor = <QueryEditor>editor;
			editor.input.runQuery(queryEditor.getSelection(), { displayEstimatedQueryPlan: true });
		}
	}
}

export class ToggleActualPlanKeyboardAction extends Action {
	public static ID = 'ToggleActualPlanKeyboardAction';
	public static LABEL = nls.localize('ToggleActualPlanKeyboardAction', "Enable/Disable Actual Execution Plan");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;

		if (editor instanceof QueryEditor) {
			let toActualPlanState = !editor.input.state.isActualExecutionPlanMode;
			editor.input.state.isActualExecutionPlanMode = toActualPlanState;
		}

		return Promise.resolve(null);
	}
}

/**
 * Locates the active editor and calls cancelQuery() on the editor if it is a QueryEditor.
 */
export class CancelQueryKeyboardAction extends Action {

	public static ID = 'cancelQueryKeyboardAction';
	public static LABEL = nls.localize('cancelQueryKeyboardAction', "Cancel Query");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor || editor instanceof EditDataEditor) {
			editor.cancelQuery();
		}
		return Promise.resolve(null);
	}
}

/**
 * Refresh the IntelliSense cache
 */
export class RefreshIntellisenseKeyboardAction extends Action {
	public static ID = 'refreshIntellisenseKeyboardAction';
	public static LABEL = nls.localize('refreshIntellisenseKeyboardAction', "Refresh IntelliSense Cache");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IEditorService private editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this.editorService.activeEditor;
		if (editor instanceof QueryEditorInput) {
			this.connectionManagementService.rebuildIntelliSenseCache(editor.uri);
		}
		return Promise.resolve(null);
	}
}


/**
 * Hide the query results
 */
export class ToggleQueryResultsKeyboardAction extends Action {
	public static ID = 'toggleQueryResultsKeyboardAction';
	public static LABEL = nls.localize('toggleQueryResultsKeyboardAction', "Toggle Query Results");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.toggleResultsEditorVisibility();
		}
		return Promise.resolve(null);
	}
}



/**
 * Toggle the focus between query editor and results pane
 */
export class ToggleFocusBetweenQueryEditorAndResultsAction extends Action {
	public static ID = 'ToggleFocusBetweenQueryEditorAndResultsAction';
	public static LABEL = nls.localize('ToggleFocusBetweenQueryEditorAndResultsAction', "Toggle Focus Between Query And Results");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override async run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.toggleFocusBetweenQueryEditorAndResults();
		}
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryShortcutAction extends Action {
	public static ID = 'runQueryShortcutAction';

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IQueryModelService protected readonly queryModelService: IQueryModelService,
		@IQueryManagementService private readonly queryManagementService: IQueryManagementService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super(RunQueryShortcutAction.ID);
	}

	public override run(index: number): Promise<void> {
		let promise: Thenable<void> = Promise.resolve(null);
		runActionOnActiveQueryEditor(this.editorService, (editor) => {
			promise = this.runQueryShortcut(editor, index);
		});
		return new Promise((resolve, reject) => {
			promise.then(success => resolve(null), err => resolve(null));
		});
	}

	/**
	 * Runs one of the optionally registered query shortcuts. This will lookup the shortcut's stored procedure
	 * reference from the settings, and if found will execute it plus any
	 *
	 * @param editor
	 * @param shortcutIndex which shortcut should be run?
	 */
	public runQueryShortcut(editor: QueryEditor, shortcutIndex: number): Thenable<void> {
		if (!editor) {
			throw new Error(nls.localize('queryShortcutNoEditor', "Editor parameter is required for a shortcut to be executed"));
		}

		if (isConnected(editor, this.connectionManagementService)) {
			let shortcutText = this.getShortcutText(shortcutIndex);
			if (!shortcutText.trim()) {
				// no point going further
				return Promise.resolve(null);
			}

			// if the selection isn't empty then execute the selection
			// otherwise, either run the statement or the script depending on parameter
			let parameterText: string = editor.getSelectionText();
			return this.escapeStringParamIfNeeded(editor, shortcutText, parameterText).then((escapedParam) => {
				let queryString = '';
				if (shortcutText.includes('{arg}')) {
					queryString = shortcutText.replace(/{arg}/g, escapedParam);
				} else {
					queryString = `${shortcutText} ${escapedParam}`;
				}
				editor.input.runQueryString(queryString);
			}).then(success => null, err => {
				// swallow errors for now
				return null;
			});
		} else {
			return Promise.resolve(null);
		}
	}

	private getShortcutText(shortcutIndex: number) {
		let shortcutSetting = Constants.shortcutStart + shortcutIndex;
		let querySettings = WorkbenchUtils.getSqlConfigSection(this.configurationService, Constants.querySection);
		let shortcutText = querySettings[shortcutSetting];
		return shortcutText;
	}

	private escapeStringParamIfNeeded(editor: QueryEditor, shortcutText: string, parameterText: string): Thenable<string> {
		if (parameterText && parameterText.length > 0) {
			if (this.canQueryProcMetadata(editor)) {
				let dbName = this.getDatabaseName(editor);
				let query = `exec dbo.sp_sproc_columns @procedure_name = N'${escapeSqlString(shortcutText, singleQuote)}', @procedure_owner = null, @procedure_qualifier = N'${escapeSqlString(dbName, singleQuote)}'`;
				return this.queryManagementService.runQueryAndReturn(editor.input.uri, query)
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
			return Promise.resolve(parameterText);
		}
		return Promise.resolve('');
	}

	private isProcWithSingleArgument(result: azdata.SimpleExecuteResult): number {
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

	private getColumnIndex(columnInfo: azdata.IDbColumn[], columnName: string): number {
		return columnInfo ? columnInfo.findIndex(c => c.columnName === columnName) : undefined;
	}

	private canQueryProcMetadata(editor: QueryEditor): boolean {
		let info = this.connectionManagementService.getConnectionInfo(editor.input.uri);
		return (info && info.providerId === ConnectionConstants.mssqlProviderName);
	}

	private getDatabaseName(editor: QueryEditor): string {
		let info = this.connectionManagementService.getConnectionInfo(editor.input.uri);
		return info.connectionProfile.databaseName;
	}
}

/**
 * Action class that parses the query string in the current SQL text document.
 */
export class ParseSyntaxAction extends Action {

	public static ID = 'parseQueryAction';
	public static LABEL = nls.localize('parseSyntaxLabel', "Parse Query");

	constructor(
		id: string,
		label: string,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IQueryManagementService private readonly queryManagementService: IQueryManagementService,
		@IEditorService private readonly editorService: IEditorService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super(id, label);
		this.enabled = true;
	}

	public override run(): Promise<void> {
		const editor = this.editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			if (!editor.isSelectionEmpty()) {
				if (this.isConnected(editor)) {
					let text = editor.getSelectionText();
					if (text === '') {
						text = editor.getAllText();
					}
					this.queryManagementService.parseSyntax(editor.input.uri, text).then(result => {
						if (result && result.parseable) {
							this.notificationService.notify({
								severity: Severity.Info,
								message: nls.localize('queryActions.parseSyntaxSuccess', "Commands completed successfully")
							});
						} else if (result && result.errors.length > 0) {
							let errorMessage = nls.localize('queryActions.parseSyntaxFailure', "Command failed: ");
							this.notificationService.error(`${errorMessage}${result.errors[0]}`);

						}
					});
				} else {
					this.notificationService.notify({
						severity: Severity.Error,
						message: nls.localize('queryActions.notConnected', "Please connect to a server")
					});
				}
			}

		}

		return Promise.resolve(null);
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	private isConnected(editor: QueryEditor): boolean {
		if (!editor || !editor.input) {
			return false;
		}
		return this.connectionManagementService.isConnected(editor.input.uri);
	}
}
