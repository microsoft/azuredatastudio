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

		if (vscode.window.activeTextEditor!.document.isDirty) {
			const result = await vscode.window.showWarningMessage(constants.saveChangesInFile, { modal: true }, constants.save);

			if (result !== constants.save) {
				return;
			}

			await vscode.window.activeTextEditor!.document.save();
		}
	}

	// get all the Azure functions in the file
	const azureFunctionsService = await utils.getAzureFunctionService();
	let getAzureFunctionsResult;
	try {
		getAzureFunctionsResult = await azureFunctionsService.getAzureFunctions(uri.fsPath);
	} catch (e) {
		void vscode.window.showErrorMessage(e.message);
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
		placeHolder: constants.placeHolderObject,
		validateInput: input => input ? undefined : constants.nameMustNotBeEmpty,
		ignoreFocusOut: true
	});

	if (!objectName) {
		return;
	}

	// 4. ask for connection string setting name
	let projectUri: vscode.Uri | undefined;
	try {
		projectUri = await azureFunctionsUtils.getAFProjectContainingFile(uri);
	} catch (e) {
		// continue even if there's no AF project found. The binding should still be able to be added as long as there was an azure function found in the file earlier
	}

	let connectionStringSettingName;

	// show the settings from project's local.settings.json if there's an AF functions project
	if (projectUri) {
		let settings;
		try {
			settings = await azureFunctionsUtils.getLocalSettingsJson(path.join(path.dirname(projectUri.fsPath!), constants.azureFunctionLocalSettingsFileName));
		} catch (e) {
			void vscode.window.showErrorMessage(e.message);
			return;
		}

		let existingSettings: (vscode.QuickPickItem & { isCreateNew?: boolean })[] = [];
		if (settings?.Values) {
			existingSettings = Object.keys(settings.Values).map(setting => {
				return {
					label: setting
				} as vscode.QuickPickItem & { isCreateNew?: boolean };
			});
		}

		existingSettings.unshift({ label: constants.createNewLocalAppSettingWithIcon, isCreateNew: true });

		while (!connectionStringSettingName) {
			const selectedSetting = await vscode.window.showQuickPick(existingSettings, {
				canPickMany: false,
				title: constants.selectSetting,
				ignoreFocusOut: true
			});
			if (!selectedSetting) {
				// User cancelled
				return;
			}

			if (selectedSetting.isCreateNew) {
				const newConnectionStringSettingName = await vscode.window.showInputBox(
					{
						title: constants.enterConnectionStringSettingName,
						ignoreFocusOut: true,
						validateInput: input => input ? undefined : constants.nameMustNotBeEmpty
					}
				) ?? '';

				if (!newConnectionStringSettingName) {
					// go back to select setting quickpick if user escapes from inputting the setting name in case they changed their mind
					continue;
				}

				const newConnectionStringValue = await vscode.window.showInputBox(
					{
						title: constants.enterConnectionString,
						ignoreFocusOut: true,
						validateInput: input => input ? undefined : constants.valueMustNotBeEmpty
					}
				) ?? '';

				if (!newConnectionStringValue) {
					// go back to select setting quickpick if user escapes from inputting the value in case they changed their mind
					continue;
				}

				try {
					const success = await azureFunctionsUtils.setLocalAppSetting(path.dirname(projectUri.fsPath), newConnectionStringSettingName, newConnectionStringValue);
					if (success) {
						connectionStringSettingName = newConnectionStringSettingName;
					}
				} catch (e) {
					// display error message and show select setting quickpick again
					void vscode.window.showErrorMessage(e.message);
				}
				// If user cancels out of this or doesn't want to overwrite an existing setting
				// just return them to the select setting quickpick in case they changed their mind
			} else {
				connectionStringSettingName = selectedSetting.label;
			}
		}

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
		void vscode.window.showErrorMessage(e.message);
		TelemetryReporter.sendErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding);
		return;
	}

	// 6. Add sql extension package reference to project. If the reference is already there, it doesn't get added again
	await packageHelper.addPackageToAFProjectContainingFile(uri, constants.sqlExtensionPackageName);
}

