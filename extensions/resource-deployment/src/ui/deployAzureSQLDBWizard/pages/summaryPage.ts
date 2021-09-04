/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import * as localizedConstants from '../../../localizedConstants';
import { SectionInfo, LabelPosition, FontWeight, FieldType } from '../../../interfaces';
import { createSection } from '../../modelViewUtils';
import { BasePage } from '../../deployAzureSQLVMWizard/pages/basePage';
import { DeployAzureSQLDBWizardModel } from '../deployAzureSQLDBWizardModel';

export class AzureSQLDBSummaryPage extends BasePage {

	private formItems: azdata.FormComponent[] = [];
	private _form!: azdata.FormBuilder;
	private _view!: azdata.ModelView;

	constructor(private _model: DeployAzureSQLDBWizardModel) {
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

		let model = this._model;

		const labelWidth = '150px';
		const inputWidth = '400px';
		const fieldHeight = '20px';

		const auzreSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			fieldHeight: fieldHeight,
			spaceBetweenFields: '0',
			title: constants.AzureSettingsSummaryPageTitle,
			fields: [
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
		};

		// const databaseHardwareSettingSection: SectionInfo = { //@todo alma1 9/8/2020 section used for upcoming database hardware creation feature.
		// 	labelPosition: LabelPosition.Left,
		// 	labelWidth: labelWidth,
		// 	inputWidth: inputWidth,
		// 	fieldHeight: fieldHeight,
		// 	spaceBetweenFields: '0',
		// 	title: constants.DatabaseHardwareInfoLabel,
		// 	fields: [
		// 		{
		// 			type: FieldType.ReadonlyText,
		// 			label: constants.DatabaseSupportedEditionsDropdownLabel,
		// 			defaultValue: model.databaseEdition,
		// 			labelCSSStyles: { fontWeight: FontWeight.Bold }
		// 		},
		// 		{
		// 			type: FieldType.ReadonlyText,
		// 			label: constants.DatabaseSupportedFamilyDropdownLabel,
		// 			defaultValue: model.databaseFamily,
		// 			labelCSSStyles: { fontWeight: FontWeight.Bold }
		// 		},
		// 		{
		// 			type: FieldType.ReadonlyText,
		// 			label: constants.DatabaseVCoreNumberDropdownLabel,
		// 			defaultValue: String(model.vCoreNumber),
		// 			labelCSSStyles: { fontWeight: FontWeight.Bold }
		// 		},
		// 		{
		// 			type: FieldType.ReadonlyText,
		// 			label: constants.DatabaseMaxMemorySummaryTextLabel,
		// 			defaultValue: model.storageInGB,
		// 			labelCSSStyles: { fontWeight: FontWeight.Bold }
		// 		}
		// 	]
		// };

		const databaseSettingSection: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			fieldHeight: fieldHeight,
			title: constants.DatabaseSettingsPageTitle,
			fields: [
				{
					type: FieldType.ReadonlyText,
					label: constants.DatabaseNameLabel,
					defaultValue: model.databaseName,
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				},
				{
					type: FieldType.ReadonlyText,
					label: constants.CollationNameSummaryLabel,
					defaultValue: model.databaseCollation,
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				},
				{
					type: FieldType.ReadonlyText,
					label: constants.FirewallToggleLabel,
					defaultValue: model.newFirewallRule ? localizedConstants.yes : localizedConstants.no,
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				}
			]
		};

		if (model.newFirewallRule) {
			databaseSettingSection.fields?.push(
				{
					type: FieldType.ReadonlyText,
					label: constants.FirewallRuleNameLabel,
					defaultValue: model.firewallRuleName,
					labelCSSStyles: { fontWeight: FontWeight.Bold }
				},
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
		//const databaseHardwareSection = await createSectionFunc(databaseHardwareSettingSection); //@todo alma1 9/8/2020 used for upcoming database hardware creation feature.
		const databaseSection = await createSectionFunc(databaseSettingSection);

		this.formItems.push(azureSection, /*databaseHardwareSection,*/ databaseSection);
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
}
