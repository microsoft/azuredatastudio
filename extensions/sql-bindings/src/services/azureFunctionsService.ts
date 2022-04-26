/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as uuid from 'uuid';
import * as utils from '../common/utils';
import * as azureFunctionsUtils from '../common/azureFunctionsUtils';
import * as constants from '../common/constants';
import * as azureFunctionsContracts from '../contracts/azureFunctions/azureFunctionsContracts';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { AddSqlBindingParams, BindingType, GetAzureFunctionsParams, GetAzureFunctionsResult, ResultStatus } from 'sql-bindings';
import { IConnectionInfo, ITreeNodeInfo } from 'vscode-mssql';

export const hostFileName: string = 'host.json';

export async function createAzureFunction(node?: ITreeNodeInfo): Promise<void> {
	// telemetry properties for create azure function
	let sessionId: string = uuid.v4();
	let propertyBag: { [key: string]: string } = { sessionId: sessionId };
	let quickPickStep: string = '';
	let exitReason: string = 'cancelled';
	TelemetryReporter.sendActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.startCreateAzureFunctionWithSqlBinding);

	let selectedBindingType: BindingType | undefined;
	let connectionInfo: IConnectionInfo | undefined;
	let connectionURI: string = '';
	let listDatabases: string[] | undefined;
	let objectName: string | undefined;
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();
	if (!node) {
		// if user selects command in command palette we prompt user for information
		quickPickStep = 'launchFromCommandPalette';
		try {
			// Ask binding type for promptObjectName
			quickPickStep = 'getBindingType';
			let selectedBinding = await azureFunctionsUtils.promptForBindingType();
			if (!selectedBinding) {
				return;
			}
			selectedBindingType = selectedBinding;
			propertyBag.bindingType = selectedBindingType;
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.startCreateAzureFunctionWithSqlBinding)
				.withAdditionalProperties(propertyBag).send();

			// prompt user for connection profile to get connection info
			while (true) {
				connectionInfo = await vscodeMssqlApi.promptForConnection(true);
				if (!connectionInfo) {
					// User cancelled
					return;
				}
				quickPickStep = 'getConnectionInfo';
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: constants.connectionProgressTitle,
							cancellable: false
						}, async (_progress, _token) => {
							// list databases based on connection profile selected
							if (!connectionInfo) {
								// User cancelled
								return;
							}
							connectionURI = await vscodeMssqlApi.connect(connectionInfo);
						}
					);
				} catch (e) {
					// connection error occurred
					continue;
				}
				// list databases based on connection profile selected
				listDatabases = await vscodeMssqlApi.listDatabases(connectionURI);
				const selectedDatabase = (await vscode.window.showQuickPick(listDatabases, {
					canPickMany: false,
					title: constants.selectDatabase,
					ignoreFocusOut: true
				}));

				if (!selectedDatabase) {
					// User cancelled
					continue;
				}
				connectionInfo.database = selectedDatabase;

				// prompt user for object name to create function from
				objectName = await azureFunctionsUtils.promptForObjectName(selectedBinding);
				if (!objectName) {
					// user cancelled
					continue;
				}
				break;
			}
		} catch (e) {
			propertyBag.quickPickStep = quickPickStep;
			exitReason = 'error';
			TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick, undefined, utils.getErrorType(e))
				.withAdditionalProperties(propertyBag).send();
			return;
		}
	} else {
		quickPickStep = 'launchFromTable';
		connectionInfo = node.connectionInfo;
		// set the database containing the selected table so it can be used
		// for the initial catalog property of the connection string
		let newNode: ITreeNodeInfo = node;
		while (newNode) {
			if (newNode.nodeType === 'Database') {
				connectionInfo.database = newNode.metadata.name;
				break;
			} else {
				newNode = newNode.parentNode;
			}
		}
		// Ask binding type for promptObjectName
		quickPickStep = 'getBindingType';
		let selectedBinding = await azureFunctionsUtils.promptForBindingType();

		if (!selectedBinding) {
			// User cancelled
			return;
		}
		selectedBindingType = selectedBinding;
		propertyBag.bindingType = selectedBinding;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.startCreateAzureFunctionWithSqlBinding)
			.withAdditionalProperties(propertyBag).withConnectionInfo(connectionInfo).send();

		objectName = utils.generateQuotedFullName(node.metadata.schema, node.metadata.name);
	}

	TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.startCreateAzureFunctionWithSqlBinding)
		.withConnectionInfo(connectionInfo).send();
	quickPickStep = 'getAzureFunctionsExtensionApi';
	const azureFunctionApi = await azureFunctionsUtils.getAzureFunctionsExtensionApi();
	if (!azureFunctionApi) {
		propertyBag.exitReason = exitReason;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick)
			.withConnectionInfo(connectionInfo)
			.withAdditionalProperties(propertyBag).send();
		return;

	}
	let projectFile = await azureFunctionsUtils.getAzureFunctionProject();
	let newHostProjectFile!: azureFunctionsUtils.IFileFunctionObject;
	let hostFile: string;

	if (!projectFile) {
		let projectCreate = await vscode.window.showErrorMessage(constants.azureFunctionsProjectMustBeOpened,
			constants.createProject, constants.learnMore);
		if (projectCreate === constants.learnMore) {
			quickPickStep = 'learnMore';
			void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(constants.sqlBindingsDoc));
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.learnMore)
				.withConnectionInfo(connectionInfo)
				.withAdditionalProperties(propertyBag).send();
			return;
		} else if (projectCreate === constants.createProject) {
			quickPickStep = 'helpCreateAzureFunctionProject';
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.helpCreateAzureFunctionProject)
				.withConnectionInfo(connectionInfo)
				.withAdditionalProperties(propertyBag).send();

			// start the create azure function project flow
			try {
				// First prompt user for project location. We need to do this ourselves due to an issue
				// in the AF extension : https://github.com/microsoft/vscode-azurefunctions/issues/3115
				const browseProjectLocation = await vscode.window.showQuickPick(
					[constants.browseEllipsisWithIcon],
					{ title: constants.selectAzureFunctionProjFolder, ignoreFocusOut: true });
				if (!browseProjectLocation) {
					// User cancelled
					return undefined;
				}
				const projectFolders = (await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: constants.selectButton
				}));
				if (!projectFolders) {
					// User cancelled
					return;
				}
				const templateId: string = selectedBindingType === BindingType.input ? constants.inputTemplateID : constants.outputTemplateID;
				// because of an AF extension API issue, we have to get the newly created file by adding a watcher
				// issue: https://github.com/microsoft/vscode-azurefunctions/issues/3052
				newHostProjectFile = azureFunctionsUtils.waitForNewHostFile();
				await azureFunctionApi.createFunction({
					language: 'C#',
					targetFramework: 'netcoreapp3.1',
					templateId: templateId,
					suppressCreateProjectPrompt: true,
					folderPath: projectFolders[0].fsPath,
					functionSettings: {
						...(selectedBindingType === BindingType.input && { object: objectName }),
						...(selectedBindingType === BindingType.output && { table: objectName })
					},
				});
				const timeoutForHostFile = utils.timeoutPromise(constants.timeoutProjectError);
				hostFile = await Promise.race([newHostProjectFile.filePromise, timeoutForHostFile]);
				if (hostFile) {
					// start the add sql binding flow
					projectFile = await azureFunctionsUtils.getAzureFunctionProject();
				}
			} catch (error) {
				let errorType = utils.getErrorType(error);
				propertyBag.quickPickStep = quickPickStep;

				if (errorType === 'TimeoutError') {
					// this error can be cause by many different scenarios including timeout or error occurred during createFunction
					exitReason = 'timeout';
					console.log('Timed out waiting for Azure Function project to be created. This may not necessarily be an error, for example if the user canceled out of the create flow.');
				} else {
					// else an error would occur during the createFunction
					exitReason = 'error';
					void vscode.window.showErrorMessage(constants.errorNewAzureFunction(error));
				}
				TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick, undefined, errorType)
					.withAdditionalProperties(propertyBag).send();
				return;
			} finally {
				propertyBag.exitReason = exitReason;
				TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick)
					.withConnectionInfo(connectionInfo)
					.withAdditionalProperties(propertyBag).send();
				newHostProjectFile.watcherDisposable.dispose();
			}
		}
	}

	if (projectFile) {
		// because of an AF extension API issue, we have to get the newly created file by adding a watcher
		// issue: https://github.com/microsoft/vscode-azurefunctions/issues/2908
		const newFunctionFileObject = azureFunctionsUtils.waitForNewFunctionFile(projectFile);
		let functionName: string;

		try {
			// get function name from user
			quickPickStep = 'getAzureFunctionName';
			// remove special characters from function name
			let uniqueObjectName = utils.santizeObjectName(objectName);
			let uniqueFunctionName = await utils.getUniqueFileName(path.dirname(projectFile), uniqueObjectName);
			functionName = await vscode.window.showInputBox({
				title: constants.functionNameTitle,
				value: uniqueFunctionName,
				ignoreFocusOut: true,
				validateInput: input => utils.validateFunctionName(input)
			}) as string;
			if (!functionName) {
				return;
			}
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.getAzureFunctionProject)
				.withAdditionalProperties(propertyBag)
				.withConnectionInfo(connectionInfo).send();

			// set the templateId based on the selected binding type
			let templateId: string = selectedBindingType === BindingType.input ? constants.inputTemplateID : constants.outputTemplateID;

			// We need to set the azureWebJobsStorage to a placeholder
			// to suppress the warning for opening the wizard
			// issue https://github.com/microsoft/azuredatastudio/issues/18780
			await azureFunctionsUtils.setLocalAppSetting(path.dirname(projectFile), constants.azureWebJobsStorageSetting, constants.azureWebJobsStoragePlaceholder);

			// prompt for connection string setting name and set connection string in local.settings.json
			quickPickStep = 'getConnectionStringSettingName';
			let connectionStringSettingName = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(vscode.Uri.parse(projectFile), connectionInfo);

			// create C# Azure Function with SQL Binding
			await azureFunctionApi.createFunction({
				language: 'C#',
				templateId: templateId,
				functionName: functionName,
				targetFramework: 'netcoreapp3.1',
				functionSettings: {
					connectionStringSetting: connectionStringSettingName,
					...(selectedBindingType === BindingType.input && { object: objectName }),
					...(selectedBindingType === BindingType.output && { table: objectName })
				},
				folderPath: projectFile
			});

			// check for the new function file to be created and dispose of the file system watcher
			const timeoutForFunctionFile = utils.timeoutPromise(constants.timeoutAzureFunctionFileError);
			await Promise.race([newFunctionFileObject.filePromise, timeoutForFunctionFile]);
			propertyBag.quickPickStep = quickPickStep;
			exitReason = 'finishCreate';
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.finishCreateAzureFunctionWithSqlBinding)
				.withAdditionalProperties(propertyBag)
				.withConnectionInfo(connectionInfo).send();
		} catch (e) {
			let errorType = utils.getErrorType(e);
			propertyBag.quickPickStep = quickPickStep;

			if (errorType === 'TimeoutError') {
				// this error can be cause by many different scenarios including timeout or error occurred during createFunction
				exitReason = 'timeout';
				console.log('Timed out waiting for Azure Function project to be created. This may not necessarily be an error, for example if the user canceled out of the create flow.');
			} else {
				// else an error would occur during the createFunction
				exitReason = 'error';
				void vscode.window.showErrorMessage(utils.getErrorMessage(e));
			}
			TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick, undefined, errorType)
				.withAdditionalProperties(propertyBag).send();
			return;
		} finally {
			propertyBag.quickPickStep = quickPickStep;
			propertyBag.exitReason = exitReason;
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick)
				.withConnectionInfo(connectionInfo)
				.withAdditionalProperties(propertyBag).send();
			newFunctionFileObject.watcherDisposable.dispose();
		}
	} else {
		TelemetryReporter.sendErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.finishCreateAzureFunctionWithSqlBinding);
	}
}

/**
 * Adds a SQL Binding to a specified Azure function in a file
 * @param bindingType Type of SQL Binding
 * @param filePath Path of the file where the Azure Functions are
 * @param functionName Name of the function where the SQL Binding is to be added
 * @param objectName Name of Object for the SQL Query
 * @param connectionStringSetting Setting for the connection string
 * @returns Azure Function SQL binding
 */
export async function addSqlBinding(
	bindingType: BindingType,
	filePath: string,
	functionName: string,
	objectName: string,
	connectionStringSetting: string
): Promise<ResultStatus> {
	const params: AddSqlBindingParams = {
		bindingType: bindingType,
		filePath: filePath,
		functionName: functionName,
		objectName: objectName,
		connectionStringSetting: connectionStringSetting
	};

	const vscodeMssqlApi = await utils.getVscodeMssqlApi();

	return await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: constants.addSqlBinding(functionName),
			cancellable: false
		}, async (_progress, _token) => {
			return vscodeMssqlApi.sendRequest(azureFunctionsContracts.AddSqlBindingRequest.type, params);
		}
	);
}

/**
 * Gets the names of the Azure functions in the file
 * @param filePath Path of the file to get the Azure functions
 * @returns array of names of Azure functions in the file
 */
export async function getAzureFunctions(filePath: string): Promise<GetAzureFunctionsResult> {
	const params: GetAzureFunctionsParams = {
		filePath: filePath
	};
	const vscodeMssqlApi = await utils.getVscodeMssqlApi();

	return vscodeMssqlApi.sendRequest(azureFunctionsContracts.GetAzureFunctionsRequest.type, params);
}
