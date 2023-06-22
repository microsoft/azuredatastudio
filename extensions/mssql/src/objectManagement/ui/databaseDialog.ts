/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { CreateDatabaseDocUrl, DatabasePropertiesDocUrl } from '../constants';
import { Database, DatabaseViewInfo } from '../interfaces';
import { convertNumToTwoDecimalStringinMB } from '../utils';

export class DatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// Database Properties tabs
	private generalTab: azdata.Tab;
	private optionsTab: azdata.Tab;

	// Database properties options
	// General Tab
	private nameInput: azdata.InputBoxComponent;
	private backupSection: azdata.GroupContainer;
	private lastDatabaseBackupInput: azdata.InputBoxComponent;
	private lastDatabaseLogBackupInput: azdata.InputBoxComponent;
	private databaseSection: azdata.GroupContainer;
	private statusInput: azdata.InputBoxComponent;
	private ownerInput: azdata.InputBoxComponent;
	private dateCreatedInput: azdata.InputBoxComponent;
	private sizeInput: azdata.InputBoxComponent;
	private spaceAvailabeInput: azdata.InputBoxComponent;
	private numberOfUsersInput: azdata.InputBoxComponent;
	private memoryAllocatedInput: azdata.InputBoxComponent;
	private memoryUsedInput: azdata.InputBoxComponent;
	private collationInput: azdata.InputBoxComponent;
	// Options Tab
	private automaticSection: azdata.GroupContainer;
	private ledgerSection: azdata.GroupContainer;
	private recoverySection: azdata.GroupContainer;
	private stateSection: azdata.GroupContainer;
	private autoCreateIncrementalStatisticsInput: azdata.DropDownComponent;
	private autoCreateStatisticsInput: azdata.DropDownComponent;
	private autoShrinkInput: azdata.DropDownComponent;
	private autoUpdateStatisticsInput: azdata.DropDownComponent;
	private autoUpdateStatisticsAsynchronouslyInput: azdata.DropDownComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateDatabaseDocUrl : DatabasePropertiesDocUrl;
	}

	protected async initializeUI(): Promise<void> {
		if (this.options.isNewObject) {
			let components = [];
			components.push(this.initializeGeneralSection());
			components.push(this.initializeOptionsSection());
			if (this.viewInfo.isAzureDB) {
				components.push(this.initializeConfigureSLOSection());
			}
			this.formContainer.addItems(components);
		} else {
			// Initilaize general Tab sections
			this.initializeBackupSection();
			this.initializeDatabaseSection();

			//Initilaize options Tab sections
			this.initializeAutomaticSection();
			this.initializeLedgerSection();
			this.initializeRecoverySection();
			this.initializeStateSection();

			// Initilaize general Tab
			this.generalTab = {
				title: localizedConstants.GeneralSectionHeader,
				id: 'generalId',
				content: this.createGroup('', [
					this.databaseSection,
					this.backupSection
				], false)
			};

			// Initilaize Options Tab
			this.optionsTab = {
				title: localizedConstants.OptionsSectionHeader,
				id: 'optionsId',
				content: this.createGroup('', [
					this.automaticSection,
					this.ledgerSection,
					this.recoverySection,
					this.stateSection
				], false)
			};

			// Initilaize tab group with tabbed panel
			const propertiesTabGroup = { title: '', tabs: [this.generalTab, this.optionsTab] };
			const propertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel()
				.withTabs([propertiesTabGroup])
				.withProps({
					CSSStyles: {
						'margin': '-10px 0px 0px -10px'
					}
				})
				.component();
			this.formContainer.addItem(propertiesTabbedPannel);
		}
	}

	//#region Create Database
	private initializeGeneralSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		this.nameInput = this.createInputBox(localizedConstants.NameText, async () => {
			this.objectInfo.name = this.nameInput.value;
			await this.runValidation(false);
		});
		containers.push(this.createLabelInputContainer(localizedConstants.NameText, this.nameInput));

		if (this.viewInfo.loginNames?.length > 0) {
			this.objectInfo.owner = this.viewInfo.loginNames[0];
			let ownerDropbox = this.createDropdown(localizedConstants.OwnerText, async () => {
				this.objectInfo.owner = ownerDropbox.value as string;
			}, this.viewInfo.loginNames, this.viewInfo.loginNames[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.OwnerText, ownerDropbox));
		}

		return this.createGroup(localizedConstants.GeneralSectionHeader, containers, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		if (this.viewInfo.collationNames?.length > 0) {
			this.objectInfo.collationName = this.viewInfo.collationNames[0];
			let collationDropbox = this.createDropdown(localizedConstants.CollationText, async () => {
				this.objectInfo.collationName = collationDropbox.value as string;
			}, this.viewInfo.collationNames, this.viewInfo.collationNames[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox));
		}

		if (this.viewInfo.recoveryModels?.length > 0) {
			this.objectInfo.recoveryModel = this.viewInfo.recoveryModels[0];
			let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, async () => {
				this.objectInfo.recoveryModel = recoveryDropbox.value as string;
			}, this.viewInfo.recoveryModels, this.viewInfo.recoveryModels[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox));
		}

		if (this.viewInfo.compatibilityLevels?.length > 0) {
			this.objectInfo.compatibilityLevel = this.viewInfo.compatibilityLevels[0];
			let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, async () => {
				this.objectInfo.compatibilityLevel = compatibilityDropbox.value as string;
			}, this.viewInfo.compatibilityLevels, this.viewInfo.compatibilityLevels[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox));
		}

		if (this.viewInfo.containmentTypes?.length > 0) {
			this.objectInfo.containmentType = this.viewInfo.containmentTypes[0];
			let containmentDropbox = this.createDropdown(localizedConstants.ContainmentTypeText, async () => {
				this.objectInfo.containmentType = containmentDropbox.value as string;
			}, this.viewInfo.containmentTypes, this.viewInfo.containmentTypes[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.ContainmentTypeText, containmentDropbox));
		}

		return this.createGroup(localizedConstants.OptionsSectionHeader, containers, true, true);
	}
	//#endregion

	//#region Database Properties - General Tab
	private initializeBackupSection(): void {
		this.lastDatabaseBackupInput = this.createInputBox(localizedConstants.LastDatabaseBackupText, async () => { }, this.objectInfo.lastDatabaseBackup, this.options.isNewObject);
		const lastDatabaseBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseBackupText, this.lastDatabaseBackupInput);

		this.lastDatabaseLogBackupInput = this.createInputBox(localizedConstants.LastDatabaseLogBackupText, async () => { }, this.objectInfo.lastDatabaseLogBackup, this.options.isNewObject);
		const lastDatabaseLogBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseLogBackupText, this.lastDatabaseLogBackupInput);

		this.backupSection = this.createGroup(localizedConstants.BackupSectionHeader, [
			lastDatabaseBackupContainer,
			lastDatabaseLogBackupContainer
		], true);
	}

	private initializeDatabaseSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NamePropertyText, async () => { }, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NamePropertyText, this.nameInput);

		this.statusInput = this.createInputBox(localizedConstants.StatusText, async () => { }, this.objectInfo.status, this.options.isNewObject);
		const statusContainer = this.createLabelInputContainer(localizedConstants.StatusText, this.statusInput);

		this.ownerInput = this.createInputBox(localizedConstants.OwnerPropertyText, async () => { }, this.objectInfo.owner, this.options.isNewObject);
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerPropertyText, this.ownerInput);

		this.dateCreatedInput = this.createInputBox(localizedConstants.DateCreatedText, async () => { }, this.objectInfo.dateCreated, this.options.isNewObject);
		const dateCreatedContainer = this.createLabelInputContainer(localizedConstants.DateCreatedText, this.dateCreatedInput);

		this.sizeInput = this.createInputBox(localizedConstants.SizeText, async () => { }, convertNumToTwoDecimalStringinMB(this.objectInfo.sizeInMb), this.options.isNewObject);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.SizeText, this.sizeInput);

		this.spaceAvailabeInput = this.createInputBox(localizedConstants.SpaceAvailableText, async () => { }, convertNumToTwoDecimalStringinMB(this.objectInfo.spaceAvailableInMb), this.options.isNewObject);
		const spaceAvailabeContainer = this.createLabelInputContainer(localizedConstants.SpaceAvailableText, this.spaceAvailabeInput);

		this.numberOfUsersInput = this.createInputBox(localizedConstants.NumberOfUsersText, async () => { }, this.objectInfo.numberOfUsers.toString(), this.options.isNewObject);
		const numberOfUsersContainer = this.createLabelInputContainer(localizedConstants.NumberOfUsersText, this.numberOfUsersInput);

		this.memoryAllocatedInput = this.createInputBox(localizedConstants.MemoryAllocatedText, async () => { }, convertNumToTwoDecimalStringinMB(this.objectInfo.memoryAllocatedToMemoryOptimizedObjectsInMb), this.options.isNewObject);
		const memoryAllocatedContainer = this.createLabelInputContainer(localizedConstants.MemoryAllocatedText, this.memoryAllocatedInput);

		this.memoryUsedInput = this.createInputBox(localizedConstants.MemoryUsedText, async () => { }, convertNumToTwoDecimalStringinMB(this.objectInfo.memoryUsedByMemoryOptimizedObjectsInMb), this.options.isNewObject);
		const memoryUsedContainer = this.createLabelInputContainer(localizedConstants.MemoryUsedText, this.memoryUsedInput);

		this.collationInput = this.createInputBox(localizedConstants.CollationText, async () => { }, this.objectInfo.collationName, this.options.isNewObject);
		const collationContainer = this.createLabelInputContainer(localizedConstants.CollationText, this.collationInput);

		this.databaseSection = this.createGroup(localizedConstants.DatabaseSectionHeader, [
			nameContainer,
			statusContainer,
			ownerContainer,
			collationContainer,
			dateCreatedContainer,
			sizeContainer,
			spaceAvailabeContainer,
			numberOfUsersContainer,
			memoryAllocatedContainer,
			memoryUsedContainer
		], true);
	}
	//#endregion

	//#region Database Properties - Options Tab
	private initializeAutomaticSection(): void {
		this.autoCreateIncrementalStatisticsInput = this.createDropdown(localizedConstants.AutoCreateIncrementalStatistics, async (newValue) => {
			this.objectInfo.autoCreateIncrementalStatistics = newValue;
		}, ['True', 'False'], this.objectInfo.autoCreateIncrementalStatistics, true);
		const autoCreateIncrementalStatisticsContainer = this.createLabelInputContainer(localizedConstants.AutoCreateIncrementalStatistics, this.autoCreateIncrementalStatisticsInput);

		this.autoCreateStatisticsInput = this.createDropdown(localizedConstants.AutoCreateStatistics, async (newValue) => {
			this.objectInfo.autoCreateStatistics = newValue as string;
		}, ['True', 'False'], this.objectInfo.autoCreateStatistics, true);
		const autoCreateStatisticsContainer = this.createLabelInputContainer(localizedConstants.AutoCreateStatistics, this.autoCreateStatisticsInput);

		this.autoShrinkInput = this.createDropdown(localizedConstants.AutoShrink, async (newValue) => {
			this.objectInfo.autoShrink = newValue as string;
		}, ['True', 'False'], this.objectInfo.autoShrink, true);
		const autoShrinkContainer = this.createLabelInputContainer(localizedConstants.AutoShrink, this.autoShrinkInput);

		this.autoUpdateStatisticsInput = this.createDropdown(localizedConstants.AutoUpdateStatistics, async (newValue) => {
			this.objectInfo.autoUpdateStatistics = newValue as string;
		}, ['True', 'False'], this.objectInfo.autoUpdateStatistics, true);
		const autoUpdateStatisticsContainer = this.createLabelInputContainer(localizedConstants.AutoUpdateStatistics, this.autoUpdateStatisticsInput);

		this.autoUpdateStatisticsAsynchronouslyInput = this.createDropdown(localizedConstants.AutoUpdateStatisticsAsynchronously, async (newValue) => {
			this.objectInfo.autoUpdateStatisticsAsynchronously = newValue as string;
		}, ['True', 'False'], this.objectInfo.autoUpdateStatisticsAsynchronously, true);
		const autoUpdateStatisticsAsynchronouslyContainer = this.createLabelInputContainer(localizedConstants.AutoUpdateStatisticsAsynchronously, this.autoUpdateStatisticsAsynchronouslyInput);

		this.automaticSection = this.createGroup(localizedConstants.AutomaticSectionHeader, [
			autoCreateIncrementalStatisticsContainer,
			autoCreateStatisticsContainer,
			autoShrinkContainer,
			autoUpdateStatisticsContainer,
			autoUpdateStatisticsAsynchronouslyContainer
		], true);
	}

	private initializeLedgerSection(): void {
		this.ledgerSection = this.createGroup(localizedConstants.AutomaticSectionHeader, [
		], true);
	}


	private initializeRecoverySection(): void {
		this.stateSection = this.createGroup(localizedConstants.AutomaticSectionHeader, [
		], true);
	}

	private initializeStateSection(): void {
		this.stateSection = this.createGroup(localizedConstants.AutomaticSectionHeader, [
		], true);
	}
	//#endregion

	private initializeConfigureSLOSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		if (this.viewInfo.azureEditions?.length > 0) {
			let defaultEdition = this.viewInfo.azureEditions[0];
			this.objectInfo.azureEdition = defaultEdition;

			// Service Level Objective options
			let sloDetails = this.viewInfo.azureServiceLevelObjectives?.find(details => details.editionDisplayName === defaultEdition);
			let serviceLevels = sloDetails?.details ?? [];
			this.objectInfo.azureServiceLevelObjective = serviceLevels[0];
			let serviceLevelDropbox = this.createDropdown(localizedConstants.CurrentSLOText, async () => {
				this.objectInfo.azureServiceLevelObjective = serviceLevelDropbox.value as string;
			}, serviceLevels, serviceLevels[0]);

			// Maximum Database Size options
			let sizeDetails = this.viewInfo.azureMaxSizes?.find(details => details.editionDisplayName === defaultEdition);
			let maxSizes = sizeDetails?.details ?? [];
			this.objectInfo.azureMaxSize = maxSizes[0];
			let sizeDropbox = this.createDropdown(localizedConstants.MaxSizeText, async () => {
				this.objectInfo.azureMaxSize = sizeDropbox.value as string;
			}, maxSizes, maxSizes[0]);

			// Azure Database Edition options
			let editionDropbox = this.createDropdown(localizedConstants.EditionText, async () => {
				let edition = editionDropbox.value as string;
				this.objectInfo.azureEdition = edition;

				// Update dropboxes for SLO and Size, since they're edition specific
				sloDetails = this.viewInfo.azureServiceLevelObjectives?.find(details => details.editionDisplayName === edition);
				serviceLevels = sloDetails?.details ?? [];
				serviceLevelDropbox.loading = true;
				await serviceLevelDropbox.updateProperties({ value: serviceLevels[0], values: serviceLevels });
				serviceLevelDropbox.loading = false;

				sizeDetails = this.viewInfo.azureMaxSizes?.find(details => details.editionDisplayName === edition);
				maxSizes = sizeDetails?.details ?? [];
				sizeDropbox.loading = true;
				await sizeDropbox.updateProperties({ value: maxSizes[0], values: maxSizes });
				sizeDropbox.loading = false;
			}, this.viewInfo.azureEditions, defaultEdition);

			containers.push(this.createLabelInputContainer(localizedConstants.EditionText, editionDropbox));
			containers.push(this.createLabelInputContainer(localizedConstants.CurrentSLOText, serviceLevelDropbox));
			containers.push(this.createLabelInputContainer(localizedConstants.MaxSizeText, sizeDropbox));
		}

		if (this.viewInfo.azureBackupRedundancyLevels?.length > 0) {
			let backupDropbox = this.createDropdown(localizedConstants.BackupRedundancyText, async () => {
				this.objectInfo.azureBackupRedundancyLevel = backupDropbox.value as string;
			}, this.viewInfo.azureBackupRedundancyLevels, this.viewInfo.azureBackupRedundancyLevels[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.BackupRedundancyText, backupDropbox));
		}

		containers.push(this.createHyperlink(localizedConstants.AzurePricingLinkText, 'https://go.microsoft.com/fwlink/?linkid=2239183'));

		return this.createGroup(localizedConstants.ConfigureSLOSectionHeader, containers, true, true);
	}
}
