// import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
// import * as utils from '../common/utils';
// import * as glob from 'fast-glob';

// async function getAzureFunctions(uri: vscode.Uri): Promise<string[]> {
// if (!uri) {
// 	return [];
// }


// // get all the azure functions in the file
// const params: GetAzureFunctionsParams = {
// 	filePath: uri.fsPath
// };

// const result = await this._client.sendRequest(GetAzureFunctionsRequest.type, params);

// if (result.success) {
// 	return result.azureFunctions;
// } else {
// 	throw new Error(result.errorMessage);
// }
// }

export async function launchInsertSqlBindingQuickpick(uri: vscode.Uri): Promise<void> {
	if (!uri) {
		// this command only shows in the command palette when the active editor is a .cs file, so we can safely assume that's the scenario
		// when this is called without a uri
		uri = vscode.window.activeTextEditor!.document.uri;
	}

	// input or output binding
	const intputOutputItems: vscode.QuickPickItem[] = [{ label: constants.input }, { label: constants.output }];

	const selectedBinding = (await vscode.window.showQuickPick(intputOutputItems, {
		canPickMany: false,
		title: constants.selectBindingType,
		ignoreFocusOut: true
	}))?.label;

	if (!selectedBinding) {
		return;
	}

	// get all the azure functions in the file
	// TODO: get actual functions. Need to add in sqltoolsservice first
	const azureFunctions = ['af1', 'af2']; //await getAzureFunctions(uri);

	if (azureFunctions.length === 0) {
		vscode.window.showErrorMessage(constants.noAzureFunctionsInFile);
		return;
	}

	const items: vscode.QuickPickItem[] = [];

	for (const aFName of azureFunctions) {
		items.push({ label: aFName });
	}

	const azureFunctionName = (await vscode.window.showQuickPick(items, {
		canPickMany: false,
		title: constants.selectAzureFunction,
		ignoreFocusOut: true
	}))?.label;

	if (!azureFunctionName) {
		return;
	}

	const objectName = await vscode.window.showInputBox({
		prompt: selectedBinding === constants.input ? constants.sqlObjectToQuery : constants.sqlTableToUpsert,
		value: constants.placeHolderObject,
		ignoreFocusOut: true
	});

	if (!objectName) {
		return;
	}

	// TODO: load local settings from local.settings.json like in LocalAppSettingListStep in vscode-azurefunctions repo
	const connectionStringSetting = await vscode.window.showInputBox({
		prompt: constants.connectionStringSetting,
		placeHolder: constants.connectionStringSettingPlaceholder,
		ignoreFocusOut: true
	});

	if (!connectionStringSetting) {
		return;
	}

	// const params: InsertSqlBindingParams = {
	// 	filePath: uri.fsPath,
	// 	functionName: azureFunctionName,
	// 	objectName: objectName,
	// 	bindingType: selectedBinding === 'input' ? BindingType.input : BindingType.output,
	// 	connectionStringSetting: connectionStringSetting
	// };

	// const result = await this._client.sendRequest(InsertSqlBindingRequest.type, params);

	// // TODO - add nuget package to the azure functions project
	// // command: dotnet add generated-azfunctions/Pets.Namespace.csproj package Microsoft.Azure.WebJobs.Extensions.Sql -v 1.0.0-preview3
	// const functionsProject = getFunctionsProject(uri);

	// if (!result.success) {
	// 	vscode.window.showErrorMessage(result.errorMessage);
	// }
}

