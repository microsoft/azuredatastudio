/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as WizardConstants from '../constants';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { createSection } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
const localize = nls.loadMessageBundle();

export class ClusterSettingsPage extends WizardPageBase<DeployClusterWizard> {
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
					variableName: WizardConstants.DeploymentProfile,
					defaultValue: 'aks-dev-test',
					options: ['aks-dev-test', 'kubeadm-dev-test']
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.ClusterNameField', "Cluster name"),
					required: true,
					variableName: WizardConstants.ClusterName,
					defaultValue: 'mssql-cluster',
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AdminUserNameField', "Admin username"),
					required: true,
					variableName: WizardConstants.AdminUserName,
					defaultValue: 'admin',
					useCustomValidator: true
				}, {
					type: FieldType.SQLPassword,
					label: localize('deployCluster.AdminPasswordField', "Password"),
					required: true,
					variableName: WizardConstants.AdminPassword,
					confirmationLabel: localize('deployCluster.ConfirmPassword', "Confirm password"),
					confirmationRequired: true,
					defaultValue: '',
					useCustomValidator: true,
					description: localize('deployCluster.AdminPasswordDescription', "You can also use this password to access SQL Server and Knox.")
				}, {
					type: FieldType.Options,
					label: localize('deployCluster.AuthenticationModeField', "Authentication mode"),
					required: true,
					variableName: WizardConstants.AuthenticationMode,
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
					variableName: WizardConstants.DistinguishedName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AdminPrincipals', "Admin principals"),
					required: true,
					variableName: WizardConstants.AdminPrincipals,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.UserPrincipals', "User principals"),
					required: true,
					variableName: WizardConstants.UserPrincipals,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.UpstreamIPAddresses', "Upstream IP Addresses"),
					required: true,
					variableName: WizardConstants.UpstreamIPAddresses,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.DNSName', "DNS name"),
					required: true,
					variableName: WizardConstants.DnsName,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.Realm', "Realm"),
					required: true,
					variableName: WizardConstants.Realm,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppOnwerPrincipals', "App owner principals"),
					required: true,
					variableName: WizardConstants.AppOwnerPrincipals,
					useCustomValidator: true
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.AppReaderPrincipals', "App reader principals"),
					required: true,
					variableName: WizardConstants.AppReaderPrincipals,
					useCustomValidator: true
				}
			]
		};
		this.pageObject.registerContent((view: azdata.ModelView) => {
			const basicSettingsGroup = createSection(this.wizard.wizardObject, view, basicSection, self.validators, this.wizard.InputComponents, this.wizard.toDispose);
			const activeDirectorySettingsGroup = createSection(this.wizard.wizardObject, view, activeDirectorySection, self.validators, this.wizard.InputComponents, this.wizard.toDispose);
			const basicSettingsFormItem = { title: '', component: basicSettingsGroup };
			const activeDirectoryFormItem = { title: '', component: activeDirectorySettingsGroup };
			const authModeDropdown = <azdata.DropDownComponent>this.wizard.InputComponents[WizardConstants.AuthenticationMode];
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
}
