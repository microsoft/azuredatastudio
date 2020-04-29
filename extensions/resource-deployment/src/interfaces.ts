/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export const NoteBookEnvironmentVariablePrefix = 'AZDATA_NB_VAR_';

export interface ResourceType {
	name: string;
	displayName: string;
	description: string;
	platforms: string[] | '*';
	icon: { light: string; dark: string };
	options: ResourceTypeOption[];
	providers: DeploymentProvider[];
	agreement?: AgreementInfo;
	displayIndex?: number;
	getProvider(selectedOptions: { option: string, value: string }[]): DeploymentProvider | undefined;
}

export interface AgreementInfo {
	template: string;
	links: azdata.LinkArea[];
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

export interface DialogDeploymentProvider extends DeploymentProviderBase {
	dialog: DialogInfo;
}

export interface BdcWizardDeploymentProvider extends DeploymentProviderBase {
	bdcWizard: WizardInfo;
}

export interface NotebookWizardDeploymentProvider extends DeploymentProviderBase {
	notebookWizard: NotebookWizardInfo;
}

export interface NotebookDeploymentProvider extends DeploymentProviderBase {
	notebook: string | NotebookInfo;
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

export interface DeploymentProviderBase {
	requiredTools: ToolRequirementInfo[];
	when: string;
}

export type DeploymentProvider = DialogDeploymentProvider | BdcWizardDeploymentProvider | NotebookWizardDeploymentProvider | NotebookDeploymentProvider | WebPageDeploymentProvider | DownloadDeploymentProvider | CommandDeploymentProvider;

export interface WizardInfo {
	notebook: string | NotebookInfo;
	type: BdcDeploymentType;
}

export interface NotebookWizardInfo extends WizardInfoBase {
	notebook: string | NotebookInfo;
}

export interface WizardInfoBase extends SharedFieldAttributes {
	taskName?: string;
	type?: DeploymentType;
	runNotebook?: boolean;
	actionText?: string;
	title: string;
	pages: NotebookWizardPageInfo[];
	summaryPage: NotebookWizardPageInfo;
	generateSummaryPage: boolean;
}

export interface NotebookWizardPageInfo extends PageInfoBase {
	description?: string;
}
export interface NotebookBasedDialogInfo extends DialogInfoBase {
	notebook: string | NotebookInfo;
	runNotebook?: boolean;
	taskName?: string;
}

export interface CommandBasedDialogInfo extends DialogInfoBase {
	command: string;
}

export type DialogInfo = NotebookBasedDialogInfo | CommandBasedDialogInfo;

export function instanceOfNotebookBasedDialogInfo(obj: any): obj is NotebookBasedDialogInfo {
	return obj && 'notebook' in obj;
}

export function instanceOfCommandBasedDialogInfo(obj: any): obj is CommandBasedDialogInfo {
	return obj && 'command' in obj;
}

export interface DialogInfoBase {
	title: string;
	name: string;
	tabs: DialogTabInfo[];
	actionText?: string;
}

export interface DialogTabInfo extends PageInfoBase {
}

export interface PageInfoBase extends SharedFieldAttributes {
	title: string;
	isSummaryPage?: boolean;
	sections: SectionInfo[];
}

export interface SharedFieldAttributes {
	labelWidth?: string;
	inputWidth?: string;
	labelPosition?: LabelPosition; // Default value is top
}
export interface SectionInfo extends SharedFieldAttributes {
	title?: string;
	fields?: FieldInfo[]; // Use this if the dialog is not wide. All fields will be displayed in one column, label will be placed on top of the input component.
	rows?: RowInfo[]; // Use this for wide dialog or wizard. label will be placed to the left of the input component.
	collapsible?: boolean;
	collapsed?: boolean;
	spaceBetweenFields?: string;
}

export interface RowInfo {
	fields: FieldInfo[];
}

export interface SubFieldInfo {
	label: string;
	variableName?: string;
}

export interface FieldInfo extends SubFieldInfo, SharedFieldAttributes {
	subFields?: SubFieldInfo[];
	type: FieldType;
	defaultValue?: string;
	confirmationRequired?: boolean;
	confirmationLabel?: string;
	textValidationRequired?: boolean;
	textValidationRegex?: string;
	textValidationDescription?: string;
	min?: number;
	max?: number;
	required?: boolean;
	options?: string[] | azdata.CategoryValue[];
	placeHolder?: string;
	userName?: string; // needed for sql server's password complexity requirement check, password can not include the login name.
	description?: string;
	fontStyle?: FontStyle;
	labelFontWeight?: FontWeight;
	textFontWeight?: FontWeight;
	links?: azdata.LinkArea[];
	editable?: boolean; // for editable drop-down,
	enabled?: boolean;
}

export interface KubeClusterContextFieldInfo extends FieldInfo {
	configFileVariableName?: string;
}
export interface AzureAccountFieldInfo extends AzureLocationsFieldInfo {
	subscriptionVariableName?: string;
	resourceGroupVariableName?: string;
}

export interface AzureLocationsFieldInfo extends FieldInfo {
	locationVariableName?: string;
	displayLocationVariableName?: string;
	locations?: string[]
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
	RadioOptions = 'radio_options',
	ReadonlyText = 'readonly_text',
	Checkbox = 'checkbox',
	AzureAccount = 'azure_account',
	AzureLocations = 'azure_locations',
	FilePicker = 'file_picker',
	KubeClusterContextPicker = 'kube_cluster_context_picker'
}

export interface NotebookInfo {
	win32: string;
	darwin: string;
	linux: string;
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
}

export const enum BdcDeploymentType {
	NewAKS = 'new-aks',
	ExistingAKS = 'existing-aks',
	ExistingKubeAdm = 'existing-kubeadm'
}

export const enum ArcDeploymentType {
	NewControlPlane = 'new-control-plane'
}

export type DeploymentType = ArcDeploymentType | BdcDeploymentType;

export interface Command {
	command: string;
	sudo?: boolean;
	comment?: string;
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
	ignoreError?: boolean;
}
