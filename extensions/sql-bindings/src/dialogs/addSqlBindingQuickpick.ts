/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as azureFunctionsUtils from '../common/azureFunctionsUtils';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { addSqlBinding, getAzureFunctions } from '../services/azureFunctionsService';

export async function launchAddSqlBindingQuickpick(uri: vscode.Uri | undefined): Promise<void> {
	let quickPickStep: string = '';
	let propertyBag: { [key: string]: string } = {};
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

	// get azure functions from STS request
	let getAzureFunctionsResult;
	try {
		getAzureFunctionsResult = await getAzureFunctions(uri.fsPath);
	} catch (e) {
		void vscode.window.showErrorMessage(utils.getErrorMessage(e));
		return;
	}

	// get all the Azure functions in the file
	const azureFunctions = getAzureFunctionsResult.azureFunctions;

	if (azureFunctions.length === 0) {
		void vscode.window.showErrorMessage(constants.noAzureFunctionsInFile);
		return;
	}

	try {
		// 1. select Azure function from the current file
		quickPickStep = 'getAzureFunctionProject';
		const azureFunctionName = (await vscode.window.showQuickPick(azureFunctions, {
			canPickMany: false,
			title: constants.selectAzureFunction,
			ignoreFocusOut: true
		}));

		if (!azureFunctionName) {
			return;
		}
		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.getAzureFunctionProject)
			.withAdditionalProperties(propertyBag).send();

		// 2. select input or output binding
		quickPickStep = 'getBindingType';
		const selectedBinding = await azureFunctionsUtils.promptForBindingType();

		if (!selectedBinding) {
			return;
		}
		propertyBag.bindingType = selectedBinding.type;
		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.getBindingType)
			.withAdditionalProperties(propertyBag).send();

		// 3. ask for object name for the binding
		quickPickStep = 'getObjectName';
		const objectName = await azureFunctionsUtils.promptForObjectName(selectedBinding.type);

		if (!objectName) {
			return;
		}
		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.getObjectName)
			.withAdditionalProperties(propertyBag).send();

		// 4. ask for connection string setting name
		let projectUri: vscode.Uri | undefined;
		try {
			projectUri = await azureFunctionsUtils.getAFProjectContainingFile(uri);
		} catch (e) {
			// continue even if there's no AF project found. The binding should still be able to be added as long as there was an azure function found in the file earlier
		}

		quickPickStep = 'updateConnectionString';
		let connectionStringSettingName = await azureFunctionsUtils.promptAndUpdateConnectionStringSetting(projectUri);
		if (!connectionStringSettingName) {
			return;
		}
		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.updateConnectionString)
			.withAdditionalProperties(propertyBag).send();

		// 5. insert binding
		try {
			const result = await addSqlBinding(selectedBinding.type, uri.fsPath, azureFunctionName, objectName, connectionStringSettingName);

			if (!result.success) {
				void vscode.window.showErrorMessage(result.errorMessage);
				TelemetryReporter.createErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding)
					.withAdditionalProperties(propertyBag).send();
				return;
			}
			TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding)
				.withAdditionalProperties(propertyBag).send();

		} catch (e) {
			void vscode.window.showErrorMessage(utils.getErrorMessage(e));
			TelemetryReporter.createErrorEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.finishAddSqlBinding)
				.withAdditionalProperties(propertyBag).send();
			return;
		}
	} finally {
		propertyBag.quickPickStep = quickPickStep;
		TelemetryReporter.createActionEvent(TelemetryViews.SqlBindingsQuickPick, TelemetryActions.exitSqlBindingsQuickpick)
			.withAdditionalProperties(propertyBag).send();
	}
}
