/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as os from 'os';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import {
	IConnectableInput, IConnectionManagementService,
	IConnectionCompletionOptions, ConnectionType,
	RunQueryOnConnectionMode, IConnectionResult
} from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { EditDataInput } from 'sql/parts/editData/common/editDataInput';
import { IAdminService } from 'sql/workbench/services/admin/common/adminService';
import { IRestoreDialogController } from 'sql/platform/restore/common/restoreService';
import { IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { IInsightsDialogService } from 'sql/workbench/services/insights/common/insightsDialogService';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { DashboardInput } from 'sql/parts/dashboard/dashboardInput';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';

import * as sqlops from 'sqlops';

import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import * as path from 'vs/base/common/paths';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

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

// map for object types for scripting
const objectScriptMap = {
	Table: 'Table',
	View: 'View',
	StoredProcedure: 'Procedure',
	UserDefinedFunction: 'Function',
	UserDefinedDataType: 'Type',
	User: 'User',
	Default: 'Default',
	Rule: 'Rule',
	DatabaseRole: 'Role',
	ApplicationRole: 'Application Role',
	SqlAssembly: 'Assembly',
	DdlTrigger: 'Trigger',
	Synonym: 'Synonym',
	XmlSchemaCollection: 'Xml Schema Collection',
	Schema: 'Schema',
	PlanGuide: 'sp_create_plan_guide',
	UserDefinedType: 'Type',
	UserDefinedAggregate: 'Aggregate',
	FullTextCatalog: 'Fulltext Catalog',
	UserDefinedTableType: 'Type',
	MaterializedView: 'Materialized View'
};

export enum ScriptOperation {
	Select = 0,
	Create = 1,
	Insert = 2,
	Update = 3,
	Delete = 4,
	Execute = 5,
	Alter = 6
}

export function GetScriptOperationName(operation: ScriptOperation) {
	let defaultName: string = ScriptOperation[operation];
	switch (operation) {
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
		let connectionID = connectionService.getConnectionUri(connectionProfile);
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
export function scriptSelect(connectionProfile: IConnectionProfile, metadata: sqlops.ObjectMetadata, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectionService.connectIfNotConnected(connectionProfile).then(connectionResult => {
			let paramDetails: sqlops.ScriptingParamDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
			scriptingService.script(connectionResult, metadata, ScriptOperation.Select, paramDetails).then(result => {
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
			});
		});
	});
}

/**
 * Opens a new Edit Data session
 */
export function scriptEditSelect(connectionProfile: IConnectionProfile, metadata: sqlops.ObjectMetadata, connectionService: IConnectionManagementService, queryEditorService: IQueryEditorService, scriptingService: IScriptingService): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		connectionService.connectIfNotConnected(connectionProfile).then(connectionResult => {
			let paramDetails: sqlops.ScriptingParamDetails = getScriptingParamDetails(connectionService, connectionResult, metadata);
			scriptingService.script(connectionResult, metadata, ScriptOperation.Select, paramDetails).then(result => {
				if (result.script) {
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
					let errMsg: string = nls.localize('scriptSelectNotFound', 'No script was returned when calling select script on object ');
					reject(errMsg.concat(metadata.metadataTypeName));
				}
			}, scriptError => {
				reject(scriptError);
			});
		});
	});
}

/**
 * Script the object as a statement based on the provided action (except Select)
 */
export function script(connectionProfile: IConnectionProfile, metadata: sqlops.ObjectMetadata,
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
						queryEditorService.newSqlEditor(script, connectionProfile.providerName).then((owner) => {
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
						let scriptNotFoundMsg = nls.localize('scriptNotFoundForObject', 'No script was returned when scripting as {0} on object {1}',
							GetScriptOperationName(operation), metadata.metadataTypeName);
						let messageDetail = '';
						let operationResult = scriptingService.getOperationFailedResult(result.operationId);
						if (operationResult && operationResult.hasError && operationResult.errorMessage) {
							scriptNotFoundMsg = operationResult.errorMessage;
							messageDetail = operationResult.errorDetails;
						}
						if (errorMessageService) {
							let title = nls.localize('scriptingFailed', 'Scripting Failed');
							errorMessageService.showDialog(Severity.Error, title, scriptNotFoundMsg, messageDetail);
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
	objectExplorerService: IObjectExplorerService,
	workbenchEditorService: IEditorService,
	sqlContent?: string,
	executeOnOpen: RunQueryOnConnectionMode = RunQueryOnConnectionMode.none
): Promise<void> {
	return new Promise<void>((resolve) => {
		if (!connectionProfile) {
			connectionProfile = getCurrentGlobalConnection(objectExplorerService, connectionService, workbenchEditorService);
		}
		queryEditorService.newSqlEditor(sqlContent).then((owner: IConnectableInput) => {
			// Connect our editor to the input connection
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: executeOnOpen, input: owner },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			if (connectionProfile) {
				connectionService.connect(connectionProfile, owner.uri, options).then(() => {
					resolve();
				});
			} else {
				resolve();
			}
		});
	});
}

export function replaceConnection(oldUri: string, newUri: string, connectionService: IConnectionManagementService): Promise<IConnectionResult> {
	return new Promise<IConnectionResult>((resolve, reject) => {
		let defaultResult: IConnectionResult = {
			connected: false,
			errorMessage: undefined,
			errorCode: undefined,
			callStack: undefined
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

export function showBackup(connection: IConnectionProfile, backupUiService: IBackupUiService): Promise<void> {
	return new Promise<void>((resolve) => {
		backupUiService.showBackup(connection).then(() => {
			resolve(void 0);
		});
	});
}

export function showRestore(connection: IConnectionProfile, restoreDialogService: IRestoreDialogController): Promise<void> {
	return new Promise<void>((resolve) => {
		restoreDialogService.showDialog(connection).then(() => {
			resolve(void 0);
		});
	});
}

export function openInsight(query: IInsightsConfig, profile: IConnectionProfile, insightDialogService: IInsightsDialogService) {
	insightDialogService.show(query, profile);
}

/**
 * Get the current global connection, which is the connection from the active editor, unless OE
 * is focused or there is no such editor, in which case it comes from the OE selection. Returns
 * undefined when there is no such connection.
 *
 * @param objectExplorerService
 * @param connectionManagementService
 * @param workbenchEditorService
 * @param topLevelOnly If true, only return top-level (i.e. connected) Object Explorer connections instead of database connections when appropriate
*/
export function getCurrentGlobalConnection(objectExplorerService: IObjectExplorerService, connectionManagementService: IConnectionManagementService, workbenchEditorService: IEditorService, topLevelOnly: boolean = false): IConnectionProfile {
	let connection: IConnectionProfile;

	let objectExplorerSelection = objectExplorerService.getSelectedProfileAndDatabase();
	if (objectExplorerSelection) {
		let objectExplorerProfile = objectExplorerSelection.profile;
		if (connectionManagementService.isProfileConnected(objectExplorerProfile)) {
			if (objectExplorerSelection.databaseName && !topLevelOnly) {
				connection = objectExplorerProfile.cloneWithDatabase(objectExplorerSelection.databaseName);
			} else {
				connection = objectExplorerProfile;
			}
		}
		if (objectExplorerService.isFocused()) {
			return connection;
		}
	}

	let activeInput = workbenchEditorService.activeEditor;
	if (activeInput) {
		if (activeInput instanceof QueryInput || activeInput instanceof EditDataInput || activeInput instanceof DashboardInput) {
			connection = connectionManagementService.getConnectionProfile(activeInput.uri);
		}
		else if (activeInput instanceof ProfilerInput) {
			connection = activeInput.connection;
		}
	}

	return connection;
}

/* Helper Methods */
function getStartPos(script: string, operation: ScriptOperation, typeName: string): number {
	let objectTypeName = objectScriptMap[typeName];
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


function getScriptingParamDetails(connectionService: IConnectionManagementService, ownerUri: string, metadata: sqlops.ObjectMetadata): sqlops.ScriptingParamDetails {
	let serverInfo: sqlops.ServerInfo = getServerInfo(connectionService, ownerUri);
	let paramDetails: sqlops.ScriptingParamDetails = {
		filePath: getFilePath(metadata),
		scriptCompatibilityOption: scriptCompatibilityOptionMap[serverInfo.serverMajorVersion],
		targetDatabaseEngineEdition: targetDatabaseEngineEditionMap[serverInfo.engineEditionId],
		targetDatabaseEngineType: serverInfo.isCloud ? 'SqlAzure' : 'SingleInstance'
	};
	return paramDetails;
}

function getFilePath(metadata: sqlops.ObjectMetadata): string {
	let schemaName: string = metadata.schema;
	let objectName: string = metadata.name;
	let timestamp = Date.now().toString();
	if (schemaName !== null) {
		return path.join(os.tmpdir(), `${schemaName}.${objectName}_${timestamp}.txt`);
	} else {
		return path.join(os.tmpdir(), `${objectName}_${timestamp}.txt`);
	}
}

function getServerInfo(connectionService: IConnectionManagementService, ownerUri: string): sqlops.ServerInfo {
	let connection: ConnectionManagementInfo = connectionService.getConnectionInfo(ownerUri);
	return connection.serverInfo;
}