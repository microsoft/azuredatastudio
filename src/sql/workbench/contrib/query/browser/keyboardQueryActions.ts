/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from 'vs/nls';

import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
//import { DataService } from 'sql/workbench/services/query/common/dataService';
//import QueryRunner from 'sql/workbench/services/query/common/queryRunner';

import * as azdata from 'azdata';
//import { EOL } from 'os';

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
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

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

	public run(): Promise<void> {
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

	public run(): Promise<void> {
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

	public run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.runCurrentQuery();
		}
		return Promise.resolve(null);
	}
}

export class CopyCurrentQueryWithResultsKeyboardAction extends Action {
	public static ID = 'copyCurrentQueryWithResultsKeyboardAction';
	public static LABEL = nls.localize('copyCurrentQueryWithResultsKeyboardAction', "Copy Query With Results");

	constructor(
		id: string,
		label: string,
		//private dataService: DataService,
		//private _queryRunner: QueryRunner,
		@IEditorService private _editorService: IEditorService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IQueryModelService protected readonly queryModelService: IQueryModelService,
	) {
		super(id, label);
		this.enabled = true;
	}

	public async run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			//this._clipboardService.writeText(editor.getSelectionText());
			let queryrunner = this.queryModelService.getQueryRunner(editor.input.uri);
			let allResults = '';

			for (let i = 0; i < queryrunner.batchSets[0].resultSetSummaries.length; i++) {
				let resultSummary = queryrunner.batchSets[0].resultSetSummaries[i];
				let result = await this.queryModelService.getQueryRunner(editor.input.uri).getQueryRows(0, resultSummary.rowCount, resultSummary.batchId, resultSummary.id);
				let rows: Map<number, Map<number, string>> = new Map(); // Maps row index -> column index -> actual row value

				// Iterate over the rows to paste into the copy string
				for (let rowIndex: number = 0; rowIndex < result.rows.length; rowIndex++) {
					let row = result.rows[rowIndex];
					// Remove newlines if requested
					let cells = row.map(x => x.displayValue);

					let idx = 0;
					for (let cell of cells) {
						let map = rows.get(rowIndex);
						if (!map) {
							map = new Map();
							rows.set(rowIndex, map);
						}

						map.set(idx, cell);
						idx++;
					}
				}
				//this._queryRunner.getQueryRows(0, 10, 0, 0);
				//editor.input.results.state.toString()
				//let c = editor.input.results.state.gridPanelState.tableStates[0];
				let copyString = '';
				for (let rowEntry of rows) {
					let rowMap = rowEntry[1];
					for (let rowIdx = 0; rowIdx < rowMap.size; rowIdx++) {

						let value = rowMap.get(rowIdx);
						if (value) {
							copyString = copyString.concat(value);
						}
						copyString = copyString.concat('\t');
					}
					// Removes the tab seperator from the end of a row
					copyString = copyString.slice(0, -1 * '\t'.length);
				}

				allResults = allResults + copyString + '\n\n\n';
			}

			/*let tablesHtml = '';
			tableResults.forEach((tableResult, i) => {
				// isChart is null for tables / false for tables that are dataset for charts
				if (tableResult.isChart !== true) {
					const tableHtml = generateTableHtml(tableResult, i);
					tablesHtml += tableHtml;
				}
			});*/

			this._clipboardService.writeText(editor.getAllText() + '\n' + allResults);

			let data = {
				text: editor.getAllText() + '\n\n' + allResults,
				html: '"<div><br/><br/><header>Table0</header><table cellPadding="5" cellSpacing="1" style="border:1;border-color:Black;font-family:Segoe UI;font-size:12px;border-collapse:collapse"><tr style="background-color:DarkGray"><th style="border:solid black 1.0pt;white-space:nowrap">StartTime</th><th style="border:solid black 1.0pt;white-space:nowrap">EndTime</th><th style="border:solid black 1.0pt;white-space:nowrap">EpisodeId</th><th style="border:solid black 1.0pt;white-space:nowrap">EventId</th><th style="border:solid black 1.0pt;white-space:nowrap">State</th><th style="border:solid black 1.0pt;white-space:nowrap">EventType</th><th style="border:solid black 1.0pt;white-space:nowrap">InjuriesDirect</th><th style="border:solid black 1.0pt;white-space:nowrap">InjuriesIndirect</th><th style="border:solid black 1.0pt;white-space:nowrap">DeathsDirect</th><th style="border:solid black 1.0pt;white-space:nowrap">DeathsIndirect</th><th style="border:solid black 1.0pt;white-space:nowrap">DamageProperty</th><th style="border:solid black 1.0pt;white-space:nowrap">DamageCrops</th><th style="border:solid black 1.0pt;white-space:nowrap">Source</th><th style="border:solid black 1.0pt;white-space:nowrap">BeginLocation</th><th style="border:solid black 1.0pt;white-space:nowrap">EndLocation</th><th style="border:solid black 1.0pt;white-space:nowrap">BeginLat</th><th style="border:solid black 1.0pt;white-space:nowrap">BeginLon</th><th style="border:solid black 1.0pt;white-space:nowrap">EndLat</th><th style="border:solid black 1.0pt;white-space:nowrap">EndLon</th><th style="border:solid black 1.0pt;white-space:nowrap">EpisodeNarrative</th><th style="border:solid black 1.0pt;white-space:nowrap">EventNarrative</th><th style="border:solid black 1.0pt;white-space:nowrap">StormSummary</th></tr><tr><td style="border:solid black 1.0pt;white-space:nowrap">2007-09-29T08:11:00Z</td><td style="border:solid black 1.0pt;white-space:nowrap">2007-09-29T08:11:00Z</td><td style="border:solid black 1.0pt;white-space:nowrap">11091</td><td style="border:solid black 1.0pt;white-space:nowrap">61032</td><td style="border:solid black 1.0pt;white-space:nowrap">ATLANTIC SOUTH</td><td style="border:solid black 1.0pt;white-space:nowrap">Waterspout</td><td style="border:solid black 1.0pt;white-space:nowrap">0</td><td style="border:solid black 1.0pt;white-space:nowrap">0</td><td style="border:solid black 1.0pt;white-space:nowrap">0</td><td style="border:solid black 1.0pt;white-space:nowrap">0</td><td style="border:solid black 1.0pt;white-space:nowrap">0</td><td style="border:solid black 1.0pt;white-space:nowrap">0</td><td style="border:solid black 1.0pt;white-space:nowrap">Trained Spotter</td><td style="border:solid black 1.0pt;white-space:nowrap">MELBOURNE BEACH</td><td style="border:solid black 1.0pt;white-space:nowrap">MELBOURNE BEACH</td><td style="border:solid black 1.0pt;white-space:nowrap">28.0393</td><td style="border:solid black 1.0pt;white-space:nowrap">-80.6048</td><td style="border:solid black 1.0pt;white-space:nowrap">28.0393</td><td style="border:solid black 1.0pt;white-space:nowrap">-80.6048</td><td style="border:solid black 1.0pt;white-space:nowrap">Showers and thunderstorms lingering along the coast produced waterspouts in Brevard County.</td><td style="border:solid black 1.0pt;white-space:nowrap">A waterspout formed in the Atlantic southeast of Melbourne Beach and briefly moved toward shore.</td><td style="border:solid black 1.0pt;white-space:nowrap">{&quot;TotalDamages&quot;:0,&quot;StartTime&quot;:&quot;2007-09-29T08:11:00.0000000Z&quot;,&quot;EndTime&quot;:&quot;2007-09-29T08:11:00.0000000Z&quot;,&quot;Details&quot;:{&quot;Description&quot;:&quot;A waterspout formed in the Atlantic southeast of Melbourne Beach and briefly moved toward shore.&quot;,&quot;Location&quot;:&quot;ATLANTIC SOUTH&quot;}}</td></tr></table></div>"'
			};
			//`${}`
			this._clipboardService.write(data);
			//editor.runCurrentQuery();
		}
		return Promise.resolve(null);
	}
}

export class RunCurrentQueryWithActualPlanKeyboardAction extends Action {
	public static ID = 'runCurrentQueryWithActualPlanKeyboardAction';
	public static LABEL = nls.localize('runCurrentQueryWithActualPlanKeyboardAction', "Run Current Query with Actual Plan");

	constructor(
		id: string,
		label: string,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.runCurrentQueryWithActualPlan();
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

	public run(): Promise<void> {
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

	public run(): Promise<void> {
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

	public run(): Promise<void> {
		const editor = this._editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.toggleResultsEditorVisibility();
		}
		return Promise.resolve(null);
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

	public run(index: number): Promise<void> {
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
				let queryString = `${shortcutText} ${escapedParam}`;
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

	public run(): Promise<void> {
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
