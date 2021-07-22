/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { SectionInfo, LabelPosition, FontWeight, FieldType } from '../../../interfaces';
import { createSection } from '../../modelViewUtils';
import { BasePage } from './basePage';
import { DeployAzureSQLVMWizardModel } from '../deployAzureSQLVMWizardModel';

export class AzureSQLVMSummaryPage extends BasePage {

	private formItems: azdata.FormComponent[] = [];
	private _form!: azdata.FormBuilder;
	private _view!: azdata.ModelView;

	constructor(private _model: DeployAzureSQLVMWizardModel) {
		super(
			'Summary',
			'',
			_model.wizard
		);

	}

	public override async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			this._form = view.modelBuilder.formContainer();
			return view.initializeModel(this._form!.withLayout({ width: '100%' }).component());
		});
	}

	public override async onEnter(): Promise<void> {

		this.formItems.forEach(item => {
			this._form.removeFormItem(item);
		});

		this.formItems = [];

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
							defaultValue: this._model.azureAccount.displayInfo.displayName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountSubscriptionDropdownLabel,
							defaultValue: this._model.azureSubscriptionDisplayName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountResourceGroupDropdownLabel,
							defaultValue: this._model.azureResouceGroup,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountRegionDropdownLabel,
							defaultValue: this._model.azureRegion,
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
							defaultValue: this._model.vmName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.SqlAuthenticationUsernameLabel,
							defaultValue: this._model.vmUsername,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmImageDropdownLabel,
							defaultValue: this._model.vmImage,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmSkuDropdownLabel,
							defaultValue: this._model.vmImageSKU,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmVersionDropdownLabel,
							defaultValue: this._model.vmImageVersion,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.VmSizeDropdownLabel,
							defaultValue: this._model.vmSize,
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
							defaultValue: ((this._model.newVirtualNetwork === 'True' ? '(new) ' : '') + this.processVnetName()),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]

				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.SubnetDropdownLabel,
							defaultValue: ((this._model.newSubnet === 'True' ? '(new) ' : '') + this.processSubnetName()),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]

				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.PublicIPDropdownLabel,
							defaultValue: ((this._model.newPublicIp === 'True' ? '(new) ' : '') + this.processPublicIp()),
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
					defaultValue: this._model.sqlConnectivityType,
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				}
			]
		});

		if (this._model.sqlConnectivityType !== 'local') {
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
					defaultValue: (this._model.enableSqlAuthentication === 'True' ? 'Yes ' : 'No '),
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				}
			]
		});

		if (this._model.enableSqlAuthentication === 'True') {
			sqlServerSettingsPage.rows?.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: constants.SqlAuthenticationUsernameLabel,
						defaultValue: this._model.sqlAuthenticationUsername,
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

	public override async onLeave(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public createSummaryRow(view: azdata.ModelView, title: string, textComponent: azdata.TextComponent): azdata.FlexContainer {

		const labelText = view.modelBuilder.text()
			.withProps(
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
		if (this._model.newVirtualNetwork === 'True') {
			return this._model.virtualNetworkName;
		}

		let resourceGroupName = this._model.virtualNetworkName.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
		let vnetName = this._model.virtualNetworkName.replace(RegExp('^(.*?)/virtualNetworks/'), '');
		return `(${resourceGroupName}) ${vnetName}`;
	}

	public processSubnetName(): string {
		if (this._model.newSubnet === 'True') {
			return this._model.subnetName;
		}

		let subnetName = this._model.subnetName.replace(RegExp('^(.*?)/subnets/'), '');
		return `${subnetName}`;
	}

	public processPublicIp(): string {
		if (this._model.newPublicIp === 'True') {
			return this._model.publicIpName;
		}

		let resourceGroupName = this._model.publicIpName.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
		let pipName = this._model.publicIpName.replace(RegExp('^(.*?)/publicIPAddresses/'), '');
		return `(${resourceGroupName}) ${pipName}`;
	}
}
