/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { EditDataInput } from 'sql/workbench/browser/editData/editDataInput';
import { ConnectionType, IConnectableInput, IConnectionCompletionOptions, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorService, INewSqlEditorOptions } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { UntitledQueryEditorInput } from 'sql/base/query/browser/untitledQueryEditorInput';

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { EditDataResultsInput } from 'sql/workbench/browser/editData/editDataResultsInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { mixin } from 'vs/base/common/objects';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

const defaults: INewSqlEditorOptions = {
	open: true
};

/**
 * Service wrapper for opening and creating SQL documents as sql editor inputs
 */
export class QueryEditorService implements IQueryEditorService {

	public _serviceBrand: undefined;

	constructor(
		@IUntitledTextEditorService private _untitledEditorService: IUntitledTextEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService
	) {
	}

	////// Public functions

	/**
	 * Creates new untitled document for SQL/Kusto query and opens in new editor tab
	 */
	public async newSqlEditor(options: INewSqlEditorOptions = {}, connectionProviderName?: string): Promise<UntitledQueryEditorInput> {
		options = mixin(options, defaults, false);
		// Create file path and file URI
		let docUri: URI = options.resource ?? URI.from({ scheme: Schemas.untitled, path: await this.createUntitledSqlFilePath(connectionProviderName) });

		// Create a sql document pane with accoutrements
		const fileInput = this._editorService.createEditorInput({ forceUntitled: true, resource: docUri, mode: this._connectionManagementService.getProviderLanguageMode(connectionProviderName) }) as UntitledTextEditorInput;
		let untitledEditorModel = await fileInput.resolve();
		if (options.initalContent) {
			untitledEditorModel.textEditorModel.setValue(options.initalContent);
			if (options.dirty === false || (options.dirty === undefined && !this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').promptToSaveGeneratedFiles)) {
				(untitledEditorModel as UntitledTextEditorModel).setDirty(false);
			}
		}

		const queryResultsInput: QueryResultsInput = this._instantiationService.createInstance(QueryResultsInput, docUri.toString());
		let queryInput = this._instantiationService.createInstance(UntitledQueryEditorInput, options.description, fileInput, queryResultsInput);
		let profile: IConnectionProfile | undefined = undefined;
		// If we're told to connect then get the connection before opening the editor since it will try to get the connection for the current
		// active editor and so we need to get this before opening a new one.
		if (options.connectWithGlobal) {
			profile = getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._editorService);
		}
		if (options.open) {
			await this._editorService.openEditor(queryInput, { pinned: true });
		}
		if (profile) {
			const options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: undefined, input: queryInput },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			this._connectionManagementService.connect(profile, queryInput.uri, options).catch(err => onUnexpectedError(err));
		}
		return queryInput;
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
		const fileInput = this._editorService.createEditorInput({ forceUntitled: true, resource: docUri, mode: 'sql' }) as UntitledTextEditorInput;
		const m = await fileInput.resolve();
		//when associatedResource editor is created it is dirty, this must be set to false to be able to detect changes to the editor.
		(m as UntitledTextEditorModel).setDirty(false);
		// Create an EditDataInput for editing
		const resultsInput: EditDataResultsInput = this._instantiationService.createInstance(EditDataResultsInput, docUri.toString());
		let editDataInput: EditDataInput = this._instantiationService.createInstance(EditDataInput, docUri, schemaName, tableName, fileInput, sqlContent, resultsInput);
		// Determine whether to show edit data upon opening.
		editDataInput.queryPaneEnabled = this._configurationService.getValue('editor.showEditDataSqlPaneOnStartup');
		if (sqlContent) {
			//Setting the value of the textEditorModel to sqlContent marks editor as dirty, editDataInput handles it.
			m.textEditorModel.setValue(sqlContent);
		}
		const editor = (await this._editorService.openEditor(editDataInput, { pinned: true }))!;
		let params = editor.input as EditDataInput;
		return params;
	}

	////// Private functions
	private createUntitledSqlFilePath(providerName?: string): Promise<string> {
		if (providerName === 'LOGANALYTICS' || providerName === 'KUSTO') {
			return this.createPrefixedSqlFilePath('KQLQuery');
		}

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
