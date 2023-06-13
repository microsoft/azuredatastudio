/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { ViewServerPropertiesDocUrl } from '../constants';
import { ServerPropertiesInfo, ServerPropertiesViewInfo } from '../interfaces';

export class ServerPropertiesDialog extends ObjectManagementDialogBase<ServerPropertiesInfo, ServerPropertiesViewInfo> {
	private generalTab: azdata.Tab;
	private generalSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private languageDropdown: azdata.DropDownComponent;
	private memoryInput: azdata.InputBoxComponent;
	private operatingSystemInput: azdata.InputBoxComponent;

	private memoryTab: azdata.Tab;
	private memorySection: azdata.GroupContainer;
	private minServerMemoryInput: azdata.InputBoxComponent;
	private maxServerMemoryInput: azdata.InputBoxComponent;

	private numberInputType: azdata.InputBoxInputType = 'number';

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get helpUrl(): string {
		return ViewServerPropertiesDocUrl;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.initializeMemorySection();
		const serverPropertiesTabGroup = { title: '', tabs: [this.generalTab, this.memoryTab] };
		const serverPropertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel().withTabs([serverPropertiesTabGroup]).component();
		this.formContainer.addItem(serverPropertiesTabbedPannel);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.languageDropdown = this.createDropdown(localizedConstants.LanguageText, undefined, [this.objectInfo.language], this.objectInfo.language, this.options.isNewObject);
		const languageContainer = this.createLabelInputContainer(localizedConstants.LanguageText, this.languageDropdown);

		this.memoryInput = this.createInputBox(localizedConstants.MemoryText, undefined, this.objectInfo.memoryInMb.toString(), this.options.isNewObject, this.numberInputType);
		const memoryContainer = this.createLabelInputContainer(localizedConstants.MemoryText, this.memoryInput);

		this.operatingSystemInput = this.createInputBox(localizedConstants.OperatingSystemText, undefined, this.objectInfo.operatingSystem, this.options.isNewObject);
		const operatingSystemContainer = this.createLabelInputContainer(localizedConstants.OperatingSystemText, this.operatingSystemInput);

		this.generalSection = this.createGroup('', [
			nameContainer,
			languageContainer,
			memoryContainer,
			operatingSystemContainer
		], false);

		this.generalTab = this.createTab('generalId', localizedConstants.GeneralSectionHeader, this.generalSection);
	}

	private initializeMemorySection(): void {
		this.minServerMemoryInput = this.createInputBox(localizedConstants.minServerMemoryText, async (newValue) => {
			this.objectInfo.minMemoryInMb = +newValue;
		}, this.objectInfo.minMemoryInMb.toString(), true, this.numberInputType);
		const minMemoryContainer = this.createLabelInputContainer(localizedConstants.minServerMemoryText, this.minServerMemoryInput);

		this.maxServerMemoryInput = this.createInputBox(localizedConstants.maxServerMemoryText, async (newValue) => {
			this.objectInfo.maxMemoryInMb = +newValue;
		}, this.objectInfo.maxMemoryInMb.toString(), true, this.numberInputType);
		const maxMemoryContainer = this.createLabelInputContainer(localizedConstants.maxServerMemoryText, this.maxServerMemoryInput);

		this.memorySection = this.createGroup('', [
			minMemoryContainer,
			maxMemoryContainer
		], false);

		this.memoryTab = this.createTab('memoryId', localizedConstants.MemoryText, this.memorySection);
	}
}
