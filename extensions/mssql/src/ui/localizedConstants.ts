/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const HelpText: string = localize('mssql.ui.helpText', "Help");
export const YesText: string = localize('mssql.ui.yesText', "Yes");
export const OkText: string = localize('mssql.ui.OkText', "OK");
export const CreateText: string = localize('mssql.ui.create', "Create");
export const SaveText: string = localize('mssql.ui.save', "Apply");
export const LoadingDialogText: string = localize('mssql.ui.loadingDialog', "Loading dialog...");
export const ValidateAndApplyChangesText: string = localize('mssql.ui.validateAndApplyChanges', "Validating and applying changes...");
export const ValidateAndCreateDatabaseText: string = localize('mssql.ui.validateAndCreateDatabase', "Validating and creating database...");
export const LoadingDialogCompletedText: string = localize('mssql.ui.loadingDialog', "Loading dialog completed");
export const ScriptText: string = localize('mssql.ui.scriptText', "Script");
export const SelectText = localize('objectManagement.selectLabel', "Select");
export const AddText = localize('objectManagement.addText', "Add…");
export const RemoveText = localize('objectManagement.removeText', "Remove");
export const NoActionScriptedMessage: string = localize('mssql.ui.noActionScriptedMessage', "There is no action to be scripted.");
export const ScriptGeneratedText: string = localize('mssql.ui.scriptGenerated', "Script has been generated successfully. You can close the dialog to view it in the newly opened editor.")
export const GeneratingScriptText: string = localize('mssql.ui.generatingScript', "Generating script...");
export const GeneratingScriptCompletedText: string = localize('mssql.ui.generatingScriptCompleted', "Script generated");

export function scriptError(error: string): string {
	return localize('mssql.ui.scriptError', "An error occurred while generating the script. {0}", error);
}
