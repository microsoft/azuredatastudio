/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { EditDataInput } from 'sql/parts/editData/common/editDataInput';
import { IConnectableInput, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IEditorGroupsService, IEditorGroup } from 'vs/workbench/services/group/common/editorGroupsService';
import { IQueryEditorService, IQueryEditorOptions } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { QueryPlanInput } from 'sql/parts/queryPlan/queryPlanInput';
import { sqlModeId, untitledFilePrefix, getSupportedInputResource } from 'sql/parts/common/customInputConverter';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';

import { IMode } from 'vs/editor/common/modes';
import { ITextModel } from 'vs/editor/common/model';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileEditorInput } from 'vs/workbench/parts/files/common/editors/fileEditorInput';
import Severity from 'vs/base/common/severity';
import nls = require('vs/nls');
import { URI } from 'vs/base/common/uri';
import paths = require('vs/base/common/paths');
import { isLinux } from 'vs/base/common/platform';
import { Schemas } from 'vs/base/common/network';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { EditDataResultsInput } from 'sql/parts/editData/common/editDataResultsInput';
import { IEditorInput, IEditor } from 'vs/workbench/common/editor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { ILanguageSelection } from 'vs/editor/common/services/modeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

const fs = require('fs');

/**
 * Service wrapper for opening and creating SQL documents as sql editor inputs
 */
export class QueryEditorService implements IQueryEditorService {

	public _serviceBrand: any;

	private static CHANGE_UNSUPPORTED_ERROR_MESSAGE = nls.localize(
		'queryEditorServiceChangeUnsupportedError',
		'Change Language Mode is not supported for unsaved queries'
	);

	private static CHANGE_ERROR_MESSAGE = nls.localize(
		'queryEditorServiceChangeError',
		'Please save or discard changes before switching to/from the SQL Language Mode'
	);

	// service references for static functions
	private static editorService: IEditorService;
	private static instantiationService: IInstantiationService;
	private static notificationService: INotificationService;

	constructor(
		@INotificationService _notificationService: INotificationService,
		@IUntitledEditorService private _untitledEditorService: IUntitledEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		QueryEditorService.editorService = _editorService;
		QueryEditorService.instantiationService = _instantiationService;
		QueryEditorService.notificationService = _notificationService;
	}

	////// Public functions

	/**
	 * Creates new untitled document for SQL query and opens in new editor tab
	 */
	public newSqlEditor(sqlContent?: string, connectionProviderName?: string, isDirty?: boolean): Promise<IConnectableInput> {
		return new Promise<IConnectableInput>(async (resolve, reject) => {
			try {
				// Create file path and file URI
				let filePath = this.createUntitledSqlFilePath();
				let docUri: URI = URI.from({ scheme: Schemas.untitled, path: filePath });

				// Create a sql document pane with accoutrements
				const fileInput = this._untitledEditorService.createOrGet(docUri, 'sql');
				let untitledEditorModel = await fileInput.resolve();
				if (sqlContent) {
					untitledEditorModel.textEditorModel.setValue(sqlContent);
					if (isDirty === false || (isDirty === undefined && !this._configurationService.getValue<boolean>('sql.promptToSaveGeneratedFiles'))) {
						untitledEditorModel.setDirty(false);
					}
				}

				const queryResultsInput: QueryResultsInput = this._instantiationService.createInstance(QueryResultsInput, docUri.toString());
				let queryInput: QueryInput = this._instantiationService.createInstance(QueryInput, '', fileInput, queryResultsInput, connectionProviderName);

				this._editorService.openEditor(queryInput, { pinned: true })
					.then((editor) => {
						let params = <QueryInput>editor.input;
						resolve(params);
					}, (error) => {
						reject(error);
					});
			} catch (error) {
				reject(error);
			}
		});
	}

	// Creates a new query plan document
	public newQueryPlanEditor(xmlShowPlan: string): Promise<any> {
		const self = this;
		return new Promise<any>((resolve, reject) => {
			let queryPlanInput: QueryPlanInput = self._instantiationService.createInstance(QueryPlanInput, xmlShowPlan, 'aaa', undefined);
			self._editorService.openEditor(queryPlanInput, { pinned: true }, ACTIVE_GROUP);
			resolve(true);
		});
	}

	/**
	 * Creates new edit data session
	 */
	public newEditDataEditor(schemaName: string, tableName: string, sqlContent: string): Promise<IConnectableInput> {

		return new Promise<IConnectableInput>((resolve, reject) => {
			try {
				// Create file path and file URI
				let objectName = schemaName ? schemaName + '.' + tableName : tableName;
				let filePath = this.createPrefixedSqlFilePath(objectName);
				let docUri: URI = URI.from({ scheme: Schemas.untitled, path: filePath });

				// Create a sql document pane with accoutrements
				const fileInput = this._untitledEditorService.createOrGet(docUri, 'sql');
				fileInput.resolve().then(m => {
					if (sqlContent) {
						m.textEditorModel.setValue(sqlContent);
					}
				});

				// Create an EditDataInput for editing
				const resultsInput: EditDataResultsInput = this._instantiationService.createInstance(EditDataResultsInput, docUri.toString());
				let editDataInput: EditDataInput = this._instantiationService.createInstance(EditDataInput, docUri, schemaName, tableName, fileInput, sqlContent, resultsInput);

				this._editorService.openEditor(editDataInput, { pinned: true })
					.then((editor) => {
						let params = <EditDataInput>editor.input;
						resolve(params);
					}, (error) => {
						reject(error);
					});
			} catch (error) {
				reject(error);
			}
		});
	}

	onSaveAsCompleted(oldResource: URI, newResource: URI): void {
		let oldResourceString: string = oldResource.toString();


		this._editorService.editors.forEach(input => {
			if (input instanceof QueryInput) {
				const resource = input.getResource();

				// Update Editor if file (or any parent of the input) got renamed or moved
				// Note: must check the new file name for this since this method is called after the rename is completed
				if (paths.isEqualOrParent(resource.fsPath, newResource.fsPath, !isLinux /* ignorecase */)) {
					// In this case, we know that this is a straight rename so support this as a rename / replace operation
					TaskUtilities.replaceConnection(oldResourceString, newResource.toString(), this._connectionManagementService).then(result => {
						if (result && result.connected) {
							input.onConnectSuccess();
						} else {
							input.onConnectReject();
						}
					});
				}
			}
		});
	}

	////// Public static functions
	// These functions are static to reduce extra lines needed in the vscode code base

	/**
	 * Checks if the Language Mode is being changed to/from SQL. If so, swaps out the input of the
	 * given editor with a new input, opens a new editor, then returns the new editor's IModel.
	 *
	 * Returns an immediately resolved promise if the SQL Language mode is not involved. In this case,
	 * the calling function in editorStatus.ts will handle the language change normally.
	 *
	 * Returns an immediately resolved promise with undefined if SQL is involved in the language change
	 * and the editor is dirty. In this case, the calling function in editorStatus.ts will not perform
	 * the language change. TODO: change this -  tracked by issue #727
	 *
	 * In all other cases (when SQL is involved in the language change and the editor is not dirty),
	 * returns a promise that will resolve when the old editor has been replaced by a new editor.
	 */
	public static sqlLanguageModeCheck(model: ITextModel, languageSelection: ILanguageSelection, editor: IEditor): Promise<ITextModel> {
		if (!model || !languageSelection || !editor) {
			return Promise.resolve(undefined);
		}

		let newLanguage: string = languageSelection.languageIdentifier.language;
		let oldLanguage: string = model.getLanguageIdentifier().language;
		let changingToSql = sqlModeId === newLanguage;
		let changingFromSql = sqlModeId === oldLanguage;
		let changingLanguage = newLanguage !== oldLanguage;

		if (!changingLanguage) {
			return Promise.resolve(model);
		}
		if (!changingFromSql && !changingToSql) {
			return Promise.resolve(model);
		}

		let uri: URI = QueryEditorService._getEditorChangeUri(editor.input, changingToSql);
		if (uri.scheme === Schemas.untitled && (editor.input instanceof QueryInput || editor.input instanceof EditDataInput)) {
			QueryEditorService.notificationService.notify({
				severity: Severity.Error,
				message: QueryEditorService.CHANGE_UNSUPPORTED_ERROR_MESSAGE
			});
			return Promise.resolve(undefined);
		}

		// Return undefined to notify the calling funciton to not perform the language change
		// TODO change this - tracked by issue #727
		if (editor.input.isDirty()) {
			QueryEditorService.notificationService.notify({
				severity: Severity.Error,
				message: QueryEditorService.CHANGE_ERROR_MESSAGE
			});
			return Promise.resolve(undefined);
		}

		let group: IEditorGroup = editor.group;
		let index: number = group.editors.indexOf(editor.input);
		let options: IQueryEditorOptions = editor.options ? editor.options : {};
		options = Object.assign(options, { index: index });

		// Return a promise that will resovle when the old editor has been replaced by a new editor
		return new Promise<ITextModel>((resolve, reject) => {
			let newEditorInput = QueryEditorService._getNewEditorInput(changingToSql, editor.input, uri);

			// Override queryEditorCheck to not open this file in a QueryEditor
			if (!changingToSql) {
				options.denyQueryEditor = true;
			}

			group.closeEditor(editor.input).then(() => {
				// Reopen a new editor in the same position/index
				QueryEditorService.editorService.openEditor(newEditorInput, options, group).then((editor) => {
					resolve(QueryEditorService._onEditorOpened(editor, uri.toString(), undefined, options.pinned));
				},
					(error) => {
						reject(error);
					});
			});
		});
	}

	////// Private functions

	private createUntitledSqlFilePath(): string {
		return this.createPrefixedSqlFilePath(untitledFilePrefix);
	}

	private createPrefixedSqlFilePath(prefix: string): string {
		let prefixFileName = (counter: number): string => {
			return `${prefix}_${counter}`;
		};

		let counter = 1;
		// Get document name and check if it exists
		let filePath = prefixFileName(counter);
		while (fs.existsSync(filePath)) {
			counter++;
			filePath = prefixFileName(counter);
		}

		let untitledEditors = this._untitledEditorService.getAll();
		while (untitledEditors.find(x => x.getName().toUpperCase() === filePath.toUpperCase())) {
			counter++;
			filePath = prefixFileName(counter);
		}

		return filePath;
	}

	////// Private static functions

	/**
	 * Returns a QueryInput if we are changingToSql. Returns a FileEditorInput if we are !changingToSql.
	 */
	private static _getNewEditorInput(changingToSql: boolean, input: IEditorInput, uri: URI): IEditorInput {
		if (!uri) {
			return undefined;
		}

		let newEditorInput: IEditorInput = undefined;
		if (changingToSql) {
			const queryResultsInput: QueryResultsInput = QueryEditorService.instantiationService.createInstance(QueryResultsInput, uri.toString());
			let queryInput: QueryInput = QueryEditorService.instantiationService.createInstance(QueryInput, '', input, queryResultsInput, undefined);
			newEditorInput = queryInput;
		} else {
			let uriCopy: URI = URI.from({ scheme: uri.scheme, authority: uri.authority, path: uri.path, query: uri.query, fragment: uri.fragment });
			newEditorInput = QueryEditorService.instantiationService.createInstance(FileEditorInput, uriCopy, undefined);
		}

		return newEditorInput;
	}

	/**
	 * Gets the URI for this IEditorInput or returns undefined if one does not exist.
	 */
	private static _getEditorChangeUri(input: IEditorInput, changingToSql: boolean): URI {
		let uriSource: IEditorInput = input;

		// It is assumed that if we got here, !changingToSql is logically equivalent to changingFromSql
		let changingFromSql = !changingToSql;
		if (input instanceof QueryInput && changingFromSql) {
			let queryInput: QueryInput = <QueryInput>input;
			uriSource = queryInput.sql;
		}
		return getSupportedInputResource(uriSource);
	}

	/**
	 * Handle all cleanup actions that need to wait until the editor is fully open.
	 */
	private static _onEditorOpened(editor: IEditor, uri: string, position: Position, isPinned: boolean): ITextModel {

		// Reset the editor pin state
		// TODO: change this so it happens automatically in openEditor in sqlLanguageModeCheck. Performing this here
		// causes the text on the tab to slightly flicker for unpinned files (from non-italic to italic to non-italic).
		// This is currently unavoidable because vscode ignores "pinned" on IEditorOptions if "index" is not undefined,
		// and we need to specify "index"" so the editor tab remains in the same place
		// let group: IEditorGroup = QueryEditorService.editorGroupService.getStacksModel().groupAt(position);
		// if (isPinned) {
		// 	QueryEditorService.editorGroupService.pinEditor(group, editor.input);
		// }

		// @SQLTODO do we need the below
		// else {
		// 	QueryEditorService.editorGroupService.p  .unpinEditor(group, editor.input);
		// }

		// Grab and returns the IModel that will be used to resolve the sqlLanguageModeCheck promise.
		let control = editor.getControl();
		let codeEditor: ICodeEditor = <ICodeEditor>control;
		let newModel = codeEditor ? codeEditor.getModel() : undefined;
		return newModel;
	}
}
