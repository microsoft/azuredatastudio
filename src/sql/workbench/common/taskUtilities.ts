/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import {
	IConnectableInput, IConnectionManagementService,
	IConnectionCompletionOptions, ConnectionType, IErrorMessageService,
	RunQueryOnConnectionMode, IConnectionResult
} from 'sql/parts/connection/common/connectionManagement';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { IScriptingService } from 'sql/services/scripting/scriptingService';
import { EditDataInput } from 'sql/parts/editData/common/editDataInput';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import { IDisasterRecoveryUiService, IRestoreDialogController } from 'sql/parts/disasterRecovery/common/interfaces';
import { IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { IInsightsDialogService } from 'sql/parts/insights/common/interfaces';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import Severity from 'vs/base/common/severity';
import data = require('data');
import nls = require('vs/nls');
import os = require('os');
import path = require('path');

// map for the version of SQL Server (default is 140)
let scriptCompatibilityOptionMap = new Map<number, string>();
scriptCompatibilityOptionMap.set(90, "Script90Compat");
scriptCompatibilityOptionMap.set(100, "Script100Compat");
scriptCompatibilityOptionMap.set(105, "Script105Compat");
scriptCompatibilityOptionMap.set(110, "Script110Compat");
scriptCompatibilityOptionMap.set(120, "Script120Compat");
scriptCompatibilityOptionMap.set(130, "Script130Compat");
scriptCompatibilityOptionMap.set(140, "Script140Compat");

// map for the target database engine edition (default is Enterprise)
let targetDatabaseEngineEditionMap = new Map<number, string>();
targetDatabaseEngineEditionMap.set(0, "SqlServerEnterpriseEdition");
targetDatabaseEngineEditionMap.set(1, "SqlServerPersonalEdition");
targetDatabaseEngineEditionMap.set(2, "SqlServerStandardEdition");
targetDatabaseEngineEditionMap.set(3, "SqlServerEnterpriseEdition");
targetDatabaseEngineEditionMap.set(4, "SqlServerExpressEdition");
targetDatabaseEngineEditionMap.set(5, "SqlAzureDatabaseEdition");
targetDatabaseEngineEditionMap.set(6, "SqlDatawarehouseEdition");
targetDatabaseEngineEditionMap.set(7, "SqlServerStretchEdition");

// map for object types for scripting
let objectScriptMap = new Map<string, string>();
objectScriptMap.set("Table", "Table");
objectScriptMap.set("View", "View");
objectScriptMap.set("StoredProcedure", "Procedure");
objectScriptMap.set("UserDefinedFunction", "Function");
objectScriptMap.set("UserDefinedDataType", "Type");
objectScriptMap.set("User", "User");
objectScriptMap.set("Default", "Default");
objectScriptMap.set("Rule", "Rule");
objectScriptMap.set("DatabaseRole", "Role");
objectScriptMap.set("ApplicationRole", "Application Role");
objectScriptMap.set("SqlAssembly", "Assembly");
objectScriptMap.set("DdlTrigger", "Trigger");
objectScriptMap.set("Synonym", "Synonym");
objectScriptMap.set("XmlSchemaCollection", "Xml Schema Collection");
objectScriptMap.set("Schema", "Schema");
objectScriptMap.set("PlanGuide", "sp_create_plan_guide");
objectScriptMap.set("UserDefinedType", "Type");
objectScriptMap.set("UserDefinedAggregate", "Aggregate");
objectScriptMap.set("FullTextCatalog", "Fulltext Catalog");
objectScriptMap.set("UserDefinedTableType", "Type");
objectScriptMap.set("MaterializedView", "Materialized View");

export enum ScriptOperation {
	Select = 0,
	Create = 1,
	Insert = 2,
	Update = 3,
	Delete = 4
}

export function GetScriptOperationName(operation: ScriptOperation) {
	let defaultName: string = ScriptOperation[operation];
	switch(operation) {
		case ScriptOperation.Select:
			return nls.localize('selectOperationName', 'Select');
		case ScriptOperation.Create:
			return nls.localize('createOperationName', 'Create');
		case ScriptOperation.Insert:
			return nls.localize('insertOperationName', 'Insert');
		case ScriptOperation.Update:
			return nls.localize('updateOperationName', 'Update');
		case ScriptOperation.Delete:
			return nls.localize('deleteOperationName', 'Delete');
		default:
			// return the raw, non-localized string name
			return defaultName;
	}
}

export function connectIfNotAlreadyConnected(connectionProfile: IConnectionProfile, connectionService: IConnectionManagementService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let connectionID = connectionService.getConnectionId(connectionProfile);
		let uri: string = connectionService.getFormattedUri(connectionID, connectionProfile);
		if (!connectionService.isConnected(uri)) {
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery, input: undefined },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: false,
				showFirewallRuleOnError: true
			};
			connectionService.connect(connectionProfile, uri, options).then(() => {
				setTimeout(function () {
					resolve();
				}, 2000);
			}).catch(connectionError => {
				reject(connectionError);
			});
		} else {
			resolve();
		}
	});
}

/**
 * Select the top rows from an object
 */
export function scriptSelect(connectionProfile: IConnectionProfile, metadata: data.ObjectMetadata, ownerUri: string, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectIfNotAlreadyConnected(connectionProfile, connectionService).then(connectionResult => {
			let paramDetails: data.ScriptingParamDetails = getScriptingParamDetails(connectionService, ownerUri, metadata);
			scriptingService.script(ownerUri, metadata, ScriptOperation.Select, paramDetails).then(result => {
				if (result.script) {
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
					let errMsg: string = nls.localize('scriptSelectNotFound', 'No script was returned when calling select script on object ');
					reject(errMsg.concat(metadata.metadataTypeName));
				}
			}, scriptError => {
				reject(scriptError);
			})
		});
	});
}

/**
 * Opens a new Edit Data session
 */
export function editData(connectionProfile: IConnectionProfile, tableName: string, schemaName: string, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService): Promise<void> {
	return new Promise<void>((resolve) => {
		queryEditorService.newEditDataEditor(schemaName, tableName).then((owner: EditDataInput) => {
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
		});
	});
}

/**
 * Script the object as a statement based on the provided action (except Select)
 */
export function script(connectionProfile: IConnectionProfile, metadata: data.ObjectMetadata, ownerUri: string,
	connectionService: IConnectionManagementService,
	queryEditorService: IQueryEditorService,
	scriptingService: IScriptingService,
	operation: ScriptOperation,
	errorMessageService: IErrorMessageService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectIfNotAlreadyConnected(connectionProfile, connectionService).then(connectionResult => {
			let paramDetails = getScriptingParamDetails(connectionService, ownerUri, metadata);
			scriptingService.script(ownerUri, metadata, operation, paramDetails).then(result => {
				if (result) {
					let script: string = result.script;
					let startPos: number = 0;
					if (connectionProfile.providerName === "MSSQL") {
						startPos = getStartPos(script, operation, metadata.metadataTypeName);
					}
					if (startPos >= 0) {
						script = script.substring(startPos);
						queryEditorService.newSqlEditor(script, connectionProfile.providerName).then(() => {
							resolve();
						}).catch(editorError => {
							reject(editorError);
						});
					}
					else {
						let scriptNotFoundMsg = nls.localize('scriptNotFoundForObject', 'No script was returned when scripting as {0} on object {1}',
													GetScriptOperationName(operation), metadata.metadataTypeName);
						let operationResult = scriptingService.getOperationFailedResult(result.operationId);
						if (operationResult && operationResult.hasError && operationResult.errorMessage) {
							scriptNotFoundMsg = operationResult.errorMessage;
						}
						if (errorMessageService) {
							let title = nls.localize('scriptingFailed', 'Scripting Failed');
							errorMessageService.showDialog(Severity.Error, title, scriptNotFoundMsg);
						}
						reject(scriptNotFoundMsg);
					}
				} else {
					reject(nls.localize('scriptNotFound', 'No script was returned when scripting as {0}', GetScriptOperationName(operation)));
				}
			}, scriptingError => {
				reject(scriptingError);
			});
		}).catch(connectionError => {
			reject(connectionError);
		});
	});
}

export function newQuery(
	connectionProfile: IConnectionProfile,
	connectionService: IConnectionManagementService,
	queryEditorService: IQueryEditorService,
	sqlContent?: string,
	executeOnOpen: RunQueryOnConnectionMode = RunQueryOnConnectionMode.none
): Promise<void> {
	return new Promise<void>((resolve) => {
		queryEditorService.newSqlEditor(sqlContent).then((owner: IConnectableInput) => {
			// Connect our editor to the input connection
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: executeOnOpen, input: owner },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			connectionService.connect(connectionProfile, owner.uri, options).then(() => {
				resolve();
			});
		});
	});
}

export function replaceConnection(oldUri: string, newUri: string, connectionService: IConnectionManagementService): Promise<IConnectionResult> {
	return new Promise<IConnectionResult>((resolve, reject) => {
		let defaultResult: IConnectionResult = {
			connected: false,
			errorMessage: undefined,
			errorCode: undefined
		};
		if (connectionService) {
			let connectionProfile = connectionService.getConnectionProfile(oldUri);
			if (connectionProfile) {
				let options: IConnectionCompletionOptions = {
					params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none },
					saveTheConnection: false,
					showDashboard: false,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true
				};
				connectionService.disconnect(oldUri).then(() => {
					connectionService.connect(connectionProfile, newUri, options).then(result => {
						resolve(result);
					}, connectError => {
						reject(connectError);
					});
				}, disconnectError => {
					reject(disconnectError);
				});

			} else {
				resolve(defaultResult);
			}
		} else {
			resolve(defaultResult);
		}
	});
}

export function showCreateDatabase(
	connection: IConnectionProfile,
	adminService: IAdminService,
	errorMessageService: IErrorMessageService): Promise<void> {

	return new Promise<void>((resolve) => {
		// show not implemented
		errorMessageService.showDialog(Severity.Info,
			'Coming Soon',
			'This feature is not yet implemented.  It will be available in an upcoming release.');

		// adminService.showCreateDatabaseWizard(uri, connection);
	});
}

export function showCreateLogin(uri: string, connection: IConnectionProfile, adminService: IAdminService): Promise<void> {
	return new Promise<void>((resolve) => {
		adminService.showCreateLoginWizard(uri, connection);
	});
}

export function showBackup(connection: IConnectionProfile, disasterRecoveryUiService: IDisasterRecoveryUiService): Promise<void> {
	return new Promise<void>((resolve) => {
		disasterRecoveryUiService.showBackup(connection);
	});
}

export function showRestore(connection: IConnectionProfile, restoreDialogService: IRestoreDialogController): Promise<void> {
	return new Promise<void>((resolve) => {
		restoreDialogService.showDialog(connection);
	});
}

export function openInsight(query: IInsightsConfig, profile: IConnectionProfile, insightDialogService: IInsightsDialogService) {
	insightDialogService.show(query, profile);
}

/* Helper Methods */
function getStartPos(script: string, operation: ScriptOperation, typeName: string): number {
	let objectTypeName = objectScriptMap.get(typeName);
	if (objectTypeName && script) {
		let scriptTypeName = objectTypeName.toLowerCase();
		switch (operation) {
			case (ScriptOperation.Create):
				return script.toLowerCase().indexOf(`create ${scriptTypeName}`);
			case (ScriptOperation.Delete):
				return script.toLowerCase().indexOf(`drop ${scriptTypeName}`);
			default:
				/* script wasn't found for that object */
				return -1;
		}
	} else {
		return -1;
	}
}


function getScriptingParamDetails(connectionService: IConnectionManagementService, ownerUri: string, metadata: data.ObjectMetadata): data.ScriptingParamDetails {
	let serverInfo: data.ServerInfo = getServerInfo(connectionService, ownerUri);
	let paramDetails: data.ScriptingParamDetails = {
		filePath: getFilePath(metadata),
		scriptCompatibilityOption: scriptCompatibilityOptionMap[serverInfo.serverMajorVersion],
		targetDatabaseEngineEdition: targetDatabaseEngineEditionMap[serverInfo.engineEditionId],
		targetDatabaseEngineType: serverInfo.isCloud ? 'SqlAzure' : 'SingleInstance'
	}
	return paramDetails;
}

function getFilePath(metadata: data.ObjectMetadata): string {
	let schemaName: string = metadata.schema;
	let objectName: string = metadata.name;
	let timestamp = Date.now().toString();
	if (schemaName !== null) {
		return path.join(os.tmpdir(), `${schemaName}.${objectName}_${timestamp}.txt`);
	} else {
		return path.join(os.tmpdir(), `${objectName}_${timestamp}.txt`);
	}
}

function getServerInfo(connectionService: IConnectionManagementService, ownerUri: string): data.ServerInfo {
	let connection: ConnectionManagementInfo = connectionService.getConnectionInfo(ownerUri);
	return connection.serverInfo;
}