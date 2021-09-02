import * as vscode from 'vscode';
import { BindingType } from 'vscode-mssql';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { PackageHelper } from '../tools/packageHelper';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

export async function launchAddSqlBindingQuickpick(uri: vscode.Uri | undefined, packageHelper: PackageHelper): Promise<void> {
	TelemetryReporter.sendActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.sqlBindingsQuickPickStart);

	if (!uri) {
		// this command only shows in the command palette when the active editor is a .cs file, so we can safely assume that's the scenario
		// when this is called without a uri
		uri = vscode.window.activeTextEditor!.document.uri;
	}

	// get all the Azure functions in the file
	const azureFunctionsService = await utils.getAzureFunctionService();
	let getAzureFunctionsResult;
	try {
		getAzureFunctionsResult = await azureFunctionsService.getAzureFunctions(uri.fsPath);
	} catch (e) {
		void vscode.window.showErrorMessage(e);
		return;
	}

	const azureFunctions = getAzureFunctionsResult.azureFunctions;

	if (azureFunctions.length === 0) {
		void vscode.window.showErrorMessage(constants.noAzureFunctionsInFile);
		return;
	}

	// 1. select Azure function from the current file
	const azureFunctionName = (await vscode.window.showQuickPick(azureFunctions, {
		canPickMany: false,
		title: constants.selectAzureFunction,
		ignoreFocusOut: true
	}));

	if (!azureFunctionName) {
		return;
	}

	// 2. select input or output binding
	const inputOutputItems: (vscode.QuickPickItem & { type: BindingType })[] = [
		{
			label: constants.input,
			type: BindingType.input
		},
		{
			label: constants.output,
			type: BindingType.output
		}
	];

	const selectedBinding = (await vscode.window.showQuickPick(inputOutputItems, {
		canPickMany: false,
		title: constants.selectBindingType,
		ignoreFocusOut: true
	}));

	if (!selectedBinding) {
		return;
	}

	// 3. ask for object name for the binding
	const objectName = await vscode.window.showInputBox({
		prompt: selectedBinding.type === BindingType.input ? constants.sqlObjectToQuery : constants.sqlTableToUpsert,
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

	// 5. insert binding
	try {
		const result = await azureFunctionsService.addSqlBinding(selectedBinding.type, uri.fsPath, azureFunctionName, objectName, connectionStringSetting);

		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.addSqlBinding)
			.withAdditionalProperties({ bindingType: selectedBinding.label })
			.send();

		if (!result.success) {
			void vscode.window.showErrorMessage(result.errorMessage);
			return;
		}
	} catch (e) {
		void vscode.window.showErrorMessage(e);
		TelemetryReporter.sendErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.addSqlBinding);
		return;
	}

	// 6. Add sql extension package reference to project. If the reference is already there, it doesn't get added again
	await packageHelper.addPackageToAFProjectContainingFile(uri.fsPath, constants.sqlExtensionPackageName);
}

