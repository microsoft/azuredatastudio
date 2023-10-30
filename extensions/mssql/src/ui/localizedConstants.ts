/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const HelpText: string = localize('mssql.ui.helpText', "Help");
export const YesText: string = localize('mssql.ui.yesText', "Yes");
export const OkText: string = localize('mssql.ui.OkText', "OK");
export const LoadingDialogText: string = localize('mssql.ui.loadingDialog', "Loading dialog...");
export const LoadingDialogCompletedText: string = localize('mssql.ui.loadingDialog', "Loading dialog completed");
export const ScriptText: string = localize('mssql.ui.scriptText', "Script");
export const SelectText = localize('objectManagement.selectLabel', "Select");
export const AddText = localize('objectManagement.addText', "Add…");
export const EditText = localize('objectManagement.editText', "Edit");
export const RemoveText = localize('objectManagement.removeText', "Remove");
export const NoActionScriptedMessage: string = localize('mssql.ui.noActionScriptedMessage', "There is no action to be scripted.");
export const ScriptGeneratedText: string = localize('mssql.ui.scriptGenerated', "Script has been generated successfully. You can close the dialog to view it in the newly opened editor.")
export const GeneratingScriptText: string = localize('mssql.ui.generatingScript', "Generating script...");
export const GeneratingScriptCompletedText: string = localize('mssql.ui.generatingScriptCompleted', "Script generated");

export function scriptError(error: string): string {
	return localize('mssql.ui.scriptError', "An error occurred while generating the script. {0}", error);
}
