/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import * as constants from '../constants';
import { SectionInfo, LabelPosition, FontWeight, FieldType } from '../../../interfaces';
import { createSection } from '../../modelViewUtils';

export class AzureSQLVMSummaryPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	private formItems: azdata.FormComponent[] = [];
	private _form!: azdata.FormBuilder;
	private _view!: azdata.ModelView;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			'Summary',
			'',
			wizard
		);

	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			this._form = view.modelBuilder.formContainer();
			return view.initializeModel(this._form!.withLayout({ width: '100%' }).component());
		});
	}

	public async onEnter(): Promise<void> {

		this.formItems.forEach(item => {
			this._form.removeFormItem(item);
		});

		this.formItems = [];

		let model = this.wizard.model;

		const labelWidth = '150px';
		const inputWidth = '400px';
		const fieldHeight = '20px';

		const auzreSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			fieldHeight: fieldHeight,
			spaceBetweenFields: '0',
			title: constants.AzureSettingsPageTitle,
			rows: [
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountDropdownLabel,
							defaultValue: model.azureAccount.displayInfo.displayName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountSubscriptionDropdownLabel,
							defaultValue: model.azureSubscriptionDisplayName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountResourceGroupDropdownLabel,
							defaultValue: model.azureResouceGroup,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountRegionDropdownLabel,
							defaultValue: model.azureRegion,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				}
			]
		};

		const vmSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			fieldHeight: fieldHeight,
			title: constants.VmSettingsPageTitle,
			rows: [
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmNameTextBoxLabel,
							defaultValue: model.vmName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.SqlAuthenticationUsernameLabel,
							defaultValue: model.vmUsername,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmImageDropdownLabel,
							defaultValue: model.vmImage,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmSkuDropdownLabel,
							defaultValue: model.vmImageSKU,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmVersionDropdownLabel,
							defaultValue: model.vmImageVersion,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmSizeDropdownLabel,
							defaultValue: model.vmSize,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
			]
		};

		const networkSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			fieldHeight: fieldHeight,
			title: constants.NetworkSettingsPageTitle,
			rows: [
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VirtualNetworkDropdownLabel,
							defaultValue: ((model.newVirtualNetwork === 'True' ? '(new) ' : '') + this.processVnetName()),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]

				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.SubnetDropdownLabel,
							defaultValue: ((model.newSubnet === 'True' ? '(new) ' : '') + this.processSubnetName()),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]

				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.PublicIPDropdownLabel,
							defaultValue: ((model.newPublicIp === 'True' ? '(new) ' : '') + this.processPublicIp()),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				}
			]
		};

		const sqlServerSettingsPage: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			fieldHeight: fieldHeight,
			title: constants.SqlServerSettingsPageTitle,
			rows: [
			]
		};

		sqlServerSettingsPage.rows?.push({
			items: [
				{
					type: FieldType.ReadonlyText,
					label: constants.SqlConnectivityTypeDropdownLabel,
					defaultValue: model.sqlConnectivityType,
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				}
			]
		});

		if (model.sqlConnectivityType !== 'local') {
			sqlServerSettingsPage.rows?.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: constants.SqlPortLabel,
						defaultValue: constants.SqlPortLabel,
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}
				]
			});
		}


		sqlServerSettingsPage.rows?.push({
			items: [
				{
					type: FieldType.ReadonlyText,
					label: constants.SqlEnableSQLAuthenticationLabel,
					defaultValue: (model.enableSqlAuthentication === 'True' ? 'Yes ' : 'No '),
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				}
			]
		});

		if (model.enableSqlAuthentication === 'True') {
			sqlServerSettingsPage.rows?.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: constants.SqlAuthenticationUsernameLabel,
						defaultValue: model.sqlAuthenticationUsername,
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}
				]
			});
		}

		const createSectionFunc = async (sectionInfo: SectionInfo): Promise<azdata.FormComponent> => {
			return {
				title: '',
				component: await createSection({
					container: this.wizard.wizardObject,
					inputComponents: {},
					sectionInfo: sectionInfo,
					view: this._view,
					onNewDisposableCreated: () => { },
					onNewInputComponentCreated: () => { },
					onNewValidatorCreated: () => { },
					toolsService: this.wizard.toolsService
				})
			};
		};

		const azureSection = await createSectionFunc(auzreSettingSection);
		const vmSection = await createSectionFunc(vmSettingSection);
		const networkSection = await createSectionFunc(networkSettingSection);
		const sqlServerSection = await createSectionFunc(sqlServerSettingsPage);


		this.formItems.push(azureSection, vmSection, networkSection, sqlServerSection);
		this._form.addFormItems(this.formItems);

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public async onLeave(): Promise<void> {
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

	public processVnetName(): string {
		if (this.wizard.model.newVirtualNetwork === 'True') {
			return this.wizard.model.virtualNetworkName;
		}

		let resourceGroupName = this.wizard.model.virtualNetworkName.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
		let vnetName = this.wizard.model.virtualNetworkName.replace(RegExp('^(.*?)/virtualNetworks/'), '');
		return `(${resourceGroupName}) ${vnetName}`;
	}

	public processSubnetName(): string {
		if (this.wizard.model.newSubnet === 'True') {
			return this.wizard.model.subnetName;
		}

		let subnetName = this.wizard.model.subnetName.replace(RegExp('^(.*?)/subnets/'), '');
		return `${subnetName}`;
	}

	public processPublicIp(): string {
		if (this.wizard.model.newPublicIp === 'True') {
			return this.wizard.model.publicIpName;
		}

		let resourceGroupName = this.wizard.model.publicIpName.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
		let pipName = this.wizard.model.publicIpName.replace(RegExp('^(.*?)/publicIPAddresses/'), '');
		return `(${resourceGroupName}) ${pipName}`;
	}
}
