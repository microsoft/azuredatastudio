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
					label: localize('deployCluster.AdminUsername', "Admin username"),
					required: true,
					variableName: VariableNames.AdminUserName_VariableName,
					defaultValue: 'admin',
					useCustomValidator: true,
					description: localize('deployCluster.AdminUsernameDescription', "You can use this username to access the controller and SQL Server, username for the gateway is root.")
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.AdminPassword', "Password"),
					required: true,
					variableName: VariableNames.AdminPassword_VariableName,
					defaultValue: '',
					useCustomValidator: true,
					description: localize('deployCluster.AdminPasswordDescription', "You can use this password to access the controller, SQL Server and gateway.")
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
					label: localize('deployCluster.OuDistinguishedName', "Organizational unit"),
					required: true,
					variableName: VariableNames.OrganizationalUnitDistinguishedName_VariableName,
					useCustomValidator: true,
					description: localize('deployCluster.OuDistinguishedNameDescription', "Distinguished name for the organizational unit. for example: OU=bdc,DC=contoso,DC=com")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainControllerFQDN', "Domain controller FQDN"),
					required: true,
					variableName: VariableNames.DomainControllerFQDNName_VariableName,
					useCustomValidator: true,
					description: localize('deployCluster.DomainControllerFQDNDescription', "Fully qualified domain name for the domain controller. for example: DC1.CONTOSO.COM")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainDNSIPAddresses', "Domain DNS IP addresses"),
					required: true,
					variableName: VariableNames.DomainDNSIPAddresses_VariableName,
					useCustomValidator: true,
					placeHolder: localize('deployCluster.DomainDNSIPAddressesPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.DomainDNSIPAddressesDescription', "Domain DNS servers' IP Addresses, use comma to separate them if there are multiple IP addresses.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainDNSName', "Domain DNS name"),
					required: true,
					variableName: VariableNames.DomainDNSName_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ClusterAdmins', "Cluster admin group"),
					required: true,
					variableName: VariableNames.ClusterAdmins_VariableName,
					useCustomValidator: true,
					description: localize('deployCluster.ClusterAdminsDescription', "The Active Directory group for cluster admin.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ClusterUsers', "Cluster users"),
					required: true,
					variableName: VariableNames.ClusterUsers_VariableName,
					useCustomValidator: true,
					placeHolder: localize('deployCluster.ClusterUsersPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.ClusterUsersDescription', "The Active Directory users/groups with cluster users role, use comma to separate them if there are multiple users/groups.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppOwers', "App owners"),
					required: false,
					variableName: VariableNames.AppOwners_VariableName,
					useCustomValidator: true,
					placeHolder: localize('deployCluster.AppOwnersPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.AppOwnersDescription', "The Active Directory users or groups with app owners role, use comma to separate them if there are multiple users/groups.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppReaders', "App readers"),
					required: false,
					variableName: VariableNames.AppReaders_VariableName,
					useCustomValidator: true,
					placeHolder: localize('deployCluster.AppReadersPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.AppReadersDescription', "The Active Directory users or groups of app readers, use comma as separator them if there are multiple users/groups.")
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
						!isInputBoxEmpty(getInputBoxComponent(VariableNames.OrganizationalUnitDistinguishedName_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.DomainControllerFQDNName_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ClusterAdmins_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ClusterUsers_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.DomainDNSIPAddresses_VariableName, this.inputComponents))
						&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.DomainDNSName_VariableName, this.inputComponents))));
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
