/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { createSection, InputComponents, setModelValues } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { DeploymentProfile_VariableName, ClusterName_VariableName, AdminUserName_VariableName, AdminPassword_VariableName, AuthenticationMode_VariableName, DistinguishedName_VariableName, AdminPrincipals_VariableName, UserPrincipals_VariableName, UpstreamIPAddresses_VariableName, DnsName_VariableName, Realm_VariableName, AppOwnerPrincipals_VariableName, AppReaderPrincipals_VariableName } from '../model';
const localize = nls.loadMessageBundle();

export class ClusterSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ClusterSettingsPageTitle', "Cluster settings"),
			localize('deployCluster.ClusterSettingsPageDescription', "Configure the SQL Server big data cluster settings"), wizard);
	}

	protected initialize(): void {
		const self = this;
		const basicSection: SectionInfo = {
			labelOnLeft: true,
			title: '',
			fields: [
				{
					type: FieldType.Options,
					label: localize('deployCluster.DeploymentProfileField', "Deployment profile"),
					required: true,
					variableName: DeploymentProfile_VariableName,
					defaultValue: 'aks-dev-test',
					options: ['aks-dev-test', 'kubeadm-dev-test']
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ClusterNameField', "Cluster name"),
					required: true,
					variableName: ClusterName_VariableName,
					defaultValue: 'mssql-cluster',
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AdminUserNameField', "Admin username"),
					required: true,
					variableName: AdminUserName_VariableName,
					defaultValue: 'admin',
					useCustomValidator: true
				}, {
					type: FieldType.SQLPassword,
					label: localize('deployCluster.AdminPasswordField', "Password"),
					required: true,
					variableName: AdminPassword_VariableName,
					confirmationLabel: localize('deployCluster.ConfirmPassword', "Confirm password"),
					confirmationRequired: true,
					defaultValue: '',
					useCustomValidator: true,
					description: localize('deployCluster.AdminPasswordDescription', "You can also use this password to access SQL Server and Knox.")
				}, {
					type: FieldType.Options,
					label: localize('deployCluster.AuthenticationModeField', "Authentication mode"),
					required: true,
					variableName: AuthenticationMode_VariableName,
					defaultValue: 'basic',
					options: [
						{
							name: 'basic',
							displayName: localize('deployCluster.AuthenticationMode.Basic', "Basic")
						},
						{
							name: 'ad',
							displayName: localize('deployCluster.AuthenticationMode.ActiveDirectory', "Active Directory")

						}
					]
				}
			]
		};

		const activeDirectorySection: SectionInfo = {
			labelOnLeft: true,
			title: localize('deployCluster.ActiveDirectorySettings', "Active Directory settings"),
			fields: [
				{
					type: FieldType.Text,
					label: localize('deployCluster.DistinguishedName', "Distinguished name"),
					required: true,
					variableName: DistinguishedName_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AdminPrincipals', "Admin principals"),
					required: true,
					variableName: AdminPrincipals_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.UserPrincipals', "User principals"),
					required: true,
					variableName: UserPrincipals_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.UpstreamIPAddresses', "Upstream IP Addresses"),
					required: true,
					variableName: UpstreamIPAddresses_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DNSName', "DNS name"),
					required: true,
					variableName: DnsName_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.Realm', "Realm"),
					required: true,
					variableName: Realm_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppOnwerPrincipals', "App owner principals"),
					required: true,
					variableName: AppOwnerPrincipals_VariableName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppReaderPrincipals', "App reader principals"),
					required: true,
					variableName: AppReaderPrincipals_VariableName,
					useCustomValidator: true
				}
			]
		};
		this.pageObject.registerContent((view: azdata.ModelView) => {
			const basicSettingsGroup = createSection(this.wizard.wizardObject, view, basicSection, self.validators, this.inputComponents, this.wizard.toDispose);
			const activeDirectorySettingsGroup = createSection(this.wizard.wizardObject, view, activeDirectorySection, self.validators, this.inputComponents, this.wizard.toDispose);
			const basicSettingsFormItem = { title: '', component: basicSettingsGroup };
			const activeDirectoryFormItem = { title: '', component: activeDirectorySettingsGroup };
			const authModeDropdown = <azdata.DropDownComponent>this.inputComponents[AuthenticationMode_VariableName];
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
	}
}
