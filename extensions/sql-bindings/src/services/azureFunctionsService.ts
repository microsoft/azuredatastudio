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
import { AddSqlBindingParams, BindingType, GetAzureFunctionsParams, GetAzureFunctionsResult, IConnectionStringInfo, ObjectType, ResultStatus } from 'sql-bindings';
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

	try {
		// check to see if Azure Functions Extension is installed
		const azureFunctionApi = await azureFunctionsUtils.getAzureFunctionsExtensionApi();
		if (!azureFunctionApi) {
			exitReason = ExitReason.error;
			propertyBag.exitReason = exitReason;
			telemetryStep = CreateAzureFunctionStep.noAzureFunctionsExtension;
			TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
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
					// user either has no folder open or an empty workspace
					// prompt user to choose a folder to create the project in
					const browseProjectLocation = await vscode.window.showQuickPick(
						[constants.browseEllipsisWithIcon],
						{ title: constants.selectAzureFunctionProjFolder, ignoreFocusOut: true });
					if (!browseProjectLocation) {
						// User cancelled
						exitReason = ExitReason.cancelled;
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
						exitReason = ExitReason.cancelled;
						return;
					}
					projectFolder = projectFolders[0].fsPath;

					TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
						.withAdditionalProperties(propertyBag).send();
					break;
				} else {
					// user cancelled
					exitReason = ExitReason.cancelled;
					return;
				}
			}
		} else {
			// user has an azure function project open
			projectFolder = path.dirname(projectFile);
		}
		// Get connection string parameters and construct object name from prompt or connectionInfo given
		let objectName: string | undefined;
		let selectedBindingType: BindingType | undefined;
		if (!node) {
			// user selects command in command palette we prompt user for information
			telemetryStep = CreateAzureFunctionStep.launchFromCommandPalette;

			let chosenObjectType = await azureFunctionsUtils.promptForObjectType();
			if (!chosenObjectType) {
				// User cancelled
				exitReason = ExitReason.cancelled;
				return;
			}

			// Prompt user for binding type
			telemetryStep = CreateAzureFunctionStep.getBindingType;
			selectedBindingType = await azureFunctionsUtils.promptForBindingType(chosenObjectType);
			if (!selectedBindingType) {
				// User cancelled
				exitReason = ExitReason.cancelled;
				return;
			}

			// send telemetry for chosen object type and binding type
			propertyBag.objectType = chosenObjectType;
			propertyBag.bindingType = selectedBindingType;
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag).send();

			// prompt user for connection profile to get connection info
			while (true) {
				try {
					const vscodeMssqlApi = await utils.getVscodeMssqlApi();
					connectionInfo = await vscodeMssqlApi.promptForConnection(true);
				} catch (e) {
					// user cancelled while creating connection profile
					// show the connection profile selection prompt again
					continue;
				}
				if (!connectionInfo) {
					// User cancelled
					exitReason = ExitReason.cancelled;
					return;
				}
				TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
					.withAdditionalProperties(propertyBag).withConnectionInfo(connectionInfo).send();
				telemetryStep = CreateAzureFunctionStep.getObjectName;

				// prompt user for object name to create function from
				objectName = await azureFunctionsUtils.promptForObjectName(selectedBindingType, connectionInfo, chosenObjectType);
				if (!objectName) {
					// user cancelled
					continue;
				}
				break;
			}
		} else {
			// user selects table in tree view we use connection info from Object Explorer node
			telemetryStep = CreateAzureFunctionStep.launchFromObjectExplorer;
			connectionInfo = node.connectionInfo;
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag).withConnectionInfo(connectionInfo).send();
			// set the database containing the selected table or view so it can be used
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

			// Prompt user for binding type
			telemetryStep = CreateAzureFunctionStep.getBindingType;
			let nodeType = ObjectType.Table === node.nodeType ? ObjectType.Table : ObjectType.View;
			selectedBindingType = await azureFunctionsUtils.promptForBindingType(nodeType);
			if (!selectedBindingType) {
				// User cancelled
				exitReason = ExitReason.cancelled;
				return;
			}

			// send telemetry for object type and binding type
			propertyBag.objectType = node.nodeType;
			propertyBag.bindingType = selectedBindingType;
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag).send();

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
			// User cancelled
			exitReason = ExitReason.cancelled;
			return;
		}
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
			.withAdditionalProperties(propertyBag)
			.withConnectionInfo(connectionInfo).send();

		// set the templateId based on the selected binding type
		telemetryStep = CreateAzureFunctionStep.getTemplateId;
		let templateId: string = selectedBindingType === BindingType.input ? constants.inputTemplateID : constants.outputTemplateID;

		// prompt for Connection String Setting Name
		let connectionStringInfo: IConnectionStringInfo | undefined = { connectionStringSettingName: constants.sqlConnectionStringSetting, connectionInfo: connectionInfo };
		if (!isCreateNewProject && projectFile) {
			// if it is not a new project, we can prompt user for connection string setting name and connection string password prompts
			telemetryStep = CreateAzureFunctionStep.getConnectionStringSettingName;
			connectionStringInfo = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(vscode.Uri.parse(projectFile), connectionInfo);
			if (!connectionStringInfo) {
				// User cancelled connection string setting name prompt or connection string method prompt
				exitReason = ExitReason.cancelled;
				return;
			}
			TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
				.withAdditionalProperties(propertyBag)
				.withConnectionInfo(connectionInfo).send();
		}
		// additional execution step that will be used by vscode-azurefunctions to execute only when creating a new azure function project
		let connectionStringExecuteStep = createAddConnectionStringStep(projectFolder, connectionInfo, connectionStringInfo.connectionStringSettingName);

		// create C# Azure Function with SQL Binding
		telemetryStep = 'createFunctionAPI';
		await azureFunctionApi.createFunction({
			language: 'C#',
			targetFramework: 'netcoreapp3.1',
			version: '~3',
			templateId: templateId,
			functionName: functionName,
			functionSettings: {
				connectionStringSetting: connectionStringInfo.connectionStringSettingName,
				...(selectedBindingType === BindingType.input && { object: objectName }),
				...(selectedBindingType === BindingType.output && { table: objectName })
			},
			folderPath: projectFolder,
			suppressCreateProjectPrompt: true,
			...(isCreateNewProject && { executeStep: connectionStringExecuteStep })
		});

		// Add latest sql extension package reference to project
		await azureFunctionsUtils.addSqlNugetReferenceToProjectFile(projectFolder);

		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, telemetryStep)
			.withAdditionalProperties(propertyBag)
			.withConnectionInfo(connectionInfo).send();

		telemetryStep = 'finishCreateFunction';
		propertyBag.telemetryStep = telemetryStep;
		exitReason = ExitReason.finishCreate;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.finishCreateAzureFunctionWithSqlBinding)
			.withAdditionalProperties(propertyBag)
			.withConnectionInfo(connectionInfo).send();
	} catch (error) {
		let errorType = utils.getErrorType(error);
		propertyBag.telemetryStep = telemetryStep;
		// an error occurred during createFunction
		exitReason = ExitReason.error;
		void vscode.window.showErrorMessage(constants.errorNewAzureFunction(error));
		TelemetryReporter.createErrorEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick, undefined, errorType)
			.withAdditionalProperties(propertyBag).send();
		return;
	} finally {
		propertyBag.telemetryStep = telemetryStep;
		propertyBag.exitReason = exitReason;
		TelemetryReporter.createActionEvent(TelemetryViews.CreateAzureFunctionWithSqlBinding, TelemetryActions.exitCreateAzureFunctionQuickpick)
			.withAdditionalProperties(propertyBag).send();
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
