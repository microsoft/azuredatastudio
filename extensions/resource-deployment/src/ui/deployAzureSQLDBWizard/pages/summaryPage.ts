/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLDBWizard } from '../deployAzureSQLDBWizard';
import * as constants from '../constants';
import { SectionInfo, LabelPosition, FontWeight, FieldType } from '../../../interfaces';
import { createSection } from '../../modelViewUtils';

export class AzureSQLDBSummaryPage extends WizardPageBase<DeployAzureSQLDBWizard> {

	private formItems: azdata.FormComponent[] = [];
	private _form!: azdata.FormBuilder;
	private _view!: azdata.ModelView;

	constructor(wizard: DeployAzureSQLDBWizard) {
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

		const auzreSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
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
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountSubscriptionDropdownLabel,
							defaultValue: model.azureSubscriptionDisplayName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountResourceGroupDropdownLabel,
							defaultValue: model.azureResouceGroup,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
						{
							type: FieldType.ReadonlyText,
							label: constants.AzureAccountDatabaseServersDropdownLabel,
							defaultValue: model.azureServerName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				}
			]
		};

		const databaseSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: constants.DatabaseSettingsPageTitle,
			rows: [
				// {
				// 	items: [
				// 		{
				// 			type: FieldType.ReadonlyText,
				// 			label: constants.PublicIPDropdownLabel,
				// 			defaultValue: ((model.newPublicIp === 'True' ? '(new) ' : '') + this.processPublicIp()),
				// 			labelCSSStyles: { fontWeight: FontWeight.Bold }
				// 		}
				// 	]
				// },
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.StartIpAddressShortLabel,
							defaultValue: model.startIpAddress,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
						{
							type: FieldType.ReadonlyText,
							label: constants.EndIpAddressShortLabel,
							defaultValue: model.endIpAddress,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				},
				{
					items: [
						{
							type: FieldType.ReadonlyText,
							label: constants.FirewallRuleNameLabel,
							defaultValue: model.firewallRuleName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
						{
							type: FieldType.ReadonlyText,
							label: constants.DatabaseNameLabel,
							defaultValue: model.databaseName,
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				}
			]
		};


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
		const databaseSection = await createSectionFunc(databaseSettingSection);

		this.formItems.push(azureSection, databaseSection);
		this._form.addFormItems(this.formItems);

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

	// public processPublicIp(): string {
	// 	if (this.wizard.model.newPublicIp === 'True') {
	// 		return this.wizard.model.startIpAddress;
	// 	}

	// 	let resourceGroupName = this.wizard.model.startIpAddress.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
	// 	let pipName = this.wizard.model.startIpAddress.replace(RegExp('^(.*?)/publicIPAddresses/'), '');
	// 	return `(${resourceGroupName}) ${pipName}`;
	// }
}
