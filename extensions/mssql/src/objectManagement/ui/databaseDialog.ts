/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth, DefaultTableWidth, getTableHeight } from '../../ui/dialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { CreateDatabaseDocUrl, DatabaseGeneralPropertiesDocUrl, DatabaseOptionsPropertiesDocUrl, DatabaseScopedConfigurationPropertiesDocUrl } from '../constants';
import { Database, DatabaseScopedConfigurationsInfo, DatabaseViewInfo } from '../interfaces';
import { convertNumToTwoDecimalStringInMB } from '../utils';
import { isUndefinedOrNull } from '../../types';
import { deepClone } from '../../util/objects';

export class DatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// Database Properties tabs
	private generalTab: azdata.Tab;
	private optionsTab: azdata.Tab;
	private dscTab: azdata.Tab;
	private optionsTabSectionsContainer: azdata.Component[] = [];
	private activeTabId: string;

	// Database properties options
	// General Tab
	private readonly generalTabId: string = 'generalDatabaseId';
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
	private readonly optionsTabId: string = 'optionsDatabaseId';
	private autoCreateIncrementalStatisticsInput: azdata.CheckBoxComponent;
	private autoCreateStatisticsInput: azdata.CheckBoxComponent;
	private autoShrinkInput: azdata.CheckBoxComponent;
	private autoUpdateStatisticsInput: azdata.CheckBoxComponent;
	private autoUpdateStatisticsAsynchronouslyInput: azdata.CheckBoxComponent;
	private isLedgerDatabaseInput!: azdata.CheckBoxComponent;
	private pageVerifyInput!: azdata.DropDownComponent;
	private targetRecoveryTimeInSecInput!: azdata.InputBoxComponent;
	private databaseReadOnlyInput!: azdata.CheckBoxComponent;
	private encryptionEnabledInput: azdata.CheckBoxComponent;
	private restrictAccessInput!: azdata.DropDownComponent;
	// Database Scoped Configurations Tab
	private readonly dscTabId: string = 'dscDatabaseId';
	private dscTabSectionsContainer: azdata.Component[] = [];
	private dscTable: azdata.TableComponent;
	private dscOriginalData: DatabaseScopedConfigurationsInfo[];
	private currentRowId: number;
	private valueForPrimaryInput: azdata.DropDownComponent;
	private valueForSecondaryInput: azdata.DropDownComponent;
	private setSecondaryCheckbox: azdata.CheckBoxComponent;
	private maxDopPrimaryInput: azdata.InputBoxComponent;
	private maxDopSecondaryInput: azdata.InputBoxComponent;
	private setMaxDopSecondaryCheckbox: azdata.CheckBoxComponent;
	private pausedResumableIndexPrimaryInput: azdata.InputBoxComponent;
	private dscPrimaryValueGroup: azdata.GroupContainer;
	private dscSecondaryValueGroup: azdata.GroupContainer;
	private dscSecondaryCheckboxValueGroup: azdata.GroupContainer;
	private dscMaxDopPrimaryValueGroup: azdata.GroupContainer;
	private dscMaxDopSecondaryValueGroup: azdata.GroupContainer;
	private dscMaxDopSecondaryCheckboxValueGroup: azdata.GroupContainer;
	private dscPausedResumableIndexPrimaryValueGroup: azdata.GroupContainer;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateDatabaseDocUrl : this.getDatabasePropertiesDocUrl();
	}

	private getDatabasePropertiesDocUrl(): string {
		let helpUrl = '';
		switch (this.activeTabId) {
			case this.generalTabId:
				helpUrl = DatabaseGeneralPropertiesDocUrl;
				break;
			case this.optionsTabId:
				helpUrl = DatabaseOptionsPropertiesDocUrl;
				break;
			case this.dscTabId:
				helpUrl = DatabaseScopedConfigurationPropertiesDocUrl;
				break;
			default:
				break;
		}
		return helpUrl;
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
			this.initializeOptionsGeneralSection();
			this.initializeAutomaticSection();
			if (!isUndefinedOrNull(this.objectInfo.isLedgerDatabase)) {
				this.initializeLedgerSection();
			}
			if (!isUndefinedOrNull(this.objectInfo.pageVerify) && !isUndefinedOrNull(this.objectInfo.targetRecoveryTimeInSec)) {
				this.initializeRecoverySection();
			}
			this.initializeStateSection();

			//Initilaize DSC Tab section
			await this.initializeDatabaseScopedConfigurationSection();

			// Initilaize general Tab
			this.generalTab = {
				title: localizedConstants.GeneralSectionHeader,
				id: this.generalTabId,
				content: this.createGroup('', [
					this.databaseSection,
					this.backupSection
				], false)
			};

			// Initilaize Options Tab
			this.optionsTab = {
				title: localizedConstants.OptionsSectionHeader,
				id: this.optionsTabId,
				content: this.createGroup('', this.optionsTabSectionsContainer, false)
			};

			this.dscTab = {
				title: localizedConstants.DatabaseScopedConfigurationTabHeader,
				id: this.dscTabId,
				content: this.createGroup('', this.dscTabSectionsContainer, false)
			}

			// Initilaize tab group with tabbed panel
			const propertiesTabGroup = { title: '', tabs: [this.generalTab, this.optionsTab, this.dscTab] };
			const propertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel()
				.withTabs([propertiesTabGroup])
				.withProps({
					CSSStyles: {
						'margin': '-10px 0px 0px -10px'
					}
				})
				.component();
			this.disposables.push(
				propertiesTabbedPannel.onTabChanged(async tabId => {
					this.activeTabId = tabId;
				}));
			this.formContainer.addItem(propertiesTabbedPannel);
		}
	}

	protected override async validateInput(): Promise<string[]> {
		let errors = await super.validateInput();
		if (this.viewInfo.collationNames?.length > 0 && !this.viewInfo.collationNames.some(name => name.toLowerCase() === this.objectInfo.collationName?.toLowerCase())) {
			errors.push(localizedConstants.CollationNotValidError(this.objectInfo.collationName ?? ''));
		}
		return errors;
	}

	//#region Create Database
	private initializeGeneralSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// The max length for database names is 128 characters: https://learn.microsoft.com/sql/t-sql/functions/db-name-transact-sql
		const maxLengthDatabaseName: number = 128;
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.NameText,
			required: true,
			maxLength: maxLengthDatabaseName
		};

		this.nameInput = this.createInputBoxWithProperties(async () => {
			this.objectInfo.name = this.nameInput.value;
		}, props);
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
			}, this.viewInfo.collationNames, this.viewInfo.collationNames[0], true, DefaultInputWidth, true, true);
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
		// Last Database Backup
		this.lastDatabaseBackupInput = this.createInputBox(localizedConstants.LastDatabaseBackupText, async () => { }, this.objectInfo.lastDatabaseBackup, this.options.isNewObject);
		const lastDatabaseBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseBackupText, this.lastDatabaseBackupInput);

		// Last Database Log Backup
		this.lastDatabaseLogBackupInput = this.createInputBox(localizedConstants.LastDatabaseLogBackupText, async () => { }, this.objectInfo.lastDatabaseLogBackup, this.options.isNewObject);
		const lastDatabaseLogBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseLogBackupText, this.lastDatabaseLogBackupInput);

		this.backupSection = this.createGroup(localizedConstants.BackupSectionHeader, [
			lastDatabaseBackupContainer,
			lastDatabaseLogBackupContainer
		], true);
	}

	private initializeDatabaseSection(): void {
		// Database Name
		this.nameInput = this.createInputBox(localizedConstants.NamePropertyText, async () => { }, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NamePropertyText, this.nameInput);

		// Database Status
		this.statusInput = this.createInputBox(localizedConstants.StatusText, async () => { }, this.objectInfo.status, this.options.isNewObject);
		const statusContainer = this.createLabelInputContainer(localizedConstants.StatusText, this.statusInput);

		// Database Owner
		this.ownerInput = this.createInputBox(localizedConstants.OwnerPropertyText, async () => { }, this.objectInfo.owner, this.options.isNewObject);
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerPropertyText, this.ownerInput);

		// Created Date
		this.dateCreatedInput = this.createInputBox(localizedConstants.DateCreatedText, async () => { }, this.objectInfo.dateCreated, this.options.isNewObject);
		const dateCreatedContainer = this.createLabelInputContainer(localizedConstants.DateCreatedText, this.dateCreatedInput);

		// Size
		this.sizeInput = this.createInputBox(localizedConstants.SizeText, async () => { }, convertNumToTwoDecimalStringInMB(this.objectInfo.sizeInMb), this.options.isNewObject);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.SizeText, this.sizeInput);

		// Space Available
		this.spaceAvailabeInput = this.createInputBox(localizedConstants.SpaceAvailableText, async () => { }, convertNumToTwoDecimalStringInMB(this.objectInfo.spaceAvailableInMb), this.options.isNewObject);
		const spaceAvailabeContainer = this.createLabelInputContainer(localizedConstants.SpaceAvailableText, this.spaceAvailabeInput);

		// Number of Users
		this.numberOfUsersInput = this.createInputBox(localizedConstants.NumberOfUsersText, async () => { }, this.objectInfo.numberOfUsers.toString(), this.options.isNewObject);
		const numberOfUsersContainer = this.createLabelInputContainer(localizedConstants.NumberOfUsersText, this.numberOfUsersInput);

		// Memory Allocated To Memory Optimized Objects
		this.memoryAllocatedInput = this.createInputBox(localizedConstants.MemoryAllocatedText, async () => { }, convertNumToTwoDecimalStringInMB(this.objectInfo.memoryAllocatedToMemoryOptimizedObjectsInMb), this.options.isNewObject);
		const memoryAllocatedContainer = this.createLabelInputContainer(localizedConstants.MemoryAllocatedText, this.memoryAllocatedInput);

		// Memory Used By Memory Optimized Objects
		this.memoryUsedInput = this.createInputBox(localizedConstants.MemoryUsedText, async () => { }, convertNumToTwoDecimalStringInMB(this.objectInfo.memoryUsedByMemoryOptimizedObjectsInMb), this.options.isNewObject);
		const memoryUsedContainer = this.createLabelInputContainer(localizedConstants.MemoryUsedText, this.memoryUsedInput);

		// Collation
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
	private initializeOptionsGeneralSection(): void {
		let containers: azdata.Component[] = [];
		// Collation
		let collationDropbox = this.createDropdown(localizedConstants.CollationText, async (newValue) => {
			this.objectInfo.collationName = newValue as string;
		}, this.viewInfo.collationNames, this.objectInfo.collationName, true, DefaultInputWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox));

		// Recovery Model
		let displayOptionsArray = this.viewInfo.recoveryModels.length === 0 ? [this.objectInfo.recoveryModel] : this.viewInfo.recoveryModels;
		let isEnabled = this.viewInfo.recoveryModels.length === 0 ? false : true;
		let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, async (newValue) => {
			this.objectInfo.recoveryModel = newValue as string;
		}, displayOptionsArray, this.objectInfo.recoveryModel, isEnabled);
		containers.push(this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox));

		// Compatibility Level
		let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, async (newValue) => {
			this.objectInfo.compatibilityLevel = newValue as string;
		}, this.viewInfo.compatibilityLevels, this.objectInfo.compatibilityLevel);
		containers.push(this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox));

		// Containment Type
		displayOptionsArray = this.viewInfo.containmentTypes.length === 0 ? [this.objectInfo.containmentType] : this.viewInfo.containmentTypes;
		isEnabled = this.viewInfo.containmentTypes.length === 0 ? false : true;
		let containmentDropbox = this.createDropdown(localizedConstants.ContainmentTypeText, async (newValue) => {
			this.objectInfo.containmentType = newValue as string;
		}, displayOptionsArray, this.objectInfo.containmentType, isEnabled);
		containers.push(this.createLabelInputContainer(localizedConstants.ContainmentTypeText, containmentDropbox));

		const optionsGeneralSection = this.createGroup('', containers, true, true);
		this.optionsTabSectionsContainer.push(optionsGeneralSection);
	}

	private initializeAutomaticSection(): void {
		// Auto Create Incremental Statistics
		this.autoCreateIncrementalStatisticsInput = this.createCheckbox(localizedConstants.AutoCreateIncrementalStatisticsText, async (checked) => {
			this.objectInfo.autoCreateIncrementalStatistics = checked;
		}, this.objectInfo.autoCreateIncrementalStatistics);

		// Auto Create Statistics
		this.autoCreateStatisticsInput = this.createCheckbox(localizedConstants.AutoCreateStatisticsText, async (checked) => {
			this.objectInfo.autoCreateStatistics = checked;
		}, this.objectInfo.autoCreateStatistics);

		// Auto Shrink
		this.autoShrinkInput = this.createCheckbox(localizedConstants.AutoShrinkText, async (checked) => {
			this.objectInfo.autoShrink = checked;
		}, this.objectInfo.autoShrink);

		// Auto Update Statistics
		this.autoUpdateStatisticsInput = this.createCheckbox(localizedConstants.AutoUpdateStatisticsText, async (checked) => {
			this.objectInfo.autoUpdateStatistics = checked;
		}, this.objectInfo.autoUpdateStatistics);

		//Auto Update Statistics Asynchronously
		this.autoUpdateStatisticsAsynchronouslyInput = this.createCheckbox(localizedConstants.AutoUpdateStatisticsAsynchronouslyText, async (checked) => {
			this.objectInfo.autoUpdateStatisticsAsynchronously = checked;
		}, this.objectInfo.autoUpdateStatisticsAsynchronously);
		const automaticSection = this.createGroup(localizedConstants.AutomaticSectionHeader, [
			this.autoCreateIncrementalStatisticsInput,
			this.autoCreateStatisticsInput,
			this.autoShrinkInput,
			this.autoUpdateStatisticsInput,
			this.autoUpdateStatisticsAsynchronouslyInput
		], true);

		this.optionsTabSectionsContainer.push(automaticSection);
	}

	private initializeLedgerSection(): void {
		// Ledger Database - ReadOnly (This can only be set during creation and not changed afterwards)
		this.isLedgerDatabaseInput = this.createCheckbox(localizedConstants.IsLedgerDatabaseText, async () => { }, this.objectInfo.isLedgerDatabase, false);

		const ledgerSection = this.createGroup(localizedConstants.LedgerSectionHeader, [
			this.isLedgerDatabaseInput
		], true);

		this.optionsTabSectionsContainer.push(ledgerSection);
	}

	private initializeRecoverySection(): void {
		// Page Verify
		this.pageVerifyInput = this.createDropdown(localizedConstants.PageVerifyText, async (newValue) => {
			this.objectInfo.pageVerify = newValue;
		}, this.viewInfo.pageVerifyOptions, this.objectInfo.pageVerify, true);
		const pageVerifyContainer = this.createLabelInputContainer(localizedConstants.PageVerifyText, this.pageVerifyInput);

		// Recovery Time In Seconds
		this.targetRecoveryTimeInSecInput = this.createInputBox(localizedConstants.TargetRecoveryTimeInSecondsText, async (newValue) => {
			this.objectInfo.targetRecoveryTimeInSec = Number(newValue);
		}, this.objectInfo.targetRecoveryTimeInSec.toString(), true, 'number', DefaultInputWidth, true, 0);
		const targetRecoveryTimeContainer = this.createLabelInputContainer(localizedConstants.TargetRecoveryTimeInSecondsText, this.targetRecoveryTimeInSecInput);

		const recoverySection = this.createGroup(localizedConstants.RecoverySectionHeader, [
			pageVerifyContainer,
			targetRecoveryTimeContainer
		], true);

		this.optionsTabSectionsContainer.push(recoverySection);
	}

	private initializeStateSection(): void {
		let containers: azdata.Component[] = [];
		// Database Read-Only
		if (!isUndefinedOrNull(this.objectInfo.databaseReadOnly)) {
			this.databaseReadOnlyInput = this.createCheckbox(localizedConstants.DatabaseReadOnlyText, async (checked) => {
				this.objectInfo.databaseReadOnly = checked;
			}, this.objectInfo.databaseReadOnly);
			containers.push(this.databaseReadOnlyInput);
		}

		// Database Status
		this.statusInput = this.createInputBox(localizedConstants.StatusText, async () => { }, this.objectInfo.status, this.options.isNewObject);
		containers.push(this.createLabelInputContainer(localizedConstants.DatabaseStateText, this.statusInput));

		// Encryption Enabled
		this.encryptionEnabledInput = this.createCheckbox(localizedConstants.EncryptionEnabledText, async (checked) => {
			this.objectInfo.encryptionEnabled = checked;
		}, this.objectInfo.encryptionEnabled);
		containers.push(this.encryptionEnabledInput);

		// Restrict Access
		if (!isUndefinedOrNull(this.objectInfo.restrictAccess)) {
			this.restrictAccessInput = this.createDropdown(localizedConstants.RestrictAccessText, async (newValue) => {
				this.objectInfo.restrictAccess = newValue;
			}, this.viewInfo.restrictAccessOptions, this.objectInfo.restrictAccess, true);
			containers.push(this.createLabelInputContainer(localizedConstants.RestrictAccessText, this.restrictAccessInput));
		}

		const stateSection = this.createGroup(localizedConstants.StateSectionHeader, containers, true);
		this.optionsTabSectionsContainer.push(stateSection);
	}
	//#endregion

	//#region Database Properties - Data Scoped configurations Tab
	private async initializeDatabaseScopedConfigurationSection(): Promise<void> {
		this.dscOriginalData = deepClone(this.objectInfo.databaseScopedConfigurations);
		const dscNameColumn: azdata.TableColumn = {
			type: azdata.ColumnType.text,
			value: localizedConstants.DatabaseScopedOptionsColumnHeader,
			width: 220
		};
		const primaryValueColumn: azdata.TableColumn = {
			type: azdata.ColumnType.text,
			value: localizedConstants.ValueForPrimaryColumnHeader,
			width: 105
		};
		const secondaryValueColumn: azdata.TableColumn = {
			type: azdata.ColumnType.text,
			value: localizedConstants.ValueForSecondaryColumnHeader,
			width: 105
		};

		this.dscTable = this.modelView.modelBuilder.table().withProps({
			columns: [dscNameColumn, primaryValueColumn, secondaryValueColumn],
			data: this.objectInfo.databaseScopedConfigurations.map(metaData => {
				return [metaData.name,
				metaData.valueForPrimary,
				metaData.valueForSecondary]
			}),
			height: getTableHeight(this.objectInfo.databaseScopedConfigurations.length, 1, 15),
			width: DefaultTableWidth
		}).component();

		const dscPrimaryValueGroup = await this.InitializeDscValueSection();
		const dscMaxDopPrimaryValueGroup = await this.InitilaizeDscMaxDopValueSection();
		const dscPausedResumableIndexPrimaryValueGroup = await this.InitilaizeDscPausedResumableIndexPrimarySection();
		this.dscTabSectionsContainer.push(this.createGroup('', [this.dscTable, dscPrimaryValueGroup, dscMaxDopPrimaryValueGroup, dscPausedResumableIndexPrimaryValueGroup], true));
		this.disposables.push(
			this.dscTable.onRowSelected(
				async (selectedRow) => {
					this.currentRowId = this.dscTable.selectedRows[0];
					await this.validateUpdateToggleDscPrimaryAndSecondaryOptions();
				}
			)
		);
	}

	/**
	 * Validating the selected database scoped configuration and updating the primary and secondary dropdown options and their selected values
	 */
	private async validateUpdateToggleDscPrimaryAndSecondaryOptions(): Promise<void> {
		// Update the primary and secondary dropdown options based on the selected database scoped configuration
		const isSecondaryCheckboxChecked = this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary === this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary;

		// Set all primary and secondary groups to hidden and then show the required group
		await this.dscMaxDopPrimaryValueGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscMaxDopSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscMaxDopSecondaryValueGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscPausedResumableIndexPrimaryValueGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });
		await this.dscSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'hidden' });
		await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		//  Cannot set the 'ELEVATE_ONLINE (11) and ELEVATE_RESUMABLE (12)' option for the secondaries replica while this option is only allowed to be set for the primary
		if (this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 11 || this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 12) {
			await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible' });
			if (JSON.stringify(this.valueForPrimaryInput.values) !== JSON.stringify(this.viewInfo.dscElevateOptions) ||
				this.valueForPrimaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary) {
				await this.valueForPrimaryInput.updateProperties({
					values: this.viewInfo.dscElevateOptions
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
				});
			}
			await this.valueForSecondaryInput.updateProperties({ values: [], value: undefined });
		}
		// MAXDOP (1) option accepts both number and 'OFF' as primary values, and  secondary value accepts only PRIMARY as value
		else if (this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 1) {
			await this.dscMaxDopPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible', 'margin-top': '-175px' });
			await this.dscMaxDopSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'visible', 'margin-top': '-120px' });
			this.setMaxDopSecondaryCheckbox.checked = isSecondaryCheckboxChecked;
			await this.dscMaxDopSecondaryValueGroup.updateCssStyles({ 'visibility': isSecondaryCheckboxChecked ? 'hidden' : 'visible', 'margin-top': '-85px' });
			await this.maxDopPrimaryInput.updateProperties({ value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary });
			await this.maxDopSecondaryInput.updateProperties({ value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary });
		}
		// Cannot set the 'AUTO_ABORT_PAUSED_INDEX (25)' option for the secondaries replica while this option is only allowed to be set for the primary.
		else if (this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 25) {
			await this.dscPausedResumableIndexPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible', 'margin-top': '-345px' });
			await this.pausedResumableIndexPrimaryInput.updateProperties({ value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary });
		}
		// Can only set OFF/Azure blob storage endpoint to the 'LEDGER_DIGEST_STORAGE_ENDPOINT (38)'s primary and secondary values
		else if (this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 38) {
			await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible' });
			await this.dscSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'visible' });
			this.setSecondaryCheckbox.checked = isSecondaryCheckboxChecked;
			await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': isSecondaryCheckboxChecked ? 'hidden' : 'visible' });

			if (JSON.stringify(this.valueForPrimaryInput.values) !== JSON.stringify([this.viewInfo.dscOnOffOptions[1]]) ||
				this.valueForPrimaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary) {
				await this.valueForPrimaryInput.updateProperties({
					values: [this.viewInfo.dscOnOffOptions[1]] // Only OFF is allowed for primary value
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
					, editable: true // This is to allow the user to enter the Azure blob storage endpoint
				});
			}
			if (JSON.stringify(this.valueForSecondaryInput.values) !== JSON.stringify([this.viewInfo.dscOnOffOptions[1]]) ||
				this.valueForSecondaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary) {
				await this.valueForSecondaryInput.updateProperties({
					values: [this.viewInfo.dscOnOffOptions[1]] // Only OFF is allowed for secondary value
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary
					, editable: true // This is to allow the user to enter the Azure blob storage endpoint
				});
			}
		}
		// Cannot set the 'IDENTITY_CACHE (6)' option for the secondaries replica while this option is only allowed to be set for the primary.
		else if (this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 6) {
			await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible' });
			if (JSON.stringify(this.valueForPrimaryInput.values) !== JSON.stringify(this.viewInfo.dscOnOffOptions) ||
				this.valueForPrimaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary) {
				await this.valueForPrimaryInput.updateProperties({
					values: this.viewInfo.dscOnOffOptions
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
				});
			}
			await this.valueForSecondaryInput.updateProperties({ values: [], value: undefined });
		}
		// DW_COMPATIBILITY_LEVEL (26) options accepts 1(Enabled) or 0(Disabled) values as primary and secondary values
		else if (this.objectInfo.databaseScopedConfigurations[this.currentRowId].id === 26) {
			await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible' });
			await this.dscSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'visible' });
			this.setSecondaryCheckbox.checked = isSecondaryCheckboxChecked;
			await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': isSecondaryCheckboxChecked ? 'hidden' : 'visible' });

			if (JSON.stringify(this.valueForPrimaryInput.values) !== JSON.stringify(this.viewInfo.dscEnableDisableOptions) ||
				this.valueForPrimaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary) {
				await this.valueForPrimaryInput.updateProperties({
					values: this.viewInfo.dscEnableDisableOptions
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
				});
			}
			if (JSON.stringify(this.valueForSecondaryInput.values) !== JSON.stringify(this.viewInfo.dscEnableDisableOptions) ||
				this.valueForSecondaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary) {
				await this.valueForSecondaryInput.updateProperties({
					values: this.viewInfo.dscEnableDisableOptions
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary
				});
			}
		}
		// All other options accepts primary and seconday values as ON/OFF/PRIMARY(only secondary)
		else {
			await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'visible' });
			await this.dscSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'visible' });
			this.setSecondaryCheckbox.checked = isSecondaryCheckboxChecked;
			await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': isSecondaryCheckboxChecked ? 'hidden' : 'visible' });

			if (JSON.stringify(this.valueForPrimaryInput.values) !== JSON.stringify(this.viewInfo.dscOnOffOptions) ||
				this.valueForPrimaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary) {
				await this.valueForPrimaryInput.updateProperties({
					values: this.viewInfo.dscOnOffOptions
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
				});
			}
			if (JSON.stringify(this.valueForSecondaryInput.values) !== JSON.stringify(this.viewInfo.dscOnOffOptions) ||
				this.valueForSecondaryInput.value !== this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary) {
				await this.valueForSecondaryInput.updateProperties({
					values: this.viewInfo.dscOnOffOptions
					, value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary
				});
			}
		}
	}

	/**
	 * Initializes MAXDOP primary and secondary input boxes that takes the max limt of a 16bit signed integer - 32767
	 * @returns GroupContainer for MAXDOP primary value
	 */
	private async InitilaizeDscMaxDopValueSection(): Promise<azdata.GroupContainer> {
		// Primary value
		this.maxDopPrimaryInput = this.createInputBox(localizedConstants.ValueForPrimaryColumnHeader, async (newValue) => {
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary = newValue;
			if (this.dscTable.data[this.currentRowId][1] !== newValue) {
				this.dscTable.data[this.currentRowId][1] = newValue;
				await this.updateDscTable(this.dscTable.data);
			}
		}, '', true, 'number', 150, false, 0, 32767);
		const primaryContainer = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.maxDopPrimaryInput);
		this.dscMaxDopPrimaryValueGroup = this.createGroup('', [primaryContainer], false, true);
		await this.dscMaxDopPrimaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Apply Primary To Secondary checkbox
		this.setMaxDopSecondaryCheckbox = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': checked ? 'hidden' : 'visible' });
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = checked
				? this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
				: this.dscOriginalData[this.currentRowId].valueForSecondary;
			await this.maxDopSecondaryInput.updateProperties({ value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary });
		}, true);
		this.dscMaxDopSecondaryCheckboxValueGroup = this.createGroup('', [this.setMaxDopSecondaryCheckbox], false, true);
		await this.dscMaxDopSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Value for Secondary
		this.maxDopSecondaryInput = this.createInputBox(localizedConstants.ValueForSecondaryColumnHeader, async (newValue) => {
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = newValue;
			if (this.dscTable.data[this.currentRowId][2] !== newValue) {
				this.dscTable.data[this.currentRowId][2] = newValue;
				await this.updateDscTable(this.dscTable.data);
			}
		}, '', true, 'number', 150, false, 0, 32767);
		const secondaryContainer = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.maxDopSecondaryInput);
		this.dscMaxDopSecondaryValueGroup = this.createGroup('', [secondaryContainer], false, true);
		await this.dscMaxDopSecondaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		const maxDopGroup = this.createGroup('', [this.dscMaxDopPrimaryValueGroup, this.dscMaxDopSecondaryCheckboxValueGroup, this.dscMaxDopSecondaryValueGroup], false, true);
		await maxDopGroup.updateCssStyles({ 'margin-left': '-10px' });
		return maxDopGroup;
	}

	/**
	 * Initializes PAUSED_RESUMABLE_INDEX_ABORT_DURATION_MINUTES wait time must be greater or equal to 0 and less or equal to 71582
	 * @returns GroupContainer for Paused resumable index abort duration minutes primary value
	 */
	private async InitilaizeDscPausedResumableIndexPrimarySection(): Promise<azdata.GroupContainer> {
		this.pausedResumableIndexPrimaryInput = this.createInputBox(localizedConstants.ValueForPrimaryColumnHeader, async (newValue) => {
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary = newValue;
			if (this.dscTable.data[this.currentRowId][1] !== newValue) {
				this.dscTable.data[this.currentRowId][1] = newValue;
				await this.updateDscTable(this.dscTable.data);
			}
		}, '', true, 'number', 150, false, 0, 71582);
		const primaryContainer = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.pausedResumableIndexPrimaryInput);
		this.dscPausedResumableIndexPrimaryValueGroup = this.createGroup('', [primaryContainer], false, true);
		await this.dscPausedResumableIndexPrimaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });
		return this.dscPausedResumableIndexPrimaryValueGroup;
	}

	/**
	 * Initializes the primary and secondary values for all other database scoped configurations except the MAXDOP and Pause resumable index options
	 * @returns GroupContainer
	 */
	private async InitializeDscValueSection(): Promise<azdata.GroupContainer> {
		// Value for Primary
		this.valueForPrimaryInput = this.createDropdown(localizedConstants.ValueForPrimaryColumnHeader, async (newValue) => {
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary = newValue;
			this.dscTable.data[this.currentRowId][1] = newValue;
			// Update the secondary value with the primary, when the set seconadry checkbox is checked
			if (this.setSecondaryCheckbox.checked
				&& this.objectInfo.databaseScopedConfigurations[this.currentRowId].id !== 6
				&& this.objectInfo.databaseScopedConfigurations[this.currentRowId].id !== 11
				&& this.objectInfo.databaseScopedConfigurations[this.currentRowId].id !== 12) {
				this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = newValue;
				this.dscTable.data[this.currentRowId][2] = newValue;
			}
			await this.updateDscTable(this.dscTable.data);
		}, [], '', true, 150)
		const primaryContainer = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.valueForPrimaryInput);
		this.dscPrimaryValueGroup = this.createGroup('', [primaryContainer], false, true);
		await this.dscPrimaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Apply Primary To Secondary checkbox
		this.setSecondaryCheckbox = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': checked ? 'hidden' : 'visible' });
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = checked
				? this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary
				: this.dscOriginalData[this.currentRowId].valueForSecondary;
			await this.valueForSecondaryInput.updateProperties({ value: this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary });
		}, true);
		this.dscSecondaryCheckboxValueGroup = this.createGroup('', [this.setSecondaryCheckbox], false, true);
		await this.dscSecondaryCheckboxValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Value for Secondary
		this.valueForSecondaryInput = this.createDropdown(localizedConstants.ValueForSecondaryColumnHeader, async (newValue) => {
			if (!isUndefinedOrNull(newValue)) {
				this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = newValue as string;
				this.dscTable.data[this.currentRowId][2] = newValue;
				await this.updateDscTable(this.dscTable.data);
			}
		}, [], '', true, 150);
		const secondaryContainer = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.valueForSecondaryInput);
		this.dscSecondaryValueGroup = this.createGroup('', [secondaryContainer], false, true);
		await this.dscSecondaryValueGroup.updateCssStyles({ 'visibility': 'hidden' });

		const valueGroup = this.createGroup('', [this.dscPrimaryValueGroup, this.dscSecondaryCheckboxValueGroup, this.dscSecondaryValueGroup], true, true);
		await valueGroup.updateCssStyles({ 'margin-left': '-10px' });
		return valueGroup;
	}

	private async updateDscTable(data: any[][]): Promise<void> {
		await this.dscTable.updateProperties({
			'data': data
		});
	}
	// #endregion

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
