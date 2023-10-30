/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { Action2 } from 'vs/platform/actions/common/actions';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ParseSyntaxCommandId } from 'sql/workbench/contrib/query/browser/queryActions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import * as queryContext from 'sql/workbench/contrib/query/common/queryContext';

const QueryEditorVisibleCondition = ContextKeyExpr.has(queryContext.queryEditorVisibleId);

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
export class FocusOnCurrentQueryKeyboardAction extends Action2 {

	public static ID = 'focusOnCurrentQueryKeyboardAction';
	public static LABEL_ORG = 'Focus on Current Query';
	public static LABEL = nls.localize('focusOnCurrentQueryKeyboardAction', "Focus on Current Query");

	constructor() {
		super({
			id: FocusOnCurrentQueryKeyboardAction.ID,
			title: { value: FocusOnCurrentQueryKeyboardAction.LABEL, original: FocusOnCurrentQueryKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO }
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.focus();
		}
	}
}

/**
 * Locates the active editor and calls runQuery() on the editor if it is a QueryEditor.
 */
export class RunQueryKeyboardAction extends Action2 {

	public static ID = 'runQueryKeyboardAction';
	public static LABEL_ORG = 'Run Query';
	public static LABEL = nls.localize('runQueryKeyboardAction', "Run Query");

	constructor() {
		super({
			id: RunQueryKeyboardAction.ID,
			title: { value: RunQueryKeyboardAction.LABEL, original: RunQueryKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyCode.F5 },
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor || editor instanceof EditDataEditor) {
			editor.runQuery();
		}
	}
}

/**
 * Locates the active editor and calls runCurrentQuery() on the editor if it is a QueryEditor.
 */
export class RunCurrentQueryKeyboardAction extends Action2 {
	public static ID = 'runCurrentQueryKeyboardAction';
	public static LABEL_ORG = 'Run Current Query';
	public static LABEL = nls.localize('runCurrentQueryKeyboardAction', "Run Current Query");

	constructor(
	) {
		super({
			id: RunCurrentQueryKeyboardAction.ID,
			title: { value: RunCurrentQueryKeyboardAction.LABEL, original: RunCurrentQueryKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.CtrlCmd | KeyCode.F5 },
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.runCurrentQuery();
		}
	}
}

export class CopyQueryWithResultsKeyboardAction extends Action2 {
	public static ID = 'copyQueryWithResultsKeyboardAction';
	public static LABEL_ORG = 'Copy Query With Results';
	public static LABEL = nls.localize('copyQueryWithResultsKeyboardAction', "Copy Query With Results");

	constructor() {
		super({
			id: CopyQueryWithResultsKeyboardAction.ID,
			title: { value: CopyQueryWithResultsKeyboardAction.LABEL, original: CopyQueryWithResultsKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyV) }
		});
	}

	public async getFormattedResults(editor, queryModelService: IQueryModelService): Promise<ClipboardData> {
		let queryRunner = queryModelService.getQueryRunner(editor.input.uri);
		let allResults = '';
		let allHtmlResults = '';

		if (queryRunner && queryRunner.batchSets.length > 0) {
			for (let i = 0; i < queryRunner.batchSets[0].resultSetSummaries.length; i++) {
				let resultSummary = queryRunner.batchSets[0].resultSetSummaries[i];
				let result = await queryRunner.getQueryRowsPaged(0, resultSummary.rowCount, resultSummary.batchId, resultSummary.id);
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
					// Removes the tab separator from the end of a row
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

	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const clipboardService = accessor.get(IClipboardService);
		const queryModelService = accessor.get(IQueryModelService);
		const notificationService = accessor.get(INotificationService);

		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			let allResults = await this.getFormattedResults(editor, queryModelService);
			let queryText = editor.getAllText();

			let data = {
				text: `${queryText}\n\n${allResults.text}`,
				html: `<div style="font-family: Consolas, 'Courier New', monospace;font-weight: normal;font-size: 10pt;">${escape(queryText).replace(/\r\n|\n|\r/gm, '<br/>')}</div>${allResults.html}`
			};

			await clipboardService.write(data);

			notificationService.notify({
				severity: Severity.Info,
				message: nls.localize('queryActions.queryResultsCopySuccess', "Successfully copied query and results.")
			});
		}
	}
}

export class EstimatedExecutionPlanKeyboardAction extends Action2 {
	public static ID = 'estimatedExecutionPlanKeyboardAction';
	public static LABEL_ORG = 'Display Estimated Execution Plan';
	public static LABEL = nls.localize('estimatedExecutionPlanKeyboardAction', "Display Estimated Execution Plan");

	constructor() {
		super({
			id: EstimatedExecutionPlanKeyboardAction.ID,
			title: { value: EstimatedExecutionPlanKeyboardAction.LABEL, original: EstimatedExecutionPlanKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.CtrlCmd | KeyCode.KeyL }
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			let queryEditor = <QueryEditor>editor;
			editor.input.runQuery(queryEditor.getSelection(), { displayEstimatedQueryPlan: true });
		}
	}
}

export class ToggleActualPlanKeyboardAction extends Action2 {
	public static ID = 'ToggleActualPlanKeyboardAction';
	public static LABEL_ORG = 'Enable/Disable Actual Execution Plan';
	public static LABEL = nls.localize('ToggleActualPlanKeyboardAction', "Enable/Disable Actual Execution Plan");

	constructor() {
		super({
			id: ToggleActualPlanKeyboardAction.ID,
			title: { value: ToggleActualPlanKeyboardAction.LABEL, original: ToggleActualPlanKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.CtrlCmd | KeyCode.KeyM }
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;

		if (editor instanceof QueryEditor) {
			let toActualPlanState = !editor.input.state.isActualExecutionPlanMode;
			editor.input.state.isActualExecutionPlanMode = toActualPlanState;
		}
	}
}

/**
 * Locates the active editor and calls cancelQuery() on the editor if it is a QueryEditor.
 */
export class CancelQueryKeyboardAction extends Action2 {
	public static ID = 'cancelQueryKeyboardAction';
	public static LABEL_ORG = 'Cancel Query';
	public static LABEL = nls.localize('cancelQueryKeyboardAction', "Cancel Query");

	constructor() {
		super({
			id: CancelQueryKeyboardAction.ID,
			title: { value: CancelQueryKeyboardAction.LABEL, original: CancelQueryKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.Alt | KeyCode.PauseBreak }
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor || editor instanceof EditDataEditor) {
			editor.cancelQuery();
		}
	}
}

/**
 * Refresh the IntelliSense cache
 */
export class RefreshIntellisenseKeyboardAction extends Action2 {
	public static ID = 'refreshIntellisenseKeyboardAction';
	public static LABEL_ORG = 'Refresh IntelliSense Cache';
	public static LABEL = nls.localize('refreshIntellisenseKeyboardAction', "Refresh IntelliSense Cache");

	constructor() {
		super({
			id: RefreshIntellisenseKeyboardAction.ID,
			title: { value: RefreshIntellisenseKeyboardAction.LABEL, original: RefreshIntellisenseKeyboardAction.LABEL_ORG },
			f1: true
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const editor = editorService.activeEditor;
		if (editor instanceof QueryEditorInput) {
			connectionManagementService.rebuildIntelliSenseCache(editor.uri);
		} else if (editor instanceof NotebookInput && editor.notebookModel?.activeCell) {
			connectionManagementService.rebuildIntelliSenseCache(editor.notebookModel.activeCell.cellUri.toString(true));
		}
	}
}

/**
 * Hide the query results
 */
export class ToggleQueryResultsKeyboardAction extends Action2 {
	public static ID = 'toggleQueryResultsKeyboardAction';
	public static LABEL_ORG = 'Toggle Query Results';
	public static LABEL = nls.localize('toggleQueryResultsKeyboardAction', "Toggle Query Results");

	constructor() {
		super({
			id: ToggleQueryResultsKeyboardAction.ID,
			title: { value: ToggleQueryResultsKeyboardAction.LABEL, original: ToggleQueryResultsKeyboardAction.LABEL_ORG },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyR
			},
			precondition: QueryEditorVisibleCondition
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			editor.toggleResultsEditorVisibility();
		}
	}
}

/**
 * Toggle the focus between query editor and results pane
 */
export class ToggleFocusBetweenQueryEditorAndResultsAction extends Action2 {
	public static ID = 'ToggleFocusBetweenQueryEditorAndResultsAction';
	public static LABEL_ORG = 'Toggle Focus Between Query And Results';
	public static LABEL = nls.localize('ToggleFocusBetweenQueryEditorAndResultsAction', "Toggle Focus Between Query And Results");

	constructor() {
		super({
			id: ToggleFocusBetweenQueryEditorAndResultsAction.ID,
			title: { value: ToggleFocusBetweenQueryEditorAndResultsAction.LABEL, original: ToggleFocusBetweenQueryEditorAndResultsAction.LABEL_ORG },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyF
			},
			precondition: QueryEditorVisibleCondition
		});
	}

	run(accessor: ServicesAccessor): void {
		const editorService = accessor.get(IEditorService);
		const editor = editorService.activeEditorPane;
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
export class ParseSyntaxAction extends Action2 {
	public static LABEL_ORG = 'Parse Query';
	public static LABEL = nls.localize('parseSyntaxLabel', "Parse Query");

	constructor() {
		super({
			id: ParseSyntaxCommandId,
			title: { value: ParseSyntaxAction.LABEL, original: ParseSyntaxAction.LABEL_ORG },
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyP }
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const connectionManagementService = accessor.get(IConnectionManagementService);
		const queryManagementService = accessor.get(IQueryManagementService);
		const notificationService = accessor.get(INotificationService);
		const editor = editorService.activeEditorPane;
		if (editor instanceof QueryEditor) {
			if (!editor.isEditorEmpty()) {
				if (this.isConnected(editor, connectionManagementService)) {
					let text = editor.getSelectionText();
					if (text === '') {
						text = editor.getAllText();
					}
					const result = await queryManagementService.parseSyntax(editor.input.uri, text);
					if (result && result.parseable) {
						notificationService.notify({
							severity: Severity.Info,
							message: nls.localize('queryActions.parseSyntaxSuccess', "Successfully parsed the query.")
						});
					} else if (result && result.errors.length > 0) {
						notificationService.error(
							nls.localize('queryActions.parseSyntaxFailure', "Failed to parse the query: {0}",
								result.errors.map((err, idx) => `${idx + 1}. ${err} `).join(' ')));
					}
				} else {
					notificationService.notify({
						severity: Severity.Error,
						message: nls.localize('queryActions.notConnected', "Please connect to a server before running this action.")
					});
				}
			}
		}
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	private isConnected(editor: QueryEditor, connectionManagementService: IConnectionManagementService): boolean {
		if (!editor || !editor.input) {
			return false;
		}
		return connectionManagementService.isConnected(editor.input.uri);
	}
}
