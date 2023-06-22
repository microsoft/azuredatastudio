/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AzureSQLMI, ViewServerPropertiesDocUrl } from '../constants';
import { Server, ServerViewInfo } from '../interfaces';

export class ServerPropertiesDialog extends ObjectManagementDialogBase<Server, ServerViewInfo> {
	private generalTab: azdata.Tab;
	private platformSection: azdata.GroupContainer;
	private sqlServerSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private hardwareGenerationInput: azdata.InputBoxComponent;
	private languageDropdown: azdata.DropDownComponent;
	private memoryInput: azdata.InputBoxComponent;
	private operatingSystemInput: azdata.InputBoxComponent;
	private platformInput: azdata.InputBoxComponent;
	private processorsInput: azdata.InputBoxComponent;
	private isClusteredInput: azdata.InputBoxComponent;
	private isHadrEnabledInput: azdata.InputBoxComponent;
	private isPolyBaseInstalledInput: azdata.InputBoxComponent;
	private isXTPSupportedInput: azdata.InputBoxComponent;
	private productInput: azdata.InputBoxComponent;
	private reservedStorageSizeInMBInput: azdata.InputBoxComponent;
	private rootDirectoryInput: azdata.InputBoxComponent;
	private serverCollationInput: azdata.InputBoxComponent;
	private serviceTierInput: azdata.InputBoxComponent;
	private storageSpaceUsageInGBInput: azdata.InputBoxComponent;
	private versionInput: azdata.InputBoxComponent;

	private memoryTab: azdata.Tab;
	private memorySection: azdata.GroupContainer;
	private minServerMemoryInput: azdata.InputBoxComponent;
	private maxServerMemoryInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get helpUrl(): string {
		return ViewServerPropertiesDocUrl;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.initializeMemorySection();
		const serverPropertiesTabGroup = { title: '', tabs: [this.generalTab] };
		const serverPropertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel().withTabs([serverPropertiesTabGroup]).component();
		this.formContainer.addItem(serverPropertiesTabbedPannel);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.hardwareGenerationInput = this.createInputBox(localizedConstants.HardwareGenerationText, undefined, this.objectInfo.hardwareGeneration.toString(), this.options.isNewObject);
		const hardwareGenerationContainer = this.createLabelInputContainer(localizedConstants.HardwareGenerationText, this.hardwareGenerationInput);

		this.languageDropdown = this.createDropdown(localizedConstants.LanguageText, undefined, [this.objectInfo.language], this.objectInfo.language, this.options.isNewObject);
		const languageContainer = this.createLabelInputContainer(localizedConstants.LanguageText, this.languageDropdown);

		this.memoryInput = this.createInputBox(localizedConstants.MemoryText, undefined, this.objectInfo.memoryInMB.toString().concat(' MB'), this.options.isNewObject);
		const memoryContainer = this.createLabelInputContainer(localizedConstants.MemoryText, this.memoryInput);

		this.operatingSystemInput = this.createInputBox(localizedConstants.OperatingSystemText, undefined, this.objectInfo.operatingSystem, this.options.isNewObject);
		const operatingSystemContainer = this.createLabelInputContainer(localizedConstants.OperatingSystemText, this.operatingSystemInput);

		this.platformInput = this.createInputBox(localizedConstants.PlatformText, undefined, this.objectInfo.platform, this.options.isNewObject);
		const platformContainer = this.createLabelInputContainer(localizedConstants.PlatformText, this.platformInput);

		this.processorsInput = this.createInputBox(localizedConstants.ProcessorsText, undefined, this.objectInfo.processors, this.options.isNewObject);
		const processorsContainer = this.createLabelInputContainer(localizedConstants.ProcessorsText, this.processorsInput);

		this.isClusteredInput = this.createInputBox(localizedConstants.IsClusteredText, undefined, this.objectInfo.isClustered.toString(), this.options.isNewObject);
		const isClusteredContainer = this.createLabelInputContainer(localizedConstants.IsClusteredText, this.isClusteredInput);

		this.isHadrEnabledInput = this.createInputBox(localizedConstants.IsHadrEnabledText, undefined, this.objectInfo.isHadrEnabled.toString(), this.options.isNewObject);
		const isHadrEnabledContainer = this.createLabelInputContainer(localizedConstants.IsHadrEnabledText, this.isHadrEnabledInput);

		this.isPolyBaseInstalledInput = this.createInputBox(localizedConstants.IsPolyBaseInstalledText, undefined, this.objectInfo.isPolyBaseInstalled.toString(), this.options.isNewObject);
		const isPolyBaseInstalledContainer = this.createLabelInputContainer(localizedConstants.IsPolyBaseInstalledText, this.isPolyBaseInstalledInput);

		this.isXTPSupportedInput = this.createInputBox(localizedConstants.IsXTPSupportedText, undefined, this.objectInfo.isXTPSupported.toString(), this.options.isNewObject);
		const isXTPSupportedContainer = this.createLabelInputContainer(localizedConstants.IsXTPSupportedText, this.isXTPSupportedInput);

		this.productInput = this.createInputBox(localizedConstants.ProductText, undefined, this.objectInfo.product, this.options.isNewObject);
		const productContainer = this.createLabelInputContainer(localizedConstants.ProductText, this.productInput);

		this.reservedStorageSizeInMBInput = this.createInputBox(localizedConstants.ReservedStorageSizeInMBText, undefined, this.objectInfo.reservedStorageSizeMB.toString().concat(' MB'), this.options.isNewObject);
		const reservedStorageSizeInMBContainer = this.createLabelInputContainer(localizedConstants.ReservedStorageSizeInMBText, this.reservedStorageSizeInMBInput);

		this.rootDirectoryInput = this.createInputBox(localizedConstants.RootDirectoryText, undefined, this.objectInfo.rootDirectory, this.options.isNewObject);
		const rootDirectoryContainer = this.createLabelInputContainer(localizedConstants.RootDirectoryText, this.rootDirectoryInput);

		this.serverCollationInput = this.createInputBox(localizedConstants.ServerCollationText, undefined, this.objectInfo.serverCollation, this.options.isNewObject);
		const serverCollationContainer = this.createLabelInputContainer(localizedConstants.ServerCollationText, this.serverCollationInput);

		this.serviceTierInput = this.createInputBox(localizedConstants.ServiceTierText, undefined, this.objectInfo.serviceTier, this.options.isNewObject);
		const serviceTierContainer = this.createLabelInputContainer(localizedConstants.ServiceTierText, this.serviceTierInput);

		this.storageSpaceUsageInGBInput = this.createInputBox(localizedConstants.StorageSpaceUsageInGBText, undefined, this.objectInfo.storageSpaceUsageInGB.toString().concat(' GB'), this.options.isNewObject);
		const storageSpaceUsageInGbContainer = this.createLabelInputContainer(localizedConstants.StorageSpaceUsageInGBText, this.storageSpaceUsageInGBInput);

		this.versionInput = this.createInputBox(localizedConstants.VersionText, undefined, this.objectInfo.version, this.options.isNewObject);
		const versionContainer = this.createLabelInputContainer(localizedConstants.VersionText, this.versionInput);

		let platformItems = [
			nameContainer,
			languageContainer,
			memoryContainer,
			operatingSystemContainer,
			platformContainer,
			processorsContainer
		];

		let sqlServerItems = [
			isClusteredContainer,
			isHadrEnabledContainer,
			isPolyBaseInstalledContainer,
			isXTPSupportedContainer,
			productContainer,
			rootDirectoryContainer,
			serverCollationContainer,
			versionContainer
		];

		if (this.objectInfo.platform === AzureSQLMI) {
			platformItems.unshift(hardwareGenerationContainer);
			sqlServerItems.push(reservedStorageSizeInMBContainer, serviceTierContainer, storageSpaceUsageInGbContainer);
			// remove isXTPSupported
			sqlServerItems.splice(3, 1);
		}

		this.platformSection = this.createGroup('Platform', platformItems, true);
		this.sqlServerSection = this.createGroup('SQL Server', sqlServerItems, true);

		const generalContainer = this.createGroup('', [this.platformSection, this.sqlServerSection])

		this.generalTab = this.createTab('generalId', localizedConstants.GeneralSectionHeader, generalContainer);
	}

	private initializeMemorySection(): void {
		this.minServerMemoryInput = this.createInputBox(localizedConstants.minServerMemoryText, async (newValue) => {
			this.objectInfo.minServerMemory = +newValue;
		}, this.objectInfo.minServerMemory.toString(), true, 'number');
		const minMemoryContainer = this.createLabelInputContainer(localizedConstants.minServerMemoryText, this.minServerMemoryInput);

		this.maxServerMemoryInput = this.createInputBox(localizedConstants.maxServerMemoryText, async (newValue) => {
			this.objectInfo.maxServerMemory = +newValue;
		}, this.objectInfo.maxServerMemory.toString(), true, 'number');
		const maxMemoryContainer = this.createLabelInputContainer(localizedConstants.maxServerMemoryText, this.maxServerMemoryInput);

		this.memorySection = this.createGroup('', [
			minMemoryContainer,
			maxMemoryContainer
		], false);

		this.memoryTab = this.createTab('memoryId', localizedConstants.MemoryText, this.memorySection);
	}
}
