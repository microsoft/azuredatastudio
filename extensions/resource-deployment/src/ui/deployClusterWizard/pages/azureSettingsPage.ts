/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { WizardPageBase } from '../../wizardPageBase';
import { createSection, InputComponents, setModelValues } from '../../modelViewUtils';
import { SubscriptionId_VariableName, ResourceGroup_VariableName, Region_VariableName, AksName_VariableName, VMCount_VariableName, VMSize_VariableName } from '../model';
const localize = nls.loadMessageBundle();

export class AzureSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.AzureSettingsPageTitle', "Azure settings"),
			localize('deployCluster.AzureSettingsPageDescription', "Configure the settings to create an Azure Kubernetes service cluster"), wizard);
	}

	protected initialize(): void {
		const self = this;
		const azureSection: SectionInfo = {
			title: '',
			labelOnLeft: true,
			fields: [
				{
					type: FieldType.Text,
					label: localize('deployCluster.SubscriptionField', "Subscription id"),
					required: false,
					variableName: SubscriptionId_VariableName,
					placeHolder: localize('deployCluster.SubscriptionPlaceholder', "Use my default Azure subscription")
				}, {
					type: FieldType.DateTimeText,
					label: localize('deployCluster.ResourceGroupName', "New resource group name"),
					required: true,
					variableName: ResourceGroup_VariableName,
					defaultValue: 'mssql-'
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.Region', "Region"),
					required: true,
					variableName: Region_VariableName,
					defaultValue: 'eastus'
				}, {
					type: FieldType.DateTimeText,
					label: localize('deployCluster.AksName', "AKS cluster name"),
					required: true,
					variableName: AksName_VariableName,
					defaultValue: 'mssql-',
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.VMCount', "VM count"),
					required: true,
					variableName: VMCount_VariableName,
					defaultValue: '5',
					min: 1,
					max: 999
				}, {
					type: FieldType.Text,
					label: localize('deployCluster.VMSize', "VM size"),
					required: true,
					variableName: VMSize_VariableName,
					defaultValue: 'Standard_E4s_v3'
				}
			]
		};
		this.pageObject.registerContent((view: azdata.ModelView) => {
			const azureGroup = createSection(this.wizard.wizardObject, view, azureSection, self.validators, this.inputComponents, this.wizard.toDispose);
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[{
					title: '',
					component: azureGroup
				}],
				{
					horizontal: false,
					componentWidth: '100%'
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	public onLeave(): void {
		setModelValues(this.inputComponents, this.wizard.model);
	}
}
