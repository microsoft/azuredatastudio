/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { OptionsSourceType } from './helpers/optionSources';
import { FieldType, OptionsType } from './interfaces';

const localize = nls.loadMessageBundle();

export const account = localize('azure.account', "Azure Account");
export const subscription = localize('azure.account.subscription', "Subscription");
export const resourceGroup = localize('azure.account.resourceGroup', "Resource Group");
export const location = localize('azure.account.location', "Azure Location");
export const browse = localize('filePicker.browse', "Browse");
export const select = localize('button.label', "Select");
export const kubeConfigFilePath = localize('kubeConfigClusterPicker.kubeConfigFilePath', "Kube config file path");
export const clusterContextNotFound = localize('kubeConfigClusterPicker.clusterContextNotFound', "No cluster context information found");
export const signIn = localize('azure.signin', "Sign in…");
export const refresh = localize('azure.refresh', "Refresh");
export const createNewResourceGroup = localize('azure.resourceGroup.createNewResourceGroup', "Create a new resource group");
export const NewResourceGroupAriaLabel = localize('azure.resourceGroup.NewResourceGroupAriaLabel', "New resource group name");
export const realm = localize('deployCluster.Realm', "Realm");
export const unexpectedOptionsSourceType = (type: OptionsSourceType) => localize('optionsSourceType.Invalid', "Invalid options source type:{0}", type);
export const unknownFieldTypeError = (type: FieldType) => localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", type);
export const variableValueFetchForUnsupportedVariable = (variableName: string) => localize('getVariableValue.unknownVariableName', "Attempt to get variable value for unknown variable:{0}", variableName);
export const isPasswordFetchForUnsupportedVariable = (variableName: string) => localize('getIsPassword.unknownVariableName', "Attempt to get isPassword for unknown variable:{0}", variableName);
export const noControllersConnected = localize('noControllersConnected', "No Azure Arc controllers are currently connected. Please run the command: 'Connect to Existing Azure Arc Controller' and then try again");
export const noOptionsSourceDefined = (optionsSourceType: string) => localize('noOptionsSourceDefined', "No OptionsSource defined for type: {0}", optionsSourceType);
export const noControllerInfoFound = (name: string) => localize('noControllerInfoFound', "controllerInfo could not be found with name: {0}", name);
export const noPasswordFound = (controllerName: string) => localize('noPasswordFound', "Password could not be retrieved for controller: {0} and user did not provide a password. Please retry later.", controllerName);
export const optionsNotDefined = (fieldType: FieldType) => localize('optionsNotDefined', "FieldInfo.options was not defined for field type: {0}", fieldType);
export const optionsNotObjectOrArray = localize('optionsNotObjectOrArray', "FieldInfo.options must be an object if it is not an array");
export const optionsTypeNotFound = localize('optionsTypeNotFound', "When FieldInfo.options is an object it must have 'optionsType' property");
export const optionsTypeRadioOrDropdown = localize('optionsTypeRadioOrDropdown', "When optionsType is not {0} then it must be {1}", OptionsType.Radio, OptionsType.Dropdown);
export const azdataEulaNotAccepted = localize('azdataEulaNotAccepted', "Deployment cannot continue. Azure Data CLI license terms have not yet been accepted. Please accept the EULA to enable the features that requires Azure Data CLI.");
export const azdataEulaDeclined = localize('azdataEulaDeclined', "Deployment cannot continue. Azure Data CLI license terms were declined.You can either Accept EULA to continue or Cancel this operation");
export const acceptEulaAndSelect = localize('deploymentDialog.RecheckEulaButton', "Accept EULA & Select");
export const scriptToNotebook = localize('ui.ScriptToNotebookButton', "Script");
export const deployNotebook = localize('ui.DeployButton', "Run");
