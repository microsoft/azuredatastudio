/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType, LabelPosition } from '../../../interfaces';
import { createSection, InputComponents, setModelValues, Validator, isInputBoxEmpty, getInputBoxComponent, isValidSQLPassword, getInvalidSQLPasswordMessage, getPasswordMismatchMessage, MissingRequiredInformationErrorMessage } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { EOL } from 'os';
import { AuthenticationMode } from '../deployClusterWizardModel';
const localize = nls.loadMessageBundle();

const ConfirmPasswordName = 'ConfirmPassword';
export class ClusterSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ClusterSettingsPageTitle', "Cluster settings"),
			localize('deployCluster.ClusterSettingsPageDescription', "Configure the SQL Server Big Data Cluster settings"), wizard);
	}

	public initialize(): void {
		const self = this;
		const basicSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			title: '',
			fields: [
				{
					type: FieldType.Text,
					label: localize('deployCluster.ClusterName', "Cluster name"),
					required: true,
					variableName: VariableNames.ClusterName_VariableName,
					defaultValue: 'mssql-cluster',
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ControllerUsername', "Controller username"),
					required: true,
					variableName: VariableNames.AdminUserName_VariableName,
					defaultValue: 'admin',
					useCustomValidator: true
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.AdminPassword', "Password"),
					required: true,
					variableName: VariableNames.AdminPassword_VariableName,
					defaultValue: '',
					useCustomValidator: true,
					description: localize('deployCluster.AdminPasswordDescription', "You can also use this password to access SQL Server and gateway.")
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.ConfirmPassword', "Confirm password"),
					required: true,
					variableName: ConfirmPasswordName,
					defaultValue: '',
					useCustomValidator: true,
				}, {
					type: FieldType.Options,
					label: localize('deployCluster.AuthenticationMode', "Authentication mode"),
					required: true,
					variableName: VariableNames.AuthenticationMode_VariableName,
					defaultValue: AuthenticationMode.Basic,
					options: [
						{
							name: AuthenticationMode.Basic,
							displayName: localize('deployCluster.AuthenticationMode.Basic', "Basic")
						},
						{
							name: AuthenticationMode.ActiveDirectory,
							displayName: localize('deployCluster.AuthenticationMode.ActiveDirectory', "Active Directory")

						}
					]
				}
			]
		};

		const activeDirectorySection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			title: localize('deployCluster.ActiveDirectorySettings', "Active Directory settings"),
			fields: [
				{
					type: FieldType.Text,
					label: localize('deployCluster.DistinguishedName', "Distinguished name"),
					required: true,
					variableName: VariableNames.DistinguishedName_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AdminPrincipals', "Admin principals"),
					required: true,
					variableName: VariableNames.AdminPrincipals_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.UserPrincipals', "User principals"),
					required: true,
					variableName: VariableNames.UserPrincipals_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.UpstreamIPAddresses', "Upstream IP Addresses"),
					required: true,
					variableName: VariableNames.UpstreamIPAddresses_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DNSName', "DNS name"),
					required: true,
					variableName: VariableNames.DnsName_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.Realm', "Realm"),
					required: true,
					variableName: VariableNames.Realm_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppOnwerPrincipals', "App owner principals"),
					required: true,
					variableName: VariableNames.AppOwnerPrincipals_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppReaderPrincipals', "App reader principals"),
					required: true,
					variableName: VariableNames.AppReaderPrincipals_VariableName,
					useCustomValidator: true
				}
			]
		};
		this.pageObject.registerContent((view: azdata.ModelView) => {
			const basicSettingsGroup = createSection({
				view: view,
				container: self.wizard.wizardObject,
				sectionInfo: basicSection,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, component: azdata.DropDownComponent | azdata.InputBoxComponent | azdata.CheckBoxComponent): void => {
					self.inputComponents[name] = component;
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				}
			});
			const activeDirectorySettingsGroup = createSection({
				view: view,
				container: self.wizard.wizardObject,
				sectionInfo: activeDirectorySection,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, component: azdata.DropDownComponent | azdata.InputBoxComponent | azdata.CheckBoxComponent): void => {
					self.inputComponents[name] = component;
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				}
			});
			const basicSettingsFormItem = { title: '', component: basicSettingsGroup };
			const activeDirectoryFormItem = { title: '', component: activeDirectorySettingsGroup };
			const authModeDropdown = <azdata.DropDownComponent>this.inputComponents[VariableNames.AuthenticationMode_VariableName];
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[basicSettingsFormItem],
				{
					horizontal: false,
					componentWidth: '100%'
				}
			);
			this.wizard.registerDisposable(authModeDropdown.onValueChanged(() => {
				const isBasicAuthMode = (<azdata.CategoryValue>authModeDropdown.value).name === 'basic';

				if (isBasicAuthMode) {
					formBuilder.removeFormItem(activeDirectoryFormItem);
				} else {
					formBuilder.insertFormItem(activeDirectoryFormItem);
				}
			}));

			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	public onLeave() {
		setModelValues(this.inputComponents, this.wizard.model);
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public onEnter() {
		const authModeDropdown = <azdata.DropDownComponent>this.inputComponents[VariableNames.AuthenticationMode_VariableName];
		if (authModeDropdown) {
			authModeDropdown.enabled = this.wizard.model.adAuthSupported;
		}

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const messages: string[] = [];
				const authMode = typeof authModeDropdown.value === 'string' ? authModeDropdown.value : authModeDropdown.value!.name;
				const requiredFieldsFilled: boolean = !isInputBoxEmpty(getInputBoxComponent(VariableNames.ClusterName_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.AdminUserName_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.AdminPassword_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(ConfirmPasswordName, this.inputComponents))
					&& (!(authMode === AuthenticationMode.ActiveDirectory) || (
						!isInputBoxEmpty(getInputBoxComponent(VariableNames.DistinguishedName_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.AdminPrincipals_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.UserPrincipals_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.UpstreamIPAddresses_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.DnsName_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.Realm_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.AppOwnerPrincipals_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.AppReaderPrincipals_VariableName, this.inputComponents))));
				if (!requiredFieldsFilled) {
					messages.push(MissingRequiredInformationErrorMessage);
				}

				if (!isInputBoxEmpty(getInputBoxComponent(VariableNames.AdminPassword_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(ConfirmPasswordName, this.inputComponents))) {
					const password = getInputBoxComponent(VariableNames.AdminPassword_VariableName, this.inputComponents).value!;
					const confirmPassword = getInputBoxComponent(ConfirmPasswordName, this.inputComponents).value!;
					if (password !== confirmPassword) {
						messages.push(getPasswordMismatchMessage(localize('deployCluster.AdminPasswordField', "Password")));
					}
					if (!isValidSQLPassword(password)) {
						messages.push(getInvalidSQLPasswordMessage(localize('deployCluster.AdminPasswordField', "Password")));
					}
				}

				if (messages.length > 0) {
					this.wizard.wizardObject.message = {
						text: messages.length === 1 ? messages[0] : localize('deployCluster.ValidationError', "There are some errors on this page, click 'Show Details' to view the errors."),
						description: messages.length === 1 ? undefined : messages.join(EOL),
						level: azdata.window.MessageLevel.Error
					};
				}
				return messages.length === 0;
			}
			return true;
		});
	}
}
