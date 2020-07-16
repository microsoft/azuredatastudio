/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { FieldType, LabelPosition, SectionInfo } from '../../../interfaces';
import { createSection, getDropdownComponent, InputComponentInfo, InputComponents, setModelValues, Validator } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { AksName_VariableName, Location_VariableName, ResourceGroup_VariableName, SubscriptionId_VariableName, VMCount_VariableName, VMSize_VariableName } from '../constants';
import { DeployClusterWizard } from '../deployClusterWizard';
import { AzureRegion } from '../../../../../azurecore/src/azurecore';
const localize = nls.loadMessageBundle();
const MissingRequiredInformationErrorMessage = localize('deployCluster.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

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
			spaceBetweenFields: '5px',
			rows: [{
				items: [{
					type: FieldType.Text,
					label: localize('deployCluster.SubscriptionField', "Subscription id"),
					required: false,
					variableName: SubscriptionId_VariableName,
					placeHolder: localize('deployCluster.SubscriptionPlaceholder', "Use my default Azure subscription"),
					description: localize('deployCluster.SubscriptionDescription', "The default subscription will be used if you leave this field blank.")
				}, {
					type: FieldType.ReadonlyText,
					label: '{0}',
					links: [
						{
							text: localize('deployCluster.SubscriptionHelpLink', "View available Azure subscriptions"),
							url: 'https://portal.azure.com/#blade/Microsoft_Azure_Billing/SubscriptionsBlade'
						}
					]
				}]
			}, {
				items: [{
					type: FieldType.DateTimeText,
					label: localize('deployCluster.ResourceGroupName', "New resource group name"),
					required: true,
					variableName: ResourceGroup_VariableName,
					defaultValue: 'mssql-'
				}]
			}, {
				items: [{
					type: FieldType.Options,
					label: localize('deployCluster.Location', "Location"),
					required: true,
					variableName: Location_VariableName,
					defaultValue: AzureRegion.eastus,
					editable: true,
					// The options are not localized because this is an editable dropdown,
					// It would cause confusion to user about what value to type in, if they type in the localized value, we don't know how to process.
					options: [
						AzureRegion.centralus,
						AzureRegion.eastus,
						AzureRegion.eastus2,
						AzureRegion.northcentralus,
						AzureRegion.southcentralus,
						AzureRegion.westus,
						AzureRegion.westus2,
						AzureRegion.canadacentral,
						AzureRegion.canadaeast
					]
				}, {
					type: FieldType.ReadonlyText,
					label: '{0}',
					links: [
						{
							text: localize('deployCluster.AzureLocationHelpLink', "View available Azure locations"),
							url: 'https://azure.microsoft.com/global-infrastructure/services/?products=kubernetes-service'
						}
					]
				}]
			}, {
				items: [{
					type: FieldType.DateTimeText,
					label: localize('deployCluster.AksName', "AKS cluster name"),
					required: true,
					variableName: AksName_VariableName,
					defaultValue: 'mssql-',
				}]
			}, {
				items: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.VMCount', "VM count"),
						required: true,
						variableName: VMCount_VariableName,
						defaultValue: '5',
						min: 1,
						max: 999
					}
				]
			}, {
				items: [{
					type: FieldType.Text,
					label: localize('deployCluster.VMSize', "VM size"),
					required: true,
					variableName: VMSize_VariableName,
					defaultValue: 'Standard_E8s_v3'
				}, {
					type: FieldType.ReadonlyText,
					label: '{0}',
					links: [
						{
							text: localize('deployCluster.VMSizeHelpLink', "View available VM sizes"),
							url: 'https://docs.microsoft.com/azure/virtual-machines/linux/sizes'
						}
					]
				}]
			}]
		};
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			const azureGroup = await createSection({
				sectionInfo: azureSection,
				view: view,
				onNewDisposableCreated: (disposable: vscode.Disposable): void => {
					self.wizard.registerDisposable(disposable);
				},
				onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo): void => {
					this.inputComponents[name] = { component: inputComponentInfo.component };
				},
				onNewValidatorCreated: (validator: Validator): void => {
					self.validators.push(validator);
				},
				container: this.wizard.wizardObject,
				inputComponents: this.wizard.inputComponents
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

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const location = getDropdownComponent(Location_VariableName, this.inputComponents).value;
				if (!location) {
					this.wizard.wizardObject.message = {
						text: MissingRequiredInformationErrorMessage,
						level: azdata.window.MessageLevel.Error
					};
				}
				return !!location;
			} else {
				return true;
			}
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
		setModelValues(this.inputComponents, this.wizard.model);
		Object.assign(this.wizard.inputComponents, this.inputComponents);
	}
}
