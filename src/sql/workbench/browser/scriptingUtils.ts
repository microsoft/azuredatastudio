/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import * as nls from 'vs/nls';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IScriptingService, ScriptOperation } from 'sql/platform/scripting/common/scriptingService';

// map for the version of SQL Server (default is 140)
const scriptCompatibilityOptionMap = {
	90: 'Script90Compat',
	100: 'Script100Compat',
	105: 'Script105Compat',
	110: 'Script110Compat',
	120: 'Script120Compat',
	130: 'Script130Compat',
	140: 'Script140Compat'
};

// map for the target database engine edition (default is Enterprise)
const targetDatabaseEngineEditionMap = {
	0: 'SqlServerEnterpriseEdition',
	1: 'SqlServerPersonalEdition',
	2: 'SqlServerStandardEdition',
	3: 'SqlServerEnterpriseEdition',
	4: 'SqlServerExpressEdition',
	5: 'SqlAzureDatabaseEdition',
	6: 'SqlDatawarehouseEdition',
	7: 'SqlServerStretchEdition',
	11: 'SqlServerOnDemandEdition',
};

/**
 * Select the top rows from an object
 */
export async function scriptSelect(connectionProfile: IConnectionProfile, metadata: azdata.ObjectMetadata, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<boolean> {
	const connectionResult = await connectionService.connectIfNotConnected(connectionProfile);
	let paramDetails: azdata.ScriptingParamDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
	const result = await scriptingService.script(connectionResult, metadata, ScriptOperation.Select, paramDetails);
	if (result && result.script) {
		const owner = await queryEditorService.newSqlEditor({ initalContent: result.script });
		// Connect our editor to the input connection
		let options: IConnectionCompletionOptions = {
			params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery, input: owner },
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};
		const innerConnectionResult = await connectionService.connect(connectionProfile, owner.uri, options);

		return Boolean(innerConnectionResult) && innerConnectionResult.connected;
	} else {
		let errMsg: string = nls.localize('scriptSelectNotFound', "No script was returned when calling select script on object ");
		throw new Error(errMsg.concat(metadata.metadataTypeName));
	}
}

/**
 * Opens a new Edit Data session
 */
export async function scriptEditSelect(connectionProfile: IConnectionProfile, metadata: azdata.ObjectMetadata, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<boolean> {
	const connectionResult = await connectionService.connectIfNotConnected(connectionProfile);
	let paramDetails: azdata.ScriptingParamDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
	const result = await scriptingService.script(connectionResult, metadata, ScriptOperation.Select, paramDetails);
	if (result && result.script) {
		const owner = await queryEditorService.newEditDataEditor(metadata.schema, metadata.name, result.script);
		// Connect our editor
		let options: IConnectionCompletionOptions = {
			params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: owner },
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};
		const innerConnectionResult = await connectionService.connect(connectionProfile, owner.uri, options);

		return Boolean(innerConnectionResult) && innerConnectionResult.connected;
	} else {
		let errMsg: string = nls.localize('scriptSelectNotFound', "No script was returned when calling select script on object ");
		throw new Error(errMsg.concat(metadata.metadataTypeName));
	}
}



export function GetScriptOperationName(operation: ScriptOperation) {
	let defaultName: string = ScriptOperation[operation];
	switch (operation) {
		case ScriptOperation.Select:
			return nls.localize('selectOperationName', "Select");
		case ScriptOperation.Create:
			return nls.localize('createOperationName', "Create");
		case ScriptOperation.Insert:
			return nls.localize('insertOperationName', "Insert");
		case ScriptOperation.Update:
			return nls.localize('updateOperationName', "Update");
		case ScriptOperation.Delete:
			return nls.localize('deleteOperationName', "Delete");
		default:
			// return the raw, non-localized string name
			return defaultName;
	}
}

/**
 * Script the object as a statement based on the provided action (except Select)
 */
export async function script(connectionProfile: IConnectionProfile, metadata: azdata.ObjectMetadata,
	connectionService: IConnectionManagementService,
	queryEditorService: IQueryEditorService,
	scriptingService: IScriptingService,
	operation: ScriptOperation,
	errorMessageService: IErrorMessageService): Promise<boolean> {
	const connectionResult = await connectionService.connectIfNotConnected(connectionProfile);
	let paramDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
	const result = await scriptingService.script(connectionResult, metadata, operation, paramDetails);
	if (result) {
		let script: string = result.script;

		if (script) {
			let description = (metadata.schema && metadata.schema !== '') ? `${metadata.schema}.${metadata.name}` : metadata.name;
			const owner = await queryEditorService.newSqlEditor({ initalContent: script, description });
			// Connect our editor to the input connection
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: owner },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			const innerConnectionResult = await connectionService.connect(connectionProfile, owner.uri, options);

			return Boolean(innerConnectionResult) && innerConnectionResult.connected;

		} else {
			let scriptNotFoundMsg = nls.localize('scriptNotFoundForObject', "No script was returned when scripting as {0} on object {1}",
				GetScriptOperationName(operation), metadata.metadataTypeName);
			let messageDetail = '';
			let operationResult = scriptingService.getOperationFailedResult(result.operationId);
			if (operationResult && operationResult.hasError && operationResult.errorMessage) {
				scriptNotFoundMsg = operationResult.errorMessage;
				messageDetail = operationResult.errorDetails;
			}
			if (errorMessageService) {
				let title = nls.localize('scriptingFailed', "Scripting Failed");
				errorMessageService.showDialog(Severity.Error, title, scriptNotFoundMsg, messageDetail);
			}
			throw new Error(scriptNotFoundMsg);
		}
	} else {
		throw new Error(nls.localize('scriptNotFound', "No script was returned when scripting as {0}", GetScriptOperationName(operation)));
	}
}

function getScriptingParamDetails(connectionService: IConnectionManagementService, ownerUri: string, metadata: azdata.ObjectMetadata): azdata.ScriptingParamDetails {
	let serverInfo: azdata.ServerInfo = getServerInfo(connectionService, ownerUri);
	let paramDetails: azdata.ScriptingParamDetails = {
		filePath: undefined,
		scriptCompatibilityOption: scriptCompatibilityOptionMap[serverInfo.serverMajorVersion],
		targetDatabaseEngineEdition: targetDatabaseEngineEditionMap[serverInfo.engineEditionId],
		targetDatabaseEngineType: serverInfo.isCloud ? 'SqlAzure' : 'SingleInstance'
	};
	return paramDetails;
}

function getServerInfo(connectionService: IConnectionManagementService, ownerUri: string): azdata.ServerInfo {
	let connection: ConnectionManagementInfo = connectionService.getConnectionInfo(ownerUri);
	return connection.serverInfo;
}
