/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType, LabelPosition } from '../../../interfaces';
import { WizardPageBase } from '../../wizardPageBase';
import { createSection, InputComponents, setModelValues, Validator } from '../../modelViewUtils';
import { SubscriptionId_VariableName, ResourceGroup_VariableName, Region_VariableName, AksName_VariableName, VMCount_VariableName, VMSize_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

export class AzureSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.AzureSettingsPageTitle', "Azure settings"),
			localize('deployCluster.AzureSettingsPageDescription', "Configure the settings to create an Azure Kubernetes Service cluster"), wizard);
	}

	public initialize(): void {
		const self = this;
		const azureSection: SectionInfo = {
			title: '',
			labelPosition: LabelPosition.Left,
			fields: [
				{
					type: FieldType.Text,
					label: localize('deployCluster.SubscriptionField', "Subscription id"),
					required: false,
					variableName: SubscriptionId_VariableName,
					placeHolder: localize('deployCluster.SubscriptionPlaceholder', "Use my default Azure subscription"),
					description: localize('deployCluster.SubscriptionDescription', "The default subscription will be used if you leave this field blank.")
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

			const azureGroup = createSection({
				sectionInfo: azureSection,
				view: view,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, component: azdata.InputBoxComponent | azdata.DropDownComponent | azdata.CheckBoxComponent): void => {
					self.inputComponents[name] = component;
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				},
				container: this.wizard.wizardObject
			});
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
