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
import { CreateAzureFunctionStep, TelemetryActions, TelemetryReporter, TelemetryViews, ExitReason } from '../common/telemetry';
import { AddSqlBindingParams, BindingType, GetAzureFunctionsParams, GetAzureFunctionsResult, ResultStatus } from 'sql-bindings';
import { IConnectionInfo, ITreeNodeInfo } from 'vscode-mssql';
import { createAddConnectionStringStep } from '../createNewProject/addConnectionStringStep';

export const hostFileName: string = 'host.json';

export async function createAzureFunction(node?: ITreeNodeInfo): Promise<void> {
	// telemetry properties for create azure function
	let sessionId: string = uuid.v4();
	let propertyBag: { [key: string]: string } = { sessionId: sessionId };
	let telemetryStep: string = '';
	let exitReason: string = ExitReason.cancelled;
	TelemetryReporter.sendActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.startCreateAzureFunctionWithSqlBinding);
	let connectionInfo: IConnectionInfo | undefined;
	let isCreateNewProject: boolean = false;
	let newFunctionFileObject: azureFunctionsUtils.IFileFunctionObject | undefined;

	try {
		const azureFunctionApi = await azureFunctionsUtils.getAzureFunctionsExtensionApi();
		if (!azureFunctionApi) {
			exitReason = ExitReason.error;
			propertyBag.exitReason = exitReason;
			TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick)
				.withAdditionalProperties(propertyBag).send();
			return;
		}
		/**
		 * Prompts user for azure function project path to use
		 * If multiple found in workspace we prompt user to pick one
		 * If one found in workspace we use that
		 * If none found in workspace we show error message but continue with createFunction message
		 */
		let projectFile = await azureFunctionsUtils.getAzureFunctionProject();
		let projectFolder: string;
		telemetryStep = CreateAzureFunctionStep.getAzureFunctionProject;
		if (!projectFile) {
			while (true) {
				// show warning message that user needs an azure function project to create a function
				let projectCreate = await vscode.window.showErrorMessage(constants.azureFunctionsProjectMustBeOpened,
					constants.createProject, constants.learnMore);
				if (projectCreate === constants.learnMore) {
					telemetryStep = CreateAzureFunctionStep.learnMore;
					exitReason = ExitReason.exit;
					void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(constants.sqlBindingsDoc));
					return;
				} else if (projectCreate === constants.createProject) {
					telemetryStep = CreateAzureFunctionStep.helpCreateAzureFunctionProject;
					TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
						.withAdditionalProperties(propertyBag).send();

					isCreateNewProject = true;
					telemetryStep = CreateAzureFunctionStep.getSelectedFolder;
					// user either has not folder open or an empty workspace
					// prompt user to choose a folder to create the project in
					const browseProjectLocation = await vscode.window.showQuickPick(
						[constants.browseEllipsisWithIcon],
						{ title: constants.selectAzureFunctionProjFolder, ignoreFocusOut: true });
					if (!browseProjectLocation) {
						// User cancelled
						return;
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
					projectFolder = projectFolders[0].fsPath;
					TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
						.withAdditionalProperties(propertyBag).send();
					break;
				}
			}
		} else {
			// user has an azure function project open
			projectFolder = path.dirname(projectFile);
		}
		// create a system file watcher for the project folder
		newFunctionFileObject = azureFunctionsUtils.waitForNewFunctionFile(projectFolder);

		// Prompt user for binding type
		telemetryStep = CreateAzureFunctionStep.getBindingType;
		let selectedBindingType: BindingType | undefined;
		let selectedBinding = await azureFunctionsUtils.promptForBindingType();
		if (!selectedBinding) {
			return;
		}
		selectedBindingType = selectedBinding;
		propertyBag.bindingType = selectedBindingType;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
			.withAdditionalProperties(propertyBag).send();

		// Get connection string parameters and construct object name from prompt or connectionInfo given
		let objectName: string | undefined;
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		if (!node) {
			// if user selects command in command palette we prompt user for information
			telemetryStep = CreateAzureFunctionStep.launchFromCommandPalette;
			// prompt user for connection profile to get connection info
			while (true) {
				connectionInfo = await vscodeMssqlApi.promptForConnection(true);
				if (!connectionInfo) {
					// User cancelled
					return;
				}
				TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
					.withAdditionalProperties(propertyBag).withConnectionInfo(connectionInfo).send();
				telemetryStep = CreateAzureFunctionStep.getConnectionProfile;
				let connectionURI: string = '';
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: constants.connectionProgressTitle,
							cancellable: false
						}, async (_progress, _token) => {
							// list databases based on connection profile selected
							connectionURI = await vscodeMssqlApi.connect(connectionInfo!);
						}
					);
				} catch (e) {
					// mssql connection error will be shown to the user
					// we will then prompt user to choose a connection profile again
					continue;
				}
				// list databases based on connection profile selected
				telemetryStep = CreateAzureFunctionStep.getDatabase;
				let listDatabases = await vscodeMssqlApi.listDatabases(connectionURI);
				const selectedDatabase = (await vscode.window.showQuickPick(listDatabases, {
					canPickMany: false,
					title: constants.selectDatabase,
					ignoreFocusOut: true
				}));

				if (!selectedDatabase) {
					// User cancelled
					// we will then prompt user to choose a connection profile again
					continue;
				}
				connectionInfo.database = selectedDatabase;

				// prompt user for object name to create function from
				objectName = await azureFunctionsUtils.promptForObjectName(selectedBinding);
				if (!objectName) {
					// user cancelled
					return;
				}
				break;
			}
		} else {
			// if user selects table in tree view we use connection info from Object Explorer node
			telemetryStep = CreateAzureFunctionStep.launchFromTable;
			connectionInfo = node.connectionInfo;
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag).withConnectionInfo(connectionInfo).send();
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
			objectName = utils.generateQuotedFullName(node.metadata.schema, node.metadata.name);
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag).withConnectionInfo(connectionInfo).send();
		}

		// get function name from user
		telemetryStep = CreateAzureFunctionStep.getAzureFunctionName;
		let functionName: string;
		// remove special characters from function name
		let uniqueObjectName = utils.santizeObjectName(objectName);
		let uniqueFunctionName = await utils.getUniqueFileName(uniqueObjectName, projectFolder);
		functionName = await vscode.window.showInputBox({
			title: constants.functionNameTitle,
			value: uniqueFunctionName,
			ignoreFocusOut: true,
			validateInput: input => utils.validateFunctionName(input)
		}) as string;
		if (!functionName) {
			return;
		}
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
			.withAdditionalProperties(propertyBag)
			.withConnectionInfo(connectionInfo).send();

		// set the templateId based on the selected binding type
		telemetryStep = CreateAzureFunctionStep.getTemplateId;
		let templateId: string = selectedBindingType === BindingType.input ? constants.inputTemplateID : constants.outputTemplateID;

		// We need to set the azureWebJobsStorage to a placeholder
		// to suppress the warning for opening the wizard - but will ask them to overwrite if they are creating new azureFunction
		// issue https://github.com/microsoft/azuredatastudio/issues/18780
		telemetryStep = CreateAzureFunctionStep.setAzureWebJobsStorage;
		await azureFunctionsUtils.setLocalAppSetting(projectFolder, constants.azureWebJobsStorageSetting, constants.azureWebJobsStoragePlaceholder);

		// prompt for Connection String Setting Name
		let connectionStringSettingName: string | undefined = constants.sqlConnectionStringSetting;
		if (!isCreateNewProject && projectFile) {
			telemetryStep = CreateAzureFunctionStep.getConnectionStringSettingName;
			connectionStringSettingName = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(vscode.Uri.parse(projectFile), connectionInfo);
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag)
				.withConnectionInfo(connectionInfo).send();
		}
		// addtional execution step that will be used by vscode-azurefunctions to execute only when creating a new azure function project
		let connectionStringExecuteStep = createAddConnectionStringStep(projectFolder, connectionInfo, connectionStringSettingName);

		// create C# Azure Function with SQL Binding
		telemetryStep = 'createFunctionAPI';
		await azureFunctionApi.createFunction({
			language: 'C#',
			targetFramework: 'netcoreapp3.1',
			version: '~3',
			templateId: templateId,
			functionName: functionName,
			functionSettings: {
				connectionStringSetting: connectionStringSettingName,
				...(selectedBindingType === BindingType.input && { object: objectName }),
				...(selectedBindingType === BindingType.output && { table: objectName })
			},
			folderPath: projectFolder,
			suppressCreateProjectPrompt: true,
			...(isCreateNewProject && { executeStep: connectionStringExecuteStep })
		});
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
			.withAdditionalProperties(propertyBag)
			.withConnectionInfo(connectionInfo).send();

		// check for the new function file to be created and dispose of the file system watcher
		const timeoutForFunctionFile = utils.timeoutPromise(constants.timeoutAzureFunctionFileError);
		await Promise.race([newFunctionFileObject.filePromise, timeoutForFunctionFile]);

		telemetryStep = 'finishCreateFunction';
		propertyBag.telemetryStep = telemetryStep;
		exitReason = ExitReason.finishCreate;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.finishCreateAzureFunctionWithSqlBinding)
			.withAdditionalProperties(propertyBag)
			.withConnectionInfo(connectionInfo).send();
	} catch (error) {
		let errorType = utils.getErrorType(error);
		propertyBag.telemetryStep = telemetryStep;
		if (errorType === 'TimeoutError') {
			// this error can be cause by many different scenarios including timeout or error occurred during createFunction
			exitReason = ExitReason.timeout;
			console.log('Timed out waiting for Azure Function project to be created. This may not necessarily be an error, for example if the user canceled out of the create flow.');
		} else {
			// else an error would occur during the createFunction
			exitReason = ExitReason.error;
			void vscode.window.showErrorMessage(constants.errorNewAzureFunction(error));
		}
		TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick, undefined, errorType)
			.withAdditionalProperties(propertyBag).send();
		return;
	} finally {
		propertyBag.telemetryStep = telemetryStep;
		propertyBag.exitReason = exitReason;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick)
			.withAdditionalProperties(propertyBag).send();
		if (newFunctionFileObject) {
			newFunctionFileObject.watcherDisposable.dispose();
		}
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
