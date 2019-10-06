/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'vs/base/common/path';
import * as os from 'os';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, IConnectableInput, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import * as nls from 'vs/nls';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IScriptingService, ScriptOperation } from 'sql/platform/scripting/common/scriptingService';
import { EditDataInput } from 'sql/workbench/parts/editData/browser/editDataInput';

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
	7: 'SqlServerStretchEdition'
};

/**
 * Select the top rows from an object
 */
export function scriptSelect(connectionProfile: IConnectionProfile, metadata: azdata.ObjectMetadata, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectionService.connectIfNotConnected(connectionProfile).then(connectionResult => {
			let paramDetails: azdata.ScriptingParamDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
			scriptingService.script(connectionResult, metadata, ScriptOperation.Select, paramDetails).then(result => {
				if (result && result.script) {
					queryEditorService.newSqlEditor(result.script).then((owner: IConnectableInput) => {
						// Connect our editor to the input connection
						let options: IConnectionCompletionOptions = {
							params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery, input: owner },
							saveTheConnection: false,
							showDashboard: false,
							showConnectionDialogOnError: true,
							showFirewallRuleOnError: true
						};
						connectionService.connect(connectionProfile, owner.uri, options).then(() => {
							resolve();
						});
					}).catch(editorError => {
						reject(editorError);
					});
				} else {
					let errMsg: string = nls.localize('scriptSelectNotFound', "No script was returned when calling select script on object ");
					reject(errMsg.concat(metadata.metadataTypeName));
				}
			}, scriptError => {
				reject(scriptError);
			});
		});
	});
}

/**
 * Opens a new Edit Data session
 */
export function scriptEditSelect(connectionProfile: IConnectionProfile, metadata: azdata.ObjectMetadata, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectionService.connectIfNotConnected(connectionProfile).then(connectionResult => {
			let paramDetails: azdata.ScriptingParamDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
			scriptingService.script(connectionResult, metadata, ScriptOperation.Select, paramDetails).then(result => {
				if (result && result.script) {
					queryEditorService.newEditDataEditor(metadata.schema, metadata.name, result.script).then((owner: EditDataInput) => {
						// Connect our editor
						let options: IConnectionCompletionOptions = {
							params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: owner },
							saveTheConnection: false,
							showDashboard: false,
							showConnectionDialogOnError: true,
							showFirewallRuleOnError: true
						};
						connectionService.connect(connectionProfile, owner.uri, options).then(() => {
							resolve();
						});
					}).catch(editorError => {
						reject(editorError);
					});
				} else {
					let errMsg: string = nls.localize('scriptSelectNotFound', "No script was returned when calling select script on object ");
					reject(errMsg.concat(metadata.metadataTypeName));
				}
			}, scriptError => {
				reject(scriptError);
			});
		});
	});
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
export function script(connectionProfile: IConnectionProfile, metadata: azdata.ObjectMetadata,
	connectionService: IConnectionManagementService,
	queryEditorService: IQueryEditorService,
	scriptingService: IScriptingService,
	operation: ScriptOperation,
	errorMessageService: IErrorMessageService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectionService.connectIfNotConnected(connectionProfile).then(connectionResult => {
			let paramDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
			scriptingService.script(connectionResult, metadata, operation, paramDetails).then(result => {
				if (result) {
					let script: string = result.script;

					if (script) {
						let description = (metadata.schema && metadata.schema !== '') ? `${metadata.schema}.${metadata.name}` : metadata.name;
						queryEditorService.newSqlEditor(script, connectionProfile.providerName, undefined, description).then((owner) => {
							// Connect our editor to the input connection
							let options: IConnectionCompletionOptions = {
								params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: owner },
								saveTheConnection: false,
								showDashboard: false,
								showConnectionDialogOnError: true,
								showFirewallRuleOnError: true
							};
							connectionService.connect(connectionProfile, owner.uri, options).then(() => {
								resolve();
							});
						}).catch(editorError => {
							reject(editorError);
						});
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
						reject(scriptNotFoundMsg);
					}
				} else {
					reject(nls.localize('scriptNotFound', "No script was returned when scripting as {0}", GetScriptOperationName(operation)));
				}
			}, scriptingError => {
				reject(scriptingError);
			});
		}).catch(connectionError => {
			reject(connectionError);
		});
	});
}

function getScriptingParamDetails(connectionService: IConnectionManagementService, ownerUri: string, metadata: azdata.ObjectMetadata): azdata.ScriptingParamDetails {
	let serverInfo: azdata.ServerInfo = getServerInfo(connectionService, ownerUri);
	let paramDetails: azdata.ScriptingParamDetails = {
		filePath: getFilePath(metadata),
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

function getFilePath(metadata: azdata.ObjectMetadata): string {
	let schemaName: string = metadata.schema;
	let objectName: string = metadata.name;
	let timestamp = Date.now().toString();
	if (schemaName !== null) {
		return path.join(os.tmpdir(), `${schemaName}.${objectName}_${timestamp}.txt`);
	} else {
		return path.join(os.tmpdir(), `${objectName}_${timestamp}.txt`);
	}
}
