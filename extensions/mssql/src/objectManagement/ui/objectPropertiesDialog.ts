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
	private generalSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private languageInput: azdata.InputBoxComponent;
	private memoryInput: azdata.InputBoxComponent;
	private operatingSystemInput: azdata.InputBoxComponent;

	private memoryTab: azdata.window.DialogTab;
	private memorySection: azdata.GroupContainer;
	private minServerMemoryInput: azdata.InputBoxComponent;
	private maxServerMemoryInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
		this.generalTab = azdata.window.createTab(localizedConstants.GeneralSectionHeader);
		this.memoryTab = azdata.window.createTab(localizedConstants.MemoryText);
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
		this.initializeMemorySection();
		this.dialogObject.content = [this.generalTab, this.memoryTab];
		azdata.window.openDialog(this.dialogObject);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.languageInput = this.createInputBox(localizedConstants.LanguageText, async (newValue) => {
			this.objectInfo.language = newValue;
		}, this.objectInfo.language, this.options.isNewObject);
		const languageContainer = this.createLabelInputContainer(localizedConstants.LanguageText, this.languageInput);

		this.memoryInput = this.createInputBox(localizedConstants.MemoryText, async (newValue) => {
			this.objectInfo.memory = newValue;
		}, this.objectInfo.memory, this.options.isNewObject);
		const memoryContainer = this.createLabelInputContainer(localizedConstants.MemoryText, this.memoryInput);

		this.operatingSystemInput = this.createInputBox(localizedConstants.OperatingSystemText, async (newValue) => {
			this.objectInfo.operatingSystem = newValue;
		}, this.objectInfo.operatingSystem, this.options.isNewObject);
		const operatingSystemContainer = this.createLabelInputContainer(localizedConstants.OperatingSystemText, this.operatingSystemInput);

		this.generalSection = this.createGroup('', [
			nameContainer,
			languageContainer,
			memoryContainer,
			operatingSystemContainer
		], false);

		this.registerTab(this.generalTab, [this.generalSection]);
	}

	private initializeMemorySection(): void {
		this.minServerMemoryInput = this.createInputBox(localizedConstants.minServerMemoryText, async (newValue) => {
			this.objectInfo.minMemory = newValue;
		}, this.objectInfo.minMemory, true);
		const minMemoryContainer = this.createLabelInputContainer(localizedConstants.minServerMemoryText, this.minServerMemoryInput);

		this.maxServerMemoryInput = this.createInputBox(localizedConstants.maxServerMemoryText, async (newValue) => {
			this.objectInfo.maxMemory = newValue;
		}, this.objectInfo.maxMemory, true);
		const maxMemoryContainer = this.createLabelInputContainer(localizedConstants.maxServerMemoryText, this.maxServerMemoryInput);

		this.memorySection = this.createGroup('', [
			minMemoryContainer,
			maxMemoryContainer
		], false);

		this.registerTab(this.memoryTab, [this.memorySection]);
	}
}
