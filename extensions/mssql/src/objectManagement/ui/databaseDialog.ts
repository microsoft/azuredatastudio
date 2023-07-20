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
import { Database, DatabaseViewInfo } from '../interfaces';
import { convertNumToTwoDecimalStringInMB } from '../utils';
import { isUndefinedOrNull } from '../../types';

export class DatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// Database Properties tabs
	private generalTab: azdata.Tab;
	private optionsTab: azdata.Tab;
	private dscTab: azdata.Tab;
	private optionsTabSectionsContainer: azdata.Component[] = [];

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
	private valueForPrimaryInput: azdata.DropDownComponent;
	private valueForSecondaryInput: azdata.DropDownComponent;
	private valuesContainerGroup: azdata.GroupContainer;
	private setSecondaryCheckbox: azdata.CheckBoxComponent;
	private currentRowId: number;
	private isValueDefaultAvailable: boolean;

	private activeTabId: string;

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
		}, this.viewInfo.collationNames, this.objectInfo.collationName);
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
		this.isValueDefaultAvailable = this.objectInfo.databaseScopedConfigurations.length > 0 && !isUndefinedOrNull(this.objectInfo.databaseScopedConfigurations[0].isDefaultValue)
		const dscNameColumn: azdata.TableColumn = {
			type: azdata.ColumnType.text,
			value: localizedConstants.DatabaseScopedOptionsColumnHeader,
			width: this.isValueDefaultAvailable ? 169 : 200
		};
		const isValueDefaultColumn: azdata.TableColumn = {
			type: azdata.ColumnType.checkBox,
			value: localizedConstants.IsDefaultValueColumnHeader,
			width: 84
		};
		const primaryValueColumn: azdata.TableColumn = {
			type: azdata.ColumnType.text,
			value: localizedConstants.ValueForPrimaryColumnHeader,
			width: this.isValueDefaultAvailable ? 92 : 125
		};
		const secondaryValueColumn: azdata.TableColumn = {
			type: azdata.ColumnType.text,
			value: localizedConstants.ValueForSecondaryColumnHeader,
			width: this.isValueDefaultAvailable ? 106 : 125
		};

		// isDefaultValue property is not supported for all the database scoped configurations in case of SQL Server 2016 and below
		const dscTableColumns: azdata.TableColumn[] = this.isValueDefaultAvailable
			? [dscNameColumn, isValueDefaultColumn, primaryValueColumn, secondaryValueColumn]
			: [dscNameColumn, primaryValueColumn, secondaryValueColumn];

		this.dscTable = this.modelView.modelBuilder.table().withProps({
			columns: dscTableColumns,
			data: this.objectInfo.databaseScopedConfigurations.map(metaData => {
				return this.isValueDefaultAvailable
					? [metaData.name, metaData.isDefaultValue, metaData.valueForPrimary, metaData.valueForSecondary]
					: [metaData.name, metaData.valueForPrimary, metaData.valueForSecondary]
			}),
			height: getTableHeight(this.objectInfo.databaseScopedConfigurations.length, 1, 15),
			width: DefaultTableWidth + 10
		}).component();

		this.dscTabSectionsContainer.push(this.createGroup('', [this.dscTable, await this.updateValuesSectionGroup()], true));
		this.disposables.push(
			this.dscTable.onRowSelected(
				async (selectedRow) => {
					await this.valuesContainerGroup.updateCssStyles({ 'visibility': 'visible' });
					this.currentRowId = this.dscTable.selectedRows[0];
					const row = this.dscTable.data[this.dscTable.selectedRows[0]];

					// Update the values of primary and secondary dropdown based on the selected database scoped configuration
					this.valueForPrimaryInput.value = this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary;
					this.valueForSecondaryInput.value = this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary;
					this.setSecondaryCheckbox.checked = this.objectInfo.databaseScopedConfigurations[this.currentRowId].applyPrimaryToSecondary;

					// Update the primary and secondary dropdown options based on the selected database scoped configuration
					if (row[0] === localizedConstants.ELEVATE_ONLINE_DSC_OptionText || row[0] === localizedConstants.ELEVATE_RESUMABLE_DSC_OptionText) {
						this.valueForPrimaryInput.values = this.viewInfo.dscElevateOptions;
						this.valueForSecondaryInput.values = [];
					} else if (row[0] === localizedConstants.MAXDOP) {
						this.valueForSecondaryInput.values = [this.viewInfo.dscOnOffPrimaryOptions[2]];
					} else if (row[0] === localizedConstants.IDENTITY_CACHE) {
						this.valueForPrimaryInput.values = this.viewInfo.dscOnOffOptions;
						this.valueForSecondaryInput.values = [];
					} else {
						this.valueForPrimaryInput.values = this.viewInfo.dscOnOffOptions;
						this.valueForSecondaryInput.values = this.viewInfo.dscOnOffPrimaryOptions;
					}
				}
			)
		);
	}

	private async updateValuesSectionGroup(): Promise<azdata.GroupContainer> {
		// Value for Primary
		this.valueForPrimaryInput = this.createDropdown(localizedConstants.ValueForPrimaryColumnHeader, async (newValue) => {
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForPrimary = newValue as string;
			this.dscTable.data[this.currentRowId][this.isValueDefaultAvailable ? 2 : 1] = newValue;
			await this.updateDscTable(this.dscTable.data);
		}, [], '', true, 150)
		const primaryContainer = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.valueForPrimaryInput);

		// Apply Primary To Secondary checkbox
		this.setSecondaryCheckbox = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			// Disable secondary dropdown and apply PRIMARY value as selected value
			this.valueForSecondaryInput.enabled = !checked;
			this.valueForSecondaryInput.value = this.viewInfo.dscOnOffPrimaryOptions[2];
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = this.viewInfo.dscOnOffPrimaryOptions[2];
			this.objectInfo.databaseScopedConfigurations[this.currentRowId].applyPrimaryToSecondary = checked;
			await this.updateDscTable(this.dscTable.data);
		}, false);
		const applyPrimaryToSecondaryContainer = this.createLabelInputContainer(localizedConstants.SetSecondaryText, this.setSecondaryCheckbox);

		// Value for Secondary
		this.valueForSecondaryInput = this.createDropdown(localizedConstants.ValueForSecondaryColumnHeader, async (newValue) => {
			if (!isUndefinedOrNull(newValue)) {
				this.objectInfo.databaseScopedConfigurations[this.currentRowId].valueForSecondary = newValue as string;
				this.dscTable.data[this.currentRowId][this.isValueDefaultAvailable ? 3 : 2] = newValue;
				await this.updateDscTable(this.dscTable.data);
			}
		}, [], '', true, 150);
		const secondaryContainer = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.valueForSecondaryInput);

		this.valuesContainerGroup = this.createGroup('', [primaryContainer, applyPrimaryToSecondaryContainer, secondaryContainer], true, true);
		await this.valuesContainerGroup.updateCssStyles({ 'visibility': 'hidden' });

		return this.valuesContainerGroup;
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
