/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsInput } from 'sql/workbench/contrib/query/common/queryResultsInput';
import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';
import { EditDataInput } from 'sql/workbench/contrib/editData/browser/editDataInput';
import { IConnectableInput, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { UntitledQueryEditorInput } from 'sql/workbench/contrib/query/common/untitledQueryEditorInput';

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import * as paths from 'vs/base/common/extpath';
import { isLinux } from 'vs/base/common/platform';
import { Schemas } from 'vs/base/common/network';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { replaceConnection } from 'sql/workbench/browser/taskUtilities';
import { EditDataResultsInput } from 'sql/workbench/contrib/editData/browser/editDataResultsInput';
import { ILogService } from 'vs/platform/log/common/log';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';

/**
 * Service wrapper for opening and creating SQL documents as sql editor inputs
 */
export class QueryEditorService implements IQueryEditorService {

	public _serviceBrand: undefined;

	constructor(
		@IUntitledTextEditorService private _untitledEditorService: IUntitledTextEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ILogService private _logService: ILogService
	) {
	}

	////// Public functions

	/**
	 * Creates new untitled document for SQL query and opens in new editor tab
	 */
	public newSqlEditor(sqlContent?: string, connectionProviderName?: string, isDirty?: boolean, objectName?: string): Promise<IConnectableInput> {
		return new Promise<IConnectableInput>(async (resolve, reject) => {
			try {
				// Create file path and file URI
				let filePath = await this.createUntitledSqlFilePath();
				let docUri: URI = URI.from({ scheme: Schemas.untitled, path: filePath });

				// Create a sql document pane with accoutrements
				const fileInput = this._editorService.createInput({ forceUntitled: true, resource: docUri, mode: 'sql' }) as UntitledTextEditorInput;
				let untitledEditorModel = await fileInput.resolve() as UntitledTextEditorModel;
				if (sqlContent) {
					untitledEditorModel.textEditorModel.setValue(sqlContent);
					if (isDirty === false || (isDirty === undefined && !this._configurationService.getValue<boolean>('sql.promptToSaveGeneratedFiles'))) {
						untitledEditorModel.setDirty(false);
					}
				}

				const queryResultsInput: QueryResultsInput = this._instantiationService.createInstance(QueryResultsInput, docUri.toString());
				let queryInput = this._instantiationService.createInstance(UntitledQueryEditorInput, objectName, fileInput, queryResultsInput);

				this._editorService.openEditor(queryInput, { pinned: true })
					.then((editor) => {
						resolve(editor.input as UntitledQueryEditorInput);
					}, (error) => {
						reject(error);
					});
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Creates new edit data session
	 */
	public async newEditDataEditor(schemaName: string, tableName: string, sqlContent: string): Promise<IConnectableInput> {

		// Create file path and file URI
		let objectName = schemaName ? schemaName + '.' + tableName : tableName;
		let filePath = await this.createPrefixedSqlFilePath(objectName);
		let docUri: URI = URI.from({ scheme: Schemas.untitled, path: filePath });

		// Create a sql document pane with accoutrements
		const fileInput = this._editorService.createInput({ forceUntitled: true, resource: docUri, mode: 'sql' }) as UntitledTextEditorInput;
		const m = await fileInput.resolve() as UntitledTextEditorModel;
		//when associatedResource editor is created it is dirty, this must be set to false to be able to detect changes to the editor.
		m.setDirty(false);
		// Create an EditDataInput for editing
		const resultsInput: EditDataResultsInput = this._instantiationService.createInstance(EditDataResultsInput, docUri.toString());
		let editDataInput: EditDataInput = this._instantiationService.createInstance(EditDataInput, docUri, schemaName, tableName, fileInput, sqlContent, resultsInput);
		if (sqlContent) {
			//Setting the value of the textEditorModel to sqlContent marks editor as dirty, editDataInput handles it.
			m.textEditorModel.setValue(sqlContent);
		}
		const editor = await this._editorService.openEditor(editDataInput, { pinned: true });
		let params = editor.input as EditDataInput;
		return params;
	}

	onSaveAsCompleted(oldResource: URI, newResource: URI): void {
		let oldResourceString: string = oldResource.toString();

		this._editorService.editors.forEach(input => {
			if (input instanceof QueryEditorInput) {
				const resource = input.getResource();

				// Update Editor if file (or any parent of the input) got renamed or moved
				// Note: must check the new file name for this since this method is called after the rename is completed
				if (paths.isEqualOrParent(resource.fsPath, newResource.fsPath, !isLinux /* ignorecase */)) {
					// In this case, we know that this is a straight rename so support this as a rename / replace operation
					replaceConnection(oldResourceString, newResource.toString(), this._connectionManagementService).then(result => {
						if (result && result.connected) {
							input.onConnectSuccess();
						} else {
							input.onConnectReject();
						}
					}).catch((e) => this._logService.error(e));
				}
			}
		});
	}

	////// Private functions

	private createUntitledSqlFilePath(): Promise<string> {
		return this.createPrefixedSqlFilePath('SQLQuery');
	}

	private async createPrefixedSqlFilePath(prefix: string): Promise<string> {
		let prefixFileName = (counter: number): string => {
			return `${prefix}_${counter}`;
		};

		let counter = 1;
		// Get document name and check if it exists
		let filePath = prefixFileName(counter);
		while (this._untitledEditorService.get(URI.from({ scheme: Schemas.untitled, path: filePath }))) {
			counter++;
			filePath = prefixFileName(counter);
		}

		return filePath;
	}
}
