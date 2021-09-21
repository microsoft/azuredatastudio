/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IOptionsSourceProvider } from 'resource-deployment';
import * as vscode from 'vscode';
import { ValidationInfo } from './ui/validation/validations';

export const NoteBookEnvironmentVariablePrefix = 'AZDATA_NB_VAR_';

export interface ResourceType {
	name: string;
	displayName: string;
	description: string;
	platforms: string[] | '*';
	icon: { light: string; dark: string } | string;
	options: ResourceTypeOption[];
	providers: DeploymentProvider[];
	agreements?: AgreementInfo[];
	displayIndex?: number;
	okButtonText?: OkButtonTextValue[];
	helpTexts: HelpText[];
	getOkButtonText(selectedOptions: { option: string, value: string }[]): string | undefined;
	getProvider(selectedOptions: { option: string, value: string }[]): DeploymentProvider | undefined;
	getAgreementInfo(selectedOptions: { option: string, value: string }[]): AgreementInfo | undefined;
	getHelpText(selectedOption: { option: string, value: string }[]): HelpText | undefined;
	tags?: string[];
}

export interface ResourceSubType {
	/**
	 * The name of the Resource Type this subtype is extending
	 */
	resourceName: string;
	/**
	 * The option name should have a matching name in ResourceType.options
	 */
	options: ResourceTypeOption[];
	tags?: string[];
	provider: DeploymentProvider;
	okButtonText?: OkButtonTextValue;
	agreement?: AgreementInfo;
	helpText?: HelpText;
}

export interface HelpText {
	template: string;
	links?: azdata.LinkArea[];
	when?: string;
}

export interface AgreementInfo {
	template: string;
	links?: azdata.LinkArea[];
	when?: string;
}

export interface ResourceTypeOption {
	name: string;
	displayName: string;
	values: ResourceTypeOptionValue[];
}

export interface ResourceTypeOptionValue {
	name: string;
	displayName: string;
}

export interface OkButtonTextValue {
	value: string;
	when: string;
}

export interface DialogDeploymentProvider extends DeploymentProviderBase {
	dialog: DialogInfo;
}

export interface BdcWizardDeploymentProvider extends DeploymentProviderBase {
	bdcWizard: BdcWizardInfo;
}

export interface NotebookWizardDeploymentProvider extends DeploymentProviderBase {
	notebookWizard: NotebookWizardInfo;
}

export interface NotebookDeploymentProvider extends DeploymentProviderBase {
	notebook: string | NotebookPathInfo;
}

export interface WebPageDeploymentProvider extends DeploymentProviderBase {
	webPageUrl: string;
}

export interface DownloadDeploymentProvider extends DeploymentProviderBase {
	downloadUrl: string;
}

export interface CommandDeploymentProvider extends DeploymentProviderBase {
	command: string;
}

export interface AzureSQLVMDeploymentProvider extends DeploymentProviderBase {
	azureSQLVMWizard: AzureSQLVMWizardInfo;
}

export interface AzureSQLDBDeploymentProvider extends DeploymentProviderBase {
	azureSQLDBWizard: AzureSQLDBWizardInfo;
}

export function instanceOfDialogDeploymentProvider(obj: any): obj is DialogDeploymentProvider {
	return obj && 'dialog' in obj;
}

export function instanceOfWizardDeploymentProvider(obj: any): obj is BdcWizardDeploymentProvider {
	return obj && 'bdcWizard' in obj;
}

export function instanceOfNotebookWizardDeploymentProvider(obj: any): obj is NotebookWizardDeploymentProvider {
	return obj && 'notebookWizard' in obj;
}

export function instanceOfNotebookDeploymentProvider(obj: any): obj is NotebookDeploymentProvider {
	return obj && 'notebook' in obj;
}

export function instanceOfWebPageDeploymentProvider(obj: any): obj is WebPageDeploymentProvider {
	return obj && 'webPageUrl' in obj;
}

export function instanceOfDownloadDeploymentProvider(obj: any): obj is DownloadDeploymentProvider {
	return obj && 'downloadUrl' in obj;
}

export function instanceOfCommandDeploymentProvider(obj: any): obj is CommandDeploymentProvider {
	return obj && 'command' in obj;
}

export function instanceOfAzureSQLVMDeploymentProvider(obj: any): obj is AzureSQLVMDeploymentProvider {
	return obj && 'azureSQLVMWizard' in obj;
}

export function instanceOfAzureSQLDBDeploymentProvider(obj: any): obj is AzureSQLDBDeploymentProvider {
	return obj && 'azureSQLDBWizard' in obj;
}

export interface DeploymentProviderBase {
	name: string;
	requiredTools: ToolRequirementInfo[];
	when: string;
}

export type DeploymentProvider = DialogDeploymentProvider | BdcWizardDeploymentProvider | NotebookWizardDeploymentProvider | NotebookDeploymentProvider | WebPageDeploymentProvider | DownloadDeploymentProvider | CommandDeploymentProvider | AzureSQLVMDeploymentProvider | AzureSQLDBDeploymentProvider;

export interface BdcWizardInfo {
	notebook: string | NotebookPathInfo;
	type: BdcDeploymentType;
}
/**
 * An object that configures Script and Done buttons of the wizard.
 */
export interface WizardAction {
	label?: string
}

/**
 * 	This object defines the shape, form and behavior of a Notebook Wizard.
 */
export interface NotebookWizardInfo extends WizardInfoBase {
	/**
	 *	path to the template python notebook that is modified with variables collected in the wizard. A copy of this modified notebook is executed at the end of the wizard either from commonadline of from notebook editor in ADS.
	*/
	notebook: string | NotebookPathInfo;
	/**
	 * 	0 based position number where the variables values are inserted into the notebook as python statements.
	 */
	codeCellInsertionPosition?: number;
	/**
	 * 	This array defines the json for the pages of this wizard.
	 */
	pages: NotebookWizardPageInfo[]
}

export interface WizardInfoBase extends FieldInfoBase {
	type?: DeploymentType;
	/**
	 * 	done button attributes.
	 */
	doneAction: WizardAction;
	/**
	 * script button attributes.
	 */
	scriptAction?: WizardAction;
	/**
	 * 	title displayed on every page of the wizard
	 */
	title: string;
	name?: string;
	/**
	 * 	This array defines the json for the pages of this wizard.
	 */
	pages: PageInfoBase[];
	/**
	 * 	if true an auto generated summary page is inserted at the end of the wizard
	 */
	isSummaryPageAutoGenerated?: boolean
}

export interface NotebookWizardPageInfo extends PageInfoBase {
	description?: string;
}
export interface NotebookBasedDialogInfo extends DialogInfoBase {
	notebook: string | NotebookPathInfo | NotebookInfo[];
	runNotebook?: boolean;
	taskName?: string;
}

export interface CommandBasedDialogInfo extends DialogInfoBase {
	command: string;
}

export interface AzureSQLVMWizardInfo {
	notebook: string | NotebookPathInfo;
}

export interface AzureSQLDBWizardInfo {
	notebook: string | NotebookPathInfo;
}

export type DialogInfo = NotebookBasedDialogInfo | CommandBasedDialogInfo;

export function instanceOfNotebookBasedDialogInfo(obj: any): obj is NotebookBasedDialogInfo {
	return obj && 'notebook' in obj;
}

export function instanceOfCommandBasedDialogInfo(obj: any): obj is CommandBasedDialogInfo {
	return obj && 'command' in obj;
}

export function instanceOfDynamicEnablementInfo(obj: any): obj is DynamicEnablementInfo {
	return (<DynamicEnablementInfo>obj)?.target !== undefined && (<DynamicEnablementInfo>obj)?.value !== undefined;
}

export function instanceOfDynamicOptionsInfo(obj: any): obj is DynamicOptionsInfo {
	return (<DynamicOptionsInfo>obj)?.target !== undefined && (<DynamicOptionsInfo>obj)?.alternates !== undefined;
}

export interface DialogInfoBase {
	title: string;
	name: string;
	tabs: DialogTabInfo[];
	actionText?: string;
}

export interface DialogTabInfo extends PageInfoBase {
}

export interface PageInfoBase extends FieldInfoBase {
	title: string;
	isSummaryPage?: boolean;
	sections: SectionInfo[];
}

export interface TextCSSStyles {
	fontStyle?: FontStyle | undefined;
	fontWeight?: FontWeight | undefined;
	color?: string;
	[key: string]: string | undefined;
}

export type ComponentCSSStyles = {
	[key: string]: string;
};

export interface IOptionsSource {
	provider?: IOptionsSourceProvider
	loadingText?: string,
	loadingCompletedText?: string,
	readonly variableNames?: { [index: string]: string; };
	readonly providerId: string;
}


export interface OptionsInfo {
	values?: string[] | azdata.CategoryValue[],
	source?: IOptionsSource,
	defaultValue: string,
	optionsType?: OptionsType
}

export interface DynamicEnablementInfo {
	target: string,
	value: string
}

export interface DynamicOptionsInfo {
	target: string,
	alternates: DynamicOptionsAlternates[]
}

export interface DynamicOptionsAlternates {
	selection: string,
	alternateValues: string[],
	defaultValue: string
}

export interface ValueProviderInfo {
	providerId: string,
	triggerField: string
}

export interface FieldInfoBase {
	labelWidth?: string;
	inputWidth?: string;
	labelPosition?: LabelPosition; // Default value is top
	fieldWidth?: string;
	fieldHeight?: string;
	fieldAlignItems?: azdata.AlignItemsType;
}
export interface SectionInfo extends FieldInfoBase {
	title?: string;
	fields?: FieldInfo[]; // Use this if the dialog is not wide. All fields will be displayed in one column, label will be placed on top of the input component.
	rows?: RowInfo[]; // Use this for wide dialog or wizard. label will be placed to the left of the input component.
	collapsible?: boolean;
	collapsed?: boolean;
	spaceBetweenFields?: string;
}

export interface RowInfo {
	cssStyles?: ComponentCSSStyles;
	items: FieldInfo[] | RowInfo[];
}

export interface SubFieldInfo {
	label: string;
	variableName?: string;
}

export interface FieldInfo extends SubFieldInfo, FieldInfoBase {
	subFields?: SubFieldInfo[];
	type: FieldType;
	defaultValue?: string;
	confirmationRequired?: boolean;
	confirmationLabel?: string;
	min?: number;
	max?: number;
	required?: boolean;
	options?: string[] | azdata.CategoryValue[] | OptionsInfo;
	placeHolder?: string;
	userName?: string; // needed for sql server's password complexity requirement check, password can not include the login name.
	description?: string;
	labelCSSStyles?: TextCSSStyles;
	fontWeight?: FontWeight;
	links?: azdata.LinkArea[];
	editable?: boolean; // for editable drop-down,
	enabled?: boolean | DynamicEnablementInfo;
	dynamicOptions?: DynamicOptionsInfo;
	isEvaluated?: boolean;
	validations?: ValidationInfo[];
	valueProvider?: ValueProviderInfo;
}

export interface KubeClusterContextFieldInfo extends FieldInfo {
	configFileVariableName?: string;
}
export interface AzureAccountFieldInfo extends AzureLocationsFieldInfo {
	subscriptionVariableName?: string;
	resourceGroupVariableName?: string;
	allowNewResourceGroup?: boolean;
	newResourceGroupFlagVariableName?: string;
	newResourceGroupNameVariableName?: string;
}

export interface AzureLocationsFieldInfo extends FieldInfo {
	locationVariableName?: string;
	locations?: string[]
}

export interface FilePickerFieldInfo extends FieldInfo {
	filter: FilePickerFilter;
}

export interface FilePickerFilter {
	displayName: string;
	fileTypes: string[];
}

export const enum LabelPosition {
	Top = 'top',
	Left = 'left'
}

export const enum FontStyle {
	Normal = 'normal',
	Italic = 'italic'
}

export enum FontWeight {
	Normal = 'normal',
	Bold = 'bold'
}

export enum FieldType {
	Text = 'text',
	Number = 'number',
	DateTimeText = 'datetime_text',
	SQLPassword = 'sql_password',
	Password = 'password',
	Options = 'options',
	ReadonlyText = 'readonly_text',
	Checkbox = 'checkbox',
	AzureAccount = 'azure_account',
	AzureLocations = 'azure_locations',
	FilePicker = 'file_picker',
	KubeClusterContextPicker = 'kube_cluster_context_picker',
	KubeStorageClass = 'kube_storage_class'
}

export enum OptionsType {
	Dropdown = 'dropdown',
	Radio = 'radio'
}

export interface NotebookPathInfo {
	win32: string;
	darwin: string;
	linux: string;
}

export interface NotebookInfo {
	/**
	 * Type of the notebook, for example: powershell, python...
	 */
	type: string;
	path: string;
}

export enum OsDistribution {
	win32 = 'win32',
	darwin = 'darwin',
	debian = 'debian',
	others = 'others'
}
export interface OsRelease extends JSON {
	type: string;
	platform: string;
	hostname: string;
	arch: string;
	release: string;
	id?: string;
	id_like?: string;
}

export interface ToolRequirementInfo {
	name: string;
	version?: string;
}

export enum ToolType {
	AzCli,
	KubeCtl,
	Docker,
	Azdata
}

export const enum ToolStatus {
	NotInstalled = 'NotInstalled',
	Installed = 'Installed',
	Installing = 'Installing',
	Error = 'Error',
	Failed = 'Failed'
}

export interface ITool {
	readonly name: string;
	readonly displayName: string;
	readonly description: string;
	readonly type: ToolType;
	readonly homePage: string;
	readonly displayStatus: string;
	readonly dependencyMessages: string[];
	readonly statusDescription?: string;
	readonly autoInstallSupported: boolean;
	readonly autoInstallNeeded: boolean;
	readonly status: ToolStatus;
	readonly installationPathOrAdditionalInformation?: string;
	readonly outputChannelName: string;
	readonly fullVersion?: string;
	readonly onDidUpdateData: vscode.Event<ITool>;

	showOutputChannel(preserveFocus?: boolean): void;
	finishInitialization(): Promise<void>;
	install(): Promise<void>;
	isSameOrNewerThan(version: string): boolean;
	isEulaAccepted(): Promise<boolean>;
	promptForEula(): Promise<boolean>;
}

export const enum BdcDeploymentType {
	NewAKS = 'new-aks',
	ExistingAKS = 'existing-aks',
	ExistingKubeAdm = 'existing-kubeadm',
	ExistingARO = 'existing-aro',
	ExistingOpenShift = 'existing-openshift'
}

export type DeploymentType = BdcDeploymentType;

export interface Command {
	command: string;
	sudo?: boolean;
	comment?: string;
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
	ignoreError?: boolean;
}

/**
 * Map of the set of variables and the values to assign to them upon initialization - overriding the base default.
 */
export type InitialVariableValues = { [key: string]: string | boolean };
