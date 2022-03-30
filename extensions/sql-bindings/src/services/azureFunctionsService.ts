/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from '../common/utils';
import * as azureFunctionsUtils from '../common/azureFunctionsUtils';
import * as constants from '../common/constants';
import * as azureFunctionsContracts from '../contracts/azureFunctions/azureFunctionsContracts';
import { AddSqlBindingParams, BindingType, GetAzureFunctionsParams, GetAzureFunctionsResult, ResultStatus } from 'sql-bindings';

export const hostFileName: string = 'host.json';


export async function createAzureFunction(connectionString: string, schema: string, table: string): Promise<void> {
	const azureFunctionApi = await azureFunctionsUtils.getAzureFunctionsExtensionApi();
	if (!azureFunctionApi) {
		return;
	}
	let projectFile = await azureFunctionsUtils.getAzureFunctionProject();
	let newHostProjectFile!: azureFunctionsUtils.IFileFunctionObject;
	let hostFile: string;

	if (!projectFile) {
		let projectCreate = await vscode.window.showErrorMessage(constants.azureFunctionsProjectMustBeOpened,
			constants.createProject, constants.learnMore);
		if (projectCreate === constants.learnMore) {
			void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(constants.sqlBindingsDoc));
			return;
		} else if (projectCreate === constants.createProject) {
			// start the create azure function project flow
			try {
				// because of an AF extension API issue, we have to get the newly created file by adding a watcher
				// issue: https://github.com/microsoft/vscode-azurefunctions/issues/3052
				newHostProjectFile = await azureFunctionsUtils.waitForNewHostFile();
				await azureFunctionApi.createFunction({});
				const timeoutForHostFile = utils.timeoutPromise(constants.timeoutProjectError);
				hostFile = await Promise.race([newHostProjectFile.filePromise, timeoutForHostFile]);
				if (hostFile) {
					// start the add sql binding flow
					projectFile = await azureFunctionsUtils.getAzureFunctionProject();
				}
			} catch (error) {
				void vscode.window.showErrorMessage(utils.formatString(constants.errorNewAzureFunction, error.message ?? error));
				return;
			} finally {
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
			let uniqueFunctionName = await utils.getUniqueFileName(path.dirname(projectFile), table);
			functionName = await vscode.window.showInputBox({
				title: constants.functionNameTitle,
				value: uniqueFunctionName,
				ignoreFocusOut: true,
				validateInput: input => input ? undefined : constants.nameMustNotBeEmpty
			}) as string;
			if (!functionName) {
				return;
			}

			// select input or output binding
			const selectedBinding = await azureFunctionsUtils.promptForBindingType();

			if (!selectedBinding) {
				return;
			}

			// set the templateId based on the selected binding type
			let templateId: string = selectedBinding.type === BindingType.input ? constants.inputTemplateID : constants.outputTemplateID;
			let objectName = utils.generateQuotedFullName(schema, table);

			// We need to set the azureWebJobsStorage to a placeholder
			// to suppress the warning for opening the wizard
			// issue https://github.com/microsoft/azuredatastudio/issues/18780

			await azureFunctionsUtils.setLocalAppSetting(path.dirname(projectFile), constants.azureWebJobsStorageSetting, constants.azureWebJobsStoragePlaceholder);

			// create C# Azure Function with SQL Binding
			await azureFunctionApi.createFunction({
				language: 'C#',
				templateId: templateId,
				functionName: functionName,
				functionSettings: {
					connectionStringSetting: constants.sqlConnectionStringSetting,
					...(selectedBinding.type === BindingType.input && { object: objectName }),
					...(selectedBinding.type === BindingType.output && { table: objectName })
				},
				folderPath: projectFile
			});

			// check for the new function file to be created and dispose of the file system watcher
			const timeoutForFunctionFile = utils.timeoutPromise(constants.timeoutAzureFunctionFileError);
			await Promise.race([newFunctionFileObject.filePromise, timeoutForFunctionFile]);
		} finally {
			newFunctionFileObject.watcherDisposable.dispose();
		}
		await azureFunctionsUtils.addConnectionStringToConfig(connectionString, projectFile);
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

	return vscodeMssqlApi.sendRequest(azureFunctionsContracts.AddSqlBindingRequest.type, params);
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
