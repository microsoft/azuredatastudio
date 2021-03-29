/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as nls from 'vscode-nls';
import { getErrorMessage } from './common/utils';
import { ResourceTypeCategories } from './constants';
import { FieldType, ITool, OptionsType } from './interfaces';
const localize = nls.loadMessageBundle();

export const account = localize('azure.account', "Azure Account");
export const subscription = localize('azure.account.subscription', "Subscription (selected subset)");
export const subscriptionDescription = localize('azure.account.subscriptionDescription', "Change the currently selected subscriptions through the 'Select Subscriptions' action on an account listed in the 'Azure' tree view of the 'Connections' viewlet");
export const resourceGroup = localize('azure.account.resourceGroup', "Resource Group");
export const location = localize('azure.account.location', "Azure Location");
export const browse = localize('filePicker.browse', "Browse");
export const select = localize('button.label', "Select");
export const kubeConfigFilePath = localize('kubeConfigClusterPicker.kubeConfigFilePath', "Kube config file path");
export const clusterContextNotFound = localize('kubeConfigClusterPicker.clusterContextNotFound', "No cluster context information found");
export const signIn = localize('azure.signin', "Sign in…");
export const refresh = localize('azure.refresh', "Refresh");
export const yes = localize('azure.yes', "Yes");
export const no = localize('azure.no', "No");
export const createNewResourceGroup = localize('azure.resourceGroup.createNewResourceGroup', "Create a new resource group");
export const NewResourceGroupAriaLabel = localize('azure.resourceGroup.NewResourceGroupAriaLabel', "New resource group name");
export const realm = localize('deployCluster.Realm', "Realm");
export const unknownFieldTypeError = (type: FieldType) => localize('UnknownFieldTypeError', "Unknown field type: \"{0}\"", type);
export const optionsSourceAlreadyDefined = (optionsSourceId: string) => localize('optionsSource.alreadyDefined', "Options Source with id:{0} is already defined", optionsSourceId);
export const valueProviderAlreadyDefined = (providerId: string) => localize('valueProvider.alreadyDefined', "Value Provider with id:{0} is already defined", providerId);
export const noOptionsSourceDefined = (optionsSourceId: string) => localize('optionsSource.notDefined', "No Options Source defined for id: {0}", optionsSourceId);
export const noValueProviderDefined = (providerId: string) => localize('valueProvider.notDefined', "No Value Provider defined for id: {0}", providerId);
export const variableValueFetchForUnsupportedVariable = (variableName: string) => localize('getVariableValue.unknownVariableName', "Attempt to get variable value for unknown variable:{0}", variableName);
export const isPasswordFetchForUnsupportedVariable = (variableName: string) => localize('getIsPassword.unknownVariableName', "Attempt to get isPassword for unknown variable:{0}", variableName);
export const optionsNotDefined = (fieldType: FieldType) => localize('optionsNotDefined', "FieldInfo.options was not defined for field type: {0}", fieldType);
export const optionsNotObjectOrArray = localize('optionsNotObjectOrArray', "FieldInfo.options must be an object if it is not an array");
export const optionsTypeNotFound = localize('optionsTypeNotFound', "When FieldInfo.options is an object it must have 'optionsType' property");
export const optionsTypeRadioOrDropdown = localize('optionsTypeRadioOrDropdown', "When optionsType is not {0} then it must be {1}", OptionsType.Radio, OptionsType.Dropdown);
export const azdataEulaNotAccepted = localize('azdataEulaNotAccepted', "Deployment cannot continue. Azure Data CLI license terms have not yet been accepted. Please accept the EULA to enable the features that requires Azure Data CLI.");
export const azdataEulaDeclined = localize('azdataEulaDeclined', "Deployment cannot continue. Azure Data CLI license terms were declined.You can either Accept EULA to continue or Cancel this operation");
export const acceptEulaAndSelect = localize('deploymentDialog.RecheckEulaButton', "Accept EULA & Select");
export const extensionRequiredPrompt = (extensionName: string) => localize('resourceDeployment.extensionRequiredPrompt', "The '{0}' extension is required to deploy this resource, do you want to install it now?", extensionName);
export const install = localize('resourceDeployment.install', "Install");
export const installingExtension = (extensionName: string) => localize('resourceDeployment.installingExtension', "Installing extension '{0}'...", extensionName);
export const unknownExtension = (extensionId: string) => localize('resourceDeployment.unknownExtension', "Unknown extension '{0}'", extensionId);

export const resourceTypePickerDialogTitle = localize('resourceTypePickerDialog.title', "Select the deployment options");
export const resourceTypeSearchBoxDescription = localize('resourceTypePickerDialog.resourceSearchPlaceholder', "Filter resources...");
export const resourceTypeCategoryListViewTitle = localize('resourceTypePickerDialog.tagsListViewTitle', "Categories");
export const multipleValidationErrors = localize("validation.multipleValidationErrors", "There are some errors on this page, click 'Show Details' to view the errors.");

export const scriptToNotebook = localize('ui.ScriptToNotebookButton', "Script");
export const deployNotebook = localize('ui.DeployButton', "Run");
export const viewErrorDetail = localize('resourceDeployment.ViewErrorDetail', "View error detail");
export const failedToOpenNotebook = (error: any) => localize('resourceDeployment.FailedToOpenNotebook', "An error occurred opening the output notebook. {1}{2}.", EOL, getErrorMessage(error));
export const backgroundExecutionFailed = (taskName: string) => localize('resourceDeployment.BackgroundExecutionFailed', "The task \"{0}\" has failed.", taskName);
export const taskFailedWithNoOutputNotebook = (taskName: string) => localize('resourceDeployment.TaskFailedWithNoOutputNotebook', "The task \"{0}\" failed and no output Notebook was generated.", taskName);

export function getResourceTypeCategoryLocalizedString(resourceTypeCategory: string): string {
	switch (resourceTypeCategory) {
		case ResourceTypeCategories.All:
			return localize('resourceTypePickerDialog.resourceTypeCategoryAll', "All");
		case ResourceTypeCategories.OnPrem:
			return localize('resourceTypePickerDialog.resourceTypeCategoryOnPrem', "On-premises");
		case ResourceTypeCategories.SqlServer:
			return localize('resourceTypePickerDialog.resourceTypeCategoriesSqlServer', "SQL Server");
		case ResourceTypeCategories.Hybrid:
			return localize('resourceTypePickerDialog.resourceTypeCategoryOnHybrid', "Hybrid");
		case ResourceTypeCategories.PostgreSql:
			return localize('resourceTypePickerDialog.resourceTypeCategoryOnPostgreSql', "PostgreSQL");
		case ResourceTypeCategories.Cloud:
			return localize('resourceTypePickerDialog.resourceTypeCategoryOnCloud', "Cloud");
		default:
			return resourceTypeCategory;
	}
}

export const descriptionText = localize('resourceDeployment.Description', "Description");
export const toolText = localize('resourceDeployment.Tool', "Tool");
export const statusText = localize('resourceDeployment.Status', "Status");
export const versionText = localize('resourceDeployment.Version', "Version");
export const requiredVersionText = localize('resourceDeployment.RequiredVersion', "Required Version");
export const discoverPathOrAdditionalInformationText = localize('resourceDeployment.discoverPathOrAdditionalInformation', "Discovered Path or Additional Information");
export const requiredToolsText = localize('resourceDeployment.requiredTools', "Required tools");
export const installToolsText = localize('resourceDeployment.InstallTools', "Install tools");
export const optionsText = localize('resourceDeployment.Options', "Options");

export function getToolInstallingMessage(tool: ITool): string {
	return localize('deploymentDialog.InstallingTool', "Required tool '{0}' [ {1} ] is being installed now.", tool.displayName, tool.homePage);
}
