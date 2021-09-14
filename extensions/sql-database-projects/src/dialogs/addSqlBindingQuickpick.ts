import * as vscode from 'vscode';
import * as path from 'path';
import { BindingType } from 'vscode-mssql';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as azureFunctionsUtils from '../common/azureFunctionsUtils';
import { PackageHelper } from '../tools/packageHelper';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

export async function launchAddSqlBindingQuickpick(uri: vscode.Uri | undefined, packageHelper: PackageHelper): Promise<void> {
	TelemetryReporter.sendActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.startAddSqlBinding);

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
		prompt: selectedBinding.type === BindingType.input ? constants.sqlTableOrViewToQuery : constants.sqlTableToUpsert,
		value: constants.placeHolderObject,
		ignoreFocusOut: true
	});

	if (!objectName) {
		return;
	}

	// 4. ask for connection string setting name
	let project: string | undefined;
	try {
		project = await azureFunctionsUtils.getAFProjectContainingFile(uri.fsPath);
	} catch (e) {
		// continue even if there's no AF project found. The binding should still be able to be added as long as there was an azure function found in the file earlier
	}

	let connectionStringSettingName;

	// show the settings from project's local.settings.json if there's an AF functions project
	// TODO: allow new setting name to get added here and added to local.settings.json
	if (project) {
		const settings = await azureFunctionsUtils.getLocalSettingsJson(path.join(path.dirname(project!), constants.azureFunctionLocalSettingsFileName));
		const existingSettings: string[] = settings.Values ? Object.keys(settings.Values) : [];

		connectionStringSettingName = await vscode.window.showQuickPick(existingSettings, {
			canPickMany: false,
			title: constants.selectSetting,
			ignoreFocusOut: true
		});
	} else {
		// if no AF project was found or there's more than one AF functions project in the workspace,
		// ask for the user to input the setting name
		connectionStringSettingName = await vscode.window.showInputBox({
			prompt: constants.connectionStringSetting,
			placeHolder: constants.connectionStringSettingPlaceholder,
			ignoreFocusOut: true
		});
	}

	if (!connectionStringSettingName) {
		return;
	}

	// 5. insert binding
	try {
		const result = await azureFunctionsService.addSqlBinding(selectedBinding.type, uri.fsPath, azureFunctionName, objectName, connectionStringSettingName);

		if (!result.success) {
			void vscode.window.showErrorMessage(result.errorMessage);
			TelemetryReporter.sendErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding);
			return;
		}

		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding)
			.withAdditionalProperties({ bindingType: selectedBinding.label })
			.send();
	} catch (e) {
		void vscode.window.showErrorMessage(e);
		TelemetryReporter.sendErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding);
		return;
	}

	// 6. Add sql extension package reference to project. If the reference is already there, it doesn't get added again
	await packageHelper.addPackageToAFProjectContainingFile(uri.fsPath, constants.sqlExtensionPackageName);
}

