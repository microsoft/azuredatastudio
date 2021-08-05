import * as vscode from 'vscode';
import * as constants from '../common/constants';

export async function launchAddSqlBindingQuickpick(uri: vscode.Uri | undefined): Promise<void> {
	if (!uri) {
		// this command only shows in the command palette when the active editor is a .cs file, so we can safely assume that's the scenario
		// when this is called without a uri
		uri = vscode.window.activeTextEditor!.document.uri;
	}

	// 1. select input or output binding
	const inputOutputItems: string[] = [constants.input, constants.output];

	const selectedBinding = (await vscode.window.showQuickPick(inputOutputItems, {
		canPickMany: false,
		title: constants.selectBindingType,
		ignoreFocusOut: true
	}));

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

	// 2. select Azure function from the current file
	const azureFunctionName = (await vscode.window.showQuickPick(azureFunctions, {
		canPickMany: false,
		title: constants.selectAzureFunction,
		ignoreFocusOut: true
	}));

	if (!azureFunctionName) {
		return;
	}

	// 3. ask for object name for the binding
	const objectName = await vscode.window.showInputBox({
		prompt: selectedBinding === constants.input ? constants.sqlObjectToQuery : constants.sqlTableToUpsert,
		value: constants.placeHolderObject,
		ignoreFocusOut: true
	});

	if (!objectName) {
		return;
	}

	// 4. ask for connection string setting name
	// TODO: load local settings from local.settings.json like in LocalAppSettingListStep in vscode-azurefunctions repo
	const connectionStringSetting = await vscode.window.showInputBox({
		prompt: constants.connectionStringSetting,
		placeHolder: constants.connectionStringSettingPlaceholder,
		ignoreFocusOut: true
	});

	if (!connectionStringSetting) {
		return;
	}

	// TODO: hook up actually adding binding
	// 5. insert binding
}

