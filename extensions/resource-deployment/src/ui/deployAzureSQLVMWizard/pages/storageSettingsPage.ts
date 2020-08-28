/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';

export class StorageSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {


	private _storageAccountNameTextBox!: azdata.InputBoxComponent;

	private _storageAccountSKUDropdown!: azdata.DropDownComponent;
	private _storageAccountSKUDropdownLoader!: azdata.LoadingComponent;


	private _form!: azdata.FormContainer;



	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			'Storage account settings',
			'',
			wizard
		);
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			this.createStorageAccountNameTextBox(view);
			this.createStorageAccountsSKUDropdown(view);

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							title: 'Storage account name',
							component: this._storageAccountNameTextBox,
						},
						{
							title: 'Storage account SKU',
							component: this._storageAccountSKUDropdownLoader
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
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private async createStorageAccountNameTextBox(view: azdata.ModelView) {
		this._storageAccountNameTextBox = view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this._storageAccountNameTextBox.onTextChanged((value) => {
			this.wizard.model.storageAccountName = value;
		});
	}

	private async createStorageAccountsSKUDropdown(view: azdata.ModelView) {
		this._storageAccountSKUDropdown = view.modelBuilder.dropDown().withProperties({
			required: true,
			values: [
				{
					name: 'Standard_LRS',
					displayName: 'Standard_LRS'
				},
				{
					name: 'Standard_GRS',
					displayName: 'Standard_GRS'
				},
				{
					name: 'Standard_RAGRS',
					displayName: 'Standard_RAGRS'
				},
				{
					name: 'Standard_ZRS',
					displayName: 'Standard_ZRS'
				},
				{
					name: 'Premium_LRS',
					displayName: 'Premium_LRS'
				},
				{
					name: 'Premium_ZRS',
					displayName: 'Premium_ZRS'
				},
				{
					name: 'Standard_GZRS',
					displayName: 'Standard_GZRS'
				},
				{
					name: 'Standard_RAGZRS',
					displayName: 'Standard_RAGZRS'
				}
			]
		}).component();

		this._storageAccountSKUDropdown.onValueChanged((value) => {
			this.wizard.model.storageAccountSKU = value.selected;
		});

		this._storageAccountSKUDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._storageAccountSKUDropdown).component();

		this.wizard.model.storageAccountSKU = (this._storageAccountSKUDropdown.value as azdata.CategoryValue)!.name;
		this._storageAccountSKUDropdownLoader.loading = false;
	}
}
