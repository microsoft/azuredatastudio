/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { WizardPageBase } from '../../wizardPageBase';
import { InputComponents, setModelValues, createLabel, createTextInput, DefaultLabelComponentWidth, DefaultInputComponentWidth, createFlexContainer, createGroupContainer, getDateTimeString, createNumberInput } from '../../modelViewUtils';
import { SubscriptionId_VariableName, ResourceGroup_VariableName, Location_VariableName, AksName_VariableName, VMCount_VariableName, VMSize_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

export class AzureSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.AzureSettingsPageTitle', "Azure settings"),
			localize('deployCluster.AzureSettingsPageDescription', "Configure the settings to create an Azure Kubernetes Service cluster"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			const subscriptionIdLabel = createLabel(view, {
				text: localize('deployCluster.SubscriptionField', "Subscription id"),
				required: false,
				description: localize('deployCluster.SubscriptionDescription', "The default subscription will be used if you leave this field blank."),
				width: DefaultLabelComponentWidth
			});

			const subscriptionIdInput = createTextInput(view, {
				placeHolder: localize('deployCluster.SubscriptionPlaceholder', "Use my default Azure subscription"),
				ariaLabel: localize('deployCluster.SubscriptionField', "Subscription id"),
				required: false,
				width: DefaultInputComponentWidth
			});
			this.inputComponents[SubscriptionId_VariableName] = subscriptionIdInput;

			const subscriptionHelpLink = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize('deployCluster.SubscriptionHelpText', "Visit {0} to view your subscriptions."),
				links: [{
					text: localize('deployCluster.SubscriptionHelpLink', "here"),
					url: 'https://portal.azure.com/#blade/Microsoft_Azure_Billing/SubscriptionsBlade'
				}],
				width: DefaultLabelComponentWidth
			}).component();
			const subscriptionRow = createFlexContainer(view, [subscriptionIdLabel, subscriptionIdInput, subscriptionHelpLink]);

			const resourceGroupLabel = createLabel(view, {
				text: localize('deployCluster.ResourceGroupName', "New resource group name"),
				required: true,
				width: DefaultLabelComponentWidth
			});

			const resourceGroupInput = createTextInput(view, {
				ariaLabel: localize('deployCluster.ResourceGroupName', "New resource group name"),
				required: true,
				width: DefaultInputComponentWidth,
				defaultValue: 'mssql_' + getDateTimeString()
			});
			this.inputComponents[ResourceGroup_VariableName] = resourceGroupInput;
			const resourceGroupRow = createFlexContainer(view, [resourceGroupLabel, resourceGroupInput]);

			const locationLabel = createLabel(view, {
				text: localize('deployCluster.Location', "Location"),
				required: true,
				width: DefaultLabelComponentWidth
			});

			const locationInput = createTextInput(view, {
				ariaLabel: localize('deployCluster.Location', "Location"),
				required: true,
				defaultValue: 'eastus',
				width: DefaultInputComponentWidth
			});
			this.inputComponents[Location_VariableName] = locationInput;

			const locationHelpLink = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize('deployCluster.LocationHelpText', "Visit {0} for available locations."),
				links: [{
					text: localize('deployCluster.AzureLocationHelpLink', "here"),
					url: 'https://azure.microsoft.com/en-us/global-infrastructure/services/?products=kubernetes-service'
				}],
				width: DefaultLabelComponentWidth
			}).component();
			const locationRow = createFlexContainer(view, [locationLabel, locationInput, locationHelpLink]);

			const aksLabel = createLabel(view, {
				text: localize('deployCluster.AksName', "AKS cluster name"),
				required: true,
				width: DefaultLabelComponentWidth
			});

			const aksInput = createTextInput(view, {
				ariaLabel: localize('deployCluster.AksName', "AKS cluster name"),
				required: true,
				width: DefaultInputComponentWidth,
				defaultValue: 'mssql_' + getDateTimeString()
			});
			this.inputComponents[AksName_VariableName] = aksInput;
			const aksRow = createFlexContainer(view, [aksLabel, aksInput]);

			const vmCountLabel = createLabel(view, {
				text: localize('deployCluster.VMCount', "VM count"),
				required: true,
				width: DefaultLabelComponentWidth
			});
			const vmCountInput = createNumberInput(view, {
				ariaLabel: localize('deployCluster.VMCount', "VM count"),
				required: true,
				defaultValue: '5',
				width: DefaultInputComponentWidth,
				min: 1,
				max: 99
			});
			this.inputComponents[VMCount_VariableName] = vmCountInput;
			const vmCountRow = createFlexContainer(view, [vmCountLabel, vmCountInput]);

			const vmSizeLabel = createLabel(view, {
				text: localize('deployCluster.VMSize', "VM size"),
				required: true,
				width: DefaultLabelComponentWidth
			});

			const vmSizeInput = createTextInput(view, {
				ariaLabel: localize('deployCluster.VMSize', "VM size"),
				required: true,
				defaultValue: 'Standard_E4s_v3',
				width: DefaultInputComponentWidth
			});
			this.inputComponents[VMSize_VariableName] = vmSizeInput;

			const vmSizeHelpLink = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize('deployCluster.VMSizeHelpText', "Visit {0} for available VM sizes."),
				links: [{
					text: localize('deployCluster.VMSizeHelpLink', "here"),
					url: 'https://docs.microsoft.com/en-us/azure/virtual-machines/linux/sizes'
				}],
				width: DefaultLabelComponentWidth
			}).component();
			const vmSizeRow = createFlexContainer(view, [vmSizeLabel, vmSizeInput, vmSizeHelpLink]);
			const azureGroup = createGroupContainer(view, [subscriptionRow, resourceGroupRow, locationRow, aksRow, vmCountRow, vmSizeRow], { header: '' });
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
