/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import * as constants from '../constants';

export class AzureSQLVMSummaryPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	private _form!: azdata.FormContainer;
	private _azureAccount!: azdata.TextComponent;
	private _subscription!: azdata.TextComponent;
	private _resourceGroup!: azdata.TextComponent;
	private _region!: azdata.TextComponent;
	private _vmName!: azdata.TextComponent;
	private _vmUser!: azdata.TextComponent;
	private _vmImage!: azdata.TextComponent;
	private _vmImageSKU!: azdata.TextComponent;
	private _vmImageVersion!: azdata.TextComponent;
	private _vmImageSize!: azdata.TextComponent;
	private _virtualNetwork!: azdata.TextComponent;
	private _subnetNetwork!: azdata.TextComponent;
	private _publicIp!: azdata.TextComponent;
	private _sqlConnectivity!: azdata.TextComponent;
	private _port!: azdata.TextComponent;
	private _sqlUsername!: azdata.TextComponent;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			'Summary Page',
			'',
			wizard
		);

	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			this._azureAccount = view.modelBuilder.text().component();
			this._subscription = view.modelBuilder.text().component();
			this._resourceGroup = view.modelBuilder.text().component();
			this._region = view.modelBuilder.text().component();
			this._vmName = view.modelBuilder.text().component();
			this._vmUser = view.modelBuilder.text().component();
			this._vmImage = view.modelBuilder.text().component();
			this._vmImageSKU = view.modelBuilder.text().component();
			this._vmImageVersion = view.modelBuilder.text().component();
			this._vmImageSize = view.modelBuilder.text().component();
			this._virtualNetwork = view.modelBuilder.text().component();
			this._subnetNetwork = view.modelBuilder.text().component();
			this._publicIp = view.modelBuilder.text().component();
			this._sqlConnectivity = view.modelBuilder.text().component();
			this._port = view.modelBuilder.text().component();
			this._sqlUsername = view.modelBuilder.text().component();




			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this.createSummaryRow(view, constants.AzureAccountDropdownLabel, this._azureAccount)
						},
						{
							component: this.createSummaryRow(view, constants.AzureAccountSubscriptionDropdownLabel, this._subscription)
						},
						{
							component: this.createSummaryRow(view, constants.AzureAccountResourceGroupDropdownLabel, this._resourceGroup)
						},
						{
							component: this.createSummaryRow(view, constants.AzureAccountRegionDropdownLabel, this._region)
						},
						{
							component: this.createSummaryRow(view, constants.VmNameTextBoxLabel, this._vmName)
						},
						{
							component: this.createSummaryRow(view, constants.AzureAccountDropdownLabel, this._vmUser)
						},
						{
							component: this.createSummaryRow(view, constants.VmImageDropdownLabel, this._vmImage)
						},
						{
							component: this.createSummaryRow(view, constants.VmSkuDropdownLabel, this._vmImageSKU)
						},
						{
							component: this.createSummaryRow(view, constants.VmVersionDropdownLabel, this._vmImageVersion)
						},
						{
							component: this.createSummaryRow(view, constants.VmSizeDropdownLabel, this._vmImageSize)
						},
						{
							component: this.createSummaryRow(view, constants.VirtualNetworkDropdownLabel, this._virtualNetwork)
						},
						{
							component: this.createSummaryRow(view, constants.SubnetDropdownLabel, this._subnetNetwork)
						},
						{
							component: this.createSummaryRow(view, constants.PublicIPDropdownLabel, this._publicIp)
						},
						{
							component: this.createSummaryRow(view, 'Sql connectivity', this._sqlConnectivity)
						},
						{
							component: this.createSummaryRow(view, 'Sql port', this._port)
						},
						{
							component: this.createSummaryRow(view, 'Sql auth username', this._sqlUsername)
						}
					],
					{
						horizontal: false,
						componentWidth: '100%'
					})
				.withLayout({ width: '100%' })
				.component();

			return view.initializeModel(this._form);
		});
	}

	public async onEnter(): Promise<void> {
		let model = this.wizard.model;

		this.updateValue(this._azureAccount, model.azureAccount.displayInfo.displayName);
		this.updateValue(this._subscription, model.azureSubscriptionDisplayName);
		this.updateValue(this._resourceGroup, model.azureRegion);
		this.updateValue(this._region, model.azureResouceGroup);
		this.updateValue(this._vmName, model.vmName);
		this.updateValue(this._vmUser, model.vmUsername);
		this.updateValue(this._vmImage, model.vmImage);
		this.updateValue(this._vmImageSKU, model.vmImageSKU);
		this.updateValue(this._vmImageVersion, model.vmImageVersion);
		this.updateValue(this._vmImageSize, model.vmSize);
		this.updateValue(this._virtualNetwork, ((model.existingVirtualNetwork === 'False' ? '(new) ' : '') + model.virtualNetworkName));
		this.updateValue(this._subnetNetwork, ((model.existingSubnet === 'False' ? '(new) ' : '') + model.subnetName));
		this.updateValue(this._publicIp, ((model.existingPublicIp === 'False' ? '(new) ' : '') + model.publicIpName));
		this.updateValue(this._sqlConnectivity, model.sqlConnectivityType);
		this.updateValue(this._port, model.port.toString());
		this.updateValue(this._sqlUsername, model.sqlAuthenticationUsername);

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public createSummaryRow(view: azdata.ModelView, title: string, textComponent: azdata.TextComponent): azdata.FlexContainer {

		const labelText = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>(
				{
					value: title,
					width: '250px',
				})
			.component();

		labelText.updateCssStyles({
			'font-weight': '400',
			'font-size': '13px',
		});

		const flexContainer = view.modelBuilder.flexContainer()
			.withLayout(
				{
					flexFlow: 'row',
					alignItems: 'center',
				})
			.withItems(
				[labelText, textComponent],
				{
					CSSStyles: { 'margin-right': '5px' }
				})
			.component();

		return flexContainer;
	}

	public updateValue(textComponent: azdata.TextComponent, value: string) {
		textComponent.updateProperties({
			value: value
		});
	}
}
