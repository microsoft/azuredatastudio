/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { FieldType, LabelPosition, SectionInfo } from '../../../interfaces';
import { createSection, getInputBoxComponent, getInvalidSQLPasswordMessage, getPasswordMismatchMessage, InputComponentInfo, InputComponents, isValidSQLPassword, setModelValues, Validator } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { DeployClusterWizard } from '../deployClusterWizard';
import { AuthenticationMode } from '../deployClusterWizardModel';
import * as localizedConstants from '../../../localizedConstants';
const localize = nls.loadMessageBundle();

const ConfirmPasswordName = 'ConfirmPassword';
const clusterNameFieldDescription = localize('deployCluster.ClusterNameDescription', "The cluster name must consist only of alphanumeric lowercase characters or '-' and must start and end with an alphanumeric character.");

export class ClusterSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};
	private activeDirectorySection!: azdata.FormComponent;
	private formBuilder!: azdata.FormBuilder;

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
					textValidationRequired: true,
					textValidationRegex: '^[a-z0-9]$|^[a-z0-9][a-z0-9-]*[a-z0-9]$',
					textValidationDescription: clusterNameFieldDescription,
					description: clusterNameFieldDescription
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AdminUsername', "Admin username"),
					required: true,
					variableName: VariableNames.AdminUserName_VariableName,
					defaultValue: 'admin',
					description: localize('deployCluster.AdminUsernameDescription', "This username will be used for controller and SQL Server. Username for the gateway will be root.")
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.AdminPassword', "Password"),
					required: true,
					variableName: VariableNames.AdminPassword_VariableName,
					defaultValue: '',
					description: localize('deployCluster.AdminPasswordDescription', "This password can be used to access the controller, SQL Server and gateway.")
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.ConfirmPassword', "Confirm password"),
					required: true,
					variableName: ConfirmPasswordName,
					defaultValue: ''
				}, {
					type: FieldType.Options,
					label: localize('deployCluster.AuthenticationMode', "Authentication mode"),
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

		const dockerSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			collapsed: true,
			collapsible: true,
			title: localize('deployCluster.DockerSettings', "Docker settings"),
			fields: [
				{
					type: FieldType.Text,
					label: localize('deployCluster.DockerRegistry', "Registry"),
					required: true,
					variableName: VariableNames.DockerRegistry_VariableName
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DockerRepository', "Repository"),
					required: true,
					variableName: VariableNames.DockerRepository_VariableName
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DockerImageTag', "Image tag"),
					required: true,
					variableName: VariableNames.DockerImageTag_VariableName
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DockerUsername', "Username"),
					required: false,
					variableName: VariableNames.DockerUsername_VariableName
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.DockerPassword', "Password"),
					required: false,
					variableName: VariableNames.DockerPassword_VariableName
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
					description: localize('deployCluster.OuDistinguishedNameDescription', "Distinguished name for the organizational unit. For example: OU=bdc,DC=contoso,DC=com.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainControllerFQDNs', "Domain controller FQDNs"),
					required: true,
					variableName: VariableNames.DomainControllerFQDNs_VariableName,
					placeHolder: localize('deployCluster.DomainControllerFQDNsPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.DomainControllerFQDNDescription', "Fully qualified domain names for the domain controller. For example: DC1.CONTOSO.COM. Use comma to separate multiple FQDNs.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainDNSIPAddresses', "Domain DNS IP addresses"),
					required: true,
					variableName: VariableNames.DomainDNSIPAddresses_VariableName,
					placeHolder: localize('deployCluster.DomainDNSIPAddressesPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.DomainDNSIPAddressesDescription', "Domain DNS servers' IP Addresses. Use comma to separate multiple IP addresses.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainDNSName', "Domain DNS name"),
					required: true,
					variableName: VariableNames.DomainDNSName_VariableName
				}, {
					type: FieldType.Text,
					label: localizedConstants.realm,
					required: false,
					variableName: VariableNames.Realm_VariableName,
					description: localize('deployCluster.RealmDescription', "If not provided, the domain DNS name will be used as the default value.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ClusterAdmins', "Cluster admin group"),
					required: true,
					variableName: VariableNames.ClusterAdmins_VariableName,
					description: localize('deployCluster.ClusterAdminsDescription', "The Active Directory group for cluster admin.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ClusterUsers', "Cluster users"),
					required: true,
					variableName: VariableNames.ClusterUsers_VariableName,
					placeHolder: localize('deployCluster.ClusterUsersPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.ClusterUsersDescription', "The Active Directory users/groups with cluster users role. Use comma to separate multiple users/groups.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DomainServiceAccountUserName', "Service account username"),
					required: true,
					variableName: VariableNames.DomainServiceAccountUserName_VariableName,
					description: localize('deployCluster.DomainServiceAccountUserNameDescription', "Domain service account for Big Data Cluster")
				}, {
					type: FieldType.Password,
					label: localize('deployCluster.DomainServiceAccountPassword', "Service account password"),
					required: true,
					variableName: VariableNames.DomainServiceAccountPassword_VariableName
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppOwners', "App owners"),
					required: false,
					variableName: VariableNames.AppOwners_VariableName,
					placeHolder: localize('deployCluster.AppOwnersPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.AppOwnersDescription', "The Active Directory users or groups with app owners role. Use comma to separate multiple users/groups.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppReaders', "App readers"),
					required: false,
					variableName: VariableNames.AppReaders_VariableName,
					placeHolder: localize('deployCluster.AppReadersPlaceHolder', "Use comma to separate the values."),
					description: localize('deployCluster.AppReadersDescription', "The Active Directory users or groups of app readers. Use comma as separator them if there are multiple users/groups.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.Subdomain', "Subdomain"),
					required: false,
					variableName: VariableNames.Subdomain_VariableName,
					description: localize('deployCluster.SubdomainDescription', "A unique DNS subdomain to use for this SQL Server Big Data Cluster. If not provided, the cluster name will be used as the default value.")
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AccountPrefix', "Account prefix"),
					required: false,
					variableName: VariableNames.AccountPrefix_VariableName,
					description: localize('deployCluster.AccountPrefixDescription', "A unique prefix for AD accounts SQL Server Big Data Cluster will generate. If not provided, the subdomain name will be used as the default value. If a subdomain is not provided, the cluster name will be used as the default value.")
				}
			]
		};
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			const basicSettingsGroup = await createSection({
				view: view,
				container: self.wizard.wizardObject,
				inputComponents: this.wizard.inputComponents,
				sectionInfo: basicSection,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, inputComponent: InputComponentInfo): void => {
					self.inputComponents[name] = { component: inputComponent.component };
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				}
			});
			const activeDirectorySettingsGroup = await createSection({
				view: view,
				container: self.wizard.wizardObject,
				inputComponents: this.wizard.inputComponents,
				sectionInfo: activeDirectorySection,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo): void => {
					this.inputComponents[name] = { component: inputComponentInfo.component };
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				}
			});
			const dockerSettingsGroup = await createSection({
				view: view,
				container: self.wizard.wizardObject,
				inputComponents: this.wizard.inputComponents,
				sectionInfo: dockerSection,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo): void => {
					this.inputComponents[name] = { component: inputComponentInfo.component };
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				}
			});
			const basicSettingsFormItem = { title: '', component: basicSettingsGroup };
			const dockerSettingsFormItem = { title: '', component: dockerSettingsGroup };
			this.activeDirectorySection = { title: '', component: activeDirectorySettingsGroup };
			const authModeDropdown = <azdata.DropDownComponent>this.inputComponents[VariableNames.AuthenticationMode_VariableName].component;
			this.formBuilder = view.modelBuilder.formContainer().withFormItems(
				[basicSettingsFormItem, dockerSettingsFormItem],
				{
					horizontal: false,
					componentWidth: '100%'
				}
			);
			this.wizard.registerDisposable(authModeDropdown.onValueChanged(() => {
				const isBasicAuthMode = (<azdata.CategoryValue>authModeDropdown.value).name === 'basic';
				getInputBoxComponent(VariableNames.OrganizationalUnitDistinguishedName_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.DomainControllerFQDNs_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.DomainDNSIPAddresses_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.DomainDNSName_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.ClusterAdmins_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.ClusterUsers_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.DomainServiceAccountUserName_VariableName, this.inputComponents).required = !isBasicAuthMode;
				getInputBoxComponent(VariableNames.DomainServiceAccountPassword_VariableName, this.inputComponents).required = !isBasicAuthMode;
				if (isBasicAuthMode) {
					this.formBuilder.removeFormItem(this.activeDirectorySection);
				} else {
					this.formBuilder.insertFormItem(this.activeDirectorySection);
				}
			}));
			const form = this.formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	public onLeave() {
		setModelValues(this.inputComponents, this.wizard.model);
		Object.assign(this.wizard.inputComponents, this.inputComponents);
		if (this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			const variableDNSPrefixMapping: { [s: string]: string } = {};
			variableDNSPrefixMapping[VariableNames.AppServiceProxyDNSName_VariableName] = 'bdc-appproxy';
			variableDNSPrefixMapping[VariableNames.ControllerDNSName_VariableName] = 'bdc-control';
			variableDNSPrefixMapping[VariableNames.GatewayDNSName_VariableName] = 'bdc-gateway';
			variableDNSPrefixMapping[VariableNames.ReadableSecondaryDNSName_VariableName] = 'bdc-sqlread';
			variableDNSPrefixMapping[VariableNames.SQLServerDNSName_VariableName] = 'bdc-sql';
			variableDNSPrefixMapping[VariableNames.ServiceProxyDNSName_VariableName] = 'bdc-proxy';

			const subdomain = this.wizard.model.getStringValue(VariableNames.Subdomain_VariableName) || this.wizard.model.getStringValue(VariableNames.ClusterName_VariableName);
			Object.keys(variableDNSPrefixMapping).forEach((variableName: string) => {
				this.wizard.model.setPropertyValue(variableName, `${variableDNSPrefixMapping[variableName]}.${subdomain}.${this.wizard.model.getStringValue(VariableNames.DomainDNSName_VariableName)}`);
			});
		}
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public async onEnter(): Promise<void> {
		getInputBoxComponent(VariableNames.DockerRegistry_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(VariableNames.DockerRegistry_VariableName);
		getInputBoxComponent(VariableNames.DockerRepository_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(VariableNames.DockerRepository_VariableName);
		getInputBoxComponent(VariableNames.DockerImageTag_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(VariableNames.DockerImageTag_VariableName);
		const authModeDropdown = <azdata.DropDownComponent>this.inputComponents[VariableNames.AuthenticationMode_VariableName].component;
		if (authModeDropdown) {
			authModeDropdown.enabled = this.wizard.model.adAuthSupported;
			const adAuthSelected = (<azdata.CategoryValue>authModeDropdown.value).name === 'ad';
			if (!this.wizard.model.adAuthSupported && adAuthSelected) {
				this.formBuilder.removeFormItem(this.activeDirectorySection);
				authModeDropdown.value = {
					name: AuthenticationMode.Basic,
					displayName: localize('deployCluster.AuthenticationMode.Basic', "Basic")
				};
			}

			this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
				this.wizard.wizardObject.message = { text: '' };
				if (pcInfo.newPage > pcInfo.lastPage) {
					const messages: string[] = [];
					const password = getInputBoxComponent(VariableNames.AdminPassword_VariableName, this.inputComponents).value!;
					const confirmPassword = getInputBoxComponent(ConfirmPasswordName, this.inputComponents).value!;
					if (password !== confirmPassword) {
						messages.push(getPasswordMismatchMessage(localize('deployCluster.AdminPasswordField', "Password")));
					}
					if (!isValidSQLPassword(password, getInputBoxComponent(VariableNames.AdminUserName_VariableName, this.inputComponents).value!)) {
						messages.push(getInvalidSQLPasswordMessage(localize('deployCluster.AdminPasswordField', "Password")));
					}

					this.validators.forEach(validator => {
						const result = validator();
						if (!result.valid) {
							messages.push(result.message);
						}
					});

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
}
