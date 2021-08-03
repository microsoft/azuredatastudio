import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from '../common/utils';
import * as glob from 'fast-glob';

export const hostFileName: string = 'host.json';


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
		// when this is called without a uri (right click on .cs file in file explorer to invoke this command)
		uri = vscode.window.activeTextEditor!.document.uri;
	}

	// input or output binding
	const intputOutputItems: vscode.QuickPickItem[] = [{ label: 'input' }, { label: 'output' }];

	const selectedBinding = (await vscode.window.showQuickPick(intputOutputItems, {
		canPickMany: false,
		title: 'Type of binding:'
	}))?.label;


	// get all the azure functions in the file
	// TODO: get actual functions. Need to add in sqltoolsservice first
	const azureFunctions = ['af1', 'af2']; //await getAzureFunctions(uri);

	if (azureFunctions.length === 0) {
		vscode.window.showErrorMessage('No Azure functions in the current file');
		return;
	}

	const items: vscode.QuickPickItem[] = [];

	for (const aFName of azureFunctions) {
		items.push({ label: aFName });
	}

	const azureFunctionName = (await vscode.window.showQuickPick(items, {
		canPickMany: false,
		title: 'Select Azure function in current file to add SQL binding to:'
	}))?.label;

	if (!azureFunctionName) {
		return;
	}

	const objectName = await vscode.window.showInputBox({
		prompt: selectedBinding === 'input' ? 'Object to put in binding:' : 'Table to put in binding',
		value: '[dbo].[placeholder]',
		ignoreFocusOut: true
	});

	if (!objectName) {
		return;
	}

	// TODO: load local settings from local.settings.json like in LocalAppSettingListStep in vscode-azurefunctions repo
	const connectionStringSetting = await vscode.window.showInputBox({
		prompt: 'Connection string setting name',
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

/**
 * Gets the Azure funtions project containing the given file
 * @param file
 * @returns returns the uri of the project or undefined if the Azure functions project could not be found
 */
async function getFunctionsProject(file: vscode.Uri): Promise<vscode.Uri | undefined> {
	const folder = vscode.workspace.getWorkspaceFolder(file);

	if (!folder) {
		return;
	}

	// look for azure functions csproj in the workspace
	// path needs to use forward slashes for glob to work
	const escapedPath = glob.escapePath(folder.uri.fsPath.replace(/\\/g, '/'));

	// can filter for multiple file extensions using folder/**/*.{sqlproj,csproj} format, but this notation doesn't work if there's only one extension
	// so the filter needs to be in the format folder/**/*.sqlproj if there's only one supported projectextension
	const projFilter = path.posix.join(escapedPath, '**', `*.csproj`);

	// glob will return an array of file paths with forward slashes, so they need to be converted back if on windows
	const projectFiles: vscode.Uri[] = (await glob(projFilter)).map(p => vscode.Uri.file(path.resolve(p)));

	// look for functions project if more than one project in the workspace folder
	if (projectFiles.length > 1) {
		for (const p of projectFiles) {
			if (isFunctionProject(p.fsPath)) {
				// TODO: worry more about this scenario later. For now, return the first azure functions project
				return p;
			}
		}
	} else if (projectFiles.length === 1 && await isFunctionProject(path.dirname(projectFiles[0].fsPath))) {
		return projectFiles[0];
	}

	// no Azure functions project found
	return undefined;
}

// Use 'host.json' as an indicator that this is a functions project
async function isFunctionProject(folderPath: string): Promise<boolean> {
	return await utils.exists(path.join(folderPath, hostFileName));
}
