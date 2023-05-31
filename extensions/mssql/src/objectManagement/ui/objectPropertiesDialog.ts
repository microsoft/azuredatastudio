/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterUserDocUrl, CreateUserDocUrl } from '../constants';

export class ObjectPropertiesDialog extends ObjectManagementDialogBase<ObjectManagement.PropertiesInfo, ObjectManagement.PropertiesViewInfo> {
	private generalTab: azdata.window.DialogTab;
	private testTab: azdata.window.DialogTab;
	private generalSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private languageInput: azdata.InputBoxComponent;
	private memoryInput: azdata.InputBoxComponent;
	private operatingSystemInput: azdata.InputBoxComponent;


	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
		this.generalTab = azdata.window.createTab('General');
		this.testTab = azdata.window.createTab('Test');
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateUserDocUrl : AlterUserDocUrl;
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		return errors;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.dialogObject.content = [this.generalTab, this.testTab];
		azdata.window.openDialog(this.dialogObject);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.languageInput = this.createInputBox('Language', async (newValue) => {
			this.objectInfo.language = newValue;
		}, this.objectInfo.language, this.options.isNewObject);
		const languageContainer = this.createLabelInputContainer('Language', this.languageInput);

		this.memoryInput = this.createInputBox('Memory', async (newValue) => {
			this.objectInfo.memory = newValue;
		}, this.objectInfo.memory, this.options.isNewObject);
		const memoryContainer = this.createLabelInputContainer('Memory', this.memoryInput);

		this.operatingSystemInput = this.createInputBox('Operating System', async (newValue) => {
			this.objectInfo.operatingSystem = newValue;
		}, this.objectInfo.operatingSystem, this.options.isNewObject);
		const operatingSystemContainer = this.createLabelInputContainer('Operating System', this.operatingSystemInput);

		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer,
			languageContainer,
			memoryContainer,
			operatingSystemContainer
		], false);

		this.registerTab(this.generalTab, [this.generalSection]);
		this.registerTab(this.testTab, [this.generalSection]);
	}
}
