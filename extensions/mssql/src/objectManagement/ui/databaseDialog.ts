/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth, DefaultTableWidth, DefaultMinTableRowCount, DefaultMaxTableRowCount, getTableHeight, DialogButton } from '../../ui/dialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { CreateDatabaseDocUrl, DatabaseGeneralPropertiesDocUrl, DatabaseFilesPropertiesDocUrl, DatabaseOptionsPropertiesDocUrl, DatabaseScopedConfigurationPropertiesDocUrl } from '../constants';
import { Database, DatabaseFile, DatabaseScopedConfigurationsInfo, DatabaseViewInfo, FileGrowthType } from '../interfaces';
import { convertNumToTwoDecimalStringInMB } from '../utils';
import { isUndefinedOrNull } from '../../types';
import { deepClone } from '../../util/objects';
import { DatabaseFileDialog } from './databaseFileDialog';

const MAXDOP_Max_Limit = 32767;
const PAUSED_RESUMABLE_INDEX_Max_Limit = 71582;
const DscTableRowLength = 15;

export class DatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// Database Properties tabs
	private generalTab: azdata.Tab;
	private filesTab: azdata.Tab;
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
	// Files Tab
	private readonly filesTabId: string = 'filesDatabaseId';
	private databaseFilesTable: azdata.TableComponent;
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
	private valueForPrimaryDropdown: azdata.DropDownComponent;
	private valueForSecondaryDropdown: azdata.DropDownComponent;
	private setSecondaryCheckboxForDropdowns: azdata.CheckBoxComponent;
	private valueForPrimaryInput: azdata.InputBoxComponent;
	private valueForSecondaryInput: azdata.InputBoxComponent;
	private setSecondaryCheckboxForInputType: azdata.CheckBoxComponent;
	private dscPrimaryValueDropdownGroup: azdata.GroupContainer;
	private dscSecondaryValueDropdownGroup: azdata.GroupContainer;
	private dscSecondaryCheckboxForDropdownGroup: azdata.GroupContainer;
	private dscPrimaryValueInputGroup: azdata.GroupContainer;
	private dscSecondaryValueInputGroup: azdata.GroupContainer;
	private dscSecondaryCheckboxForInputGroup: azdata.GroupContainer;
	private setFocusToInput: azdata.InputBoxComponent = undefined;
	private currentRowObjectInfo: DatabaseScopedConfigurationsInfo;

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
			case this.filesTabId:
				helpUrl = DatabaseFilesPropertiesDocUrl;
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
			// Initialize general Tab sections
			this.initializeBackupSection();
			this.initializeDatabaseSection();

			//Initialize options Tab sections
			this.initializeOptionsGeneralSection();
			this.initializeAutomaticSection();
			if (!isUndefinedOrNull(this.objectInfo.isLedgerDatabase)) {
				this.initializeLedgerSection();
			}
			if (!isUndefinedOrNull(this.objectInfo.pageVerify) && !isUndefinedOrNull(this.objectInfo.targetRecoveryTimeInSec)) {
				this.initializeRecoverySection();
			}
			this.initializeStateSection();


			const tabs: azdata.Tab[] = [];
			// Initialize general Tab
			this.generalTab = {
				title: localizedConstants.GeneralSectionHeader,
				id: this.generalTabId,
				content: this.createGroup('', [
					this.databaseSection,
					this.backupSection
				], false)
			};
			tabs.push(this.generalTab);

			// Initialize Files Tab
			// Files tab is only enabled for SQL Server properties view
			if (!isUndefinedOrNull(this.objectInfo.isFilesTabSupported)) {
				const filesGeneralSection = this.initializeFilesGeneralSection();
				const databaseFilesSection = this.initializeDatabaseFilesSection();
				this.filesTab = {
					title: localizedConstants.FilesSectionHeader,
					id: this.filesTabId,
					content: this.createGroup('', [filesGeneralSection, databaseFilesSection], false)
				};
				tabs.push(this.filesTab);
			}

			// Initialize Options Tab
			this.optionsTab = {
				title: localizedConstants.OptionsSectionHeader,
				id: this.optionsTabId,
				content: this.createGroup('', this.optionsTabSectionsContainer, false)
			};
			tabs.push(this.optionsTab);

			// Initialize DSC Tab section
			if (!isUndefinedOrNull(this.objectInfo.databaseScopedConfigurations)) {
				await this.initializeDatabaseScopedConfigurationSection();
				this.dscTabSectionsContainer.push(await this.initializeDscValueDropdownTypeSection())
				this.dscTabSectionsContainer.push(await this.initializeDscValueInputTypeSection())
				this.dscTab = {
					title: localizedConstants.DatabaseScopedConfigurationTabHeader,
					id: this.dscTabId,
					content: this.createGroup('', this.dscTabSectionsContainer, false)
				}
				tabs.push(this.dscTab);
			}

			// Initialize tab group with tabbed panel
			const propertiesTabGroup = { title: '', tabs: tabs };
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
		let collationNames = this.viewInfo.collationNames?.options;
		if (collationNames?.length > 0 && !collationNames.some(name => name.toLowerCase() === this.objectInfo.collationName?.toLowerCase())) {
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

		this.nameInput = this.createInputBox(async () => {
			this.objectInfo.name = this.nameInput.value;
		}, props);
		containers.push(this.createLabelInputContainer(localizedConstants.NameText, this.nameInput));

		let loginNames = this.viewInfo.loginNames?.options;
		if (loginNames?.length > 0) {
			let defaultIndex = this.viewInfo.loginNames.defaultValueIndex;
			this.objectInfo.owner = loginNames[defaultIndex];
			let ownerDropbox = this.createDropdown(localizedConstants.OwnerText, async () => {
				this.objectInfo.owner = ownerDropbox.value as string;
			}, loginNames, loginNames[defaultIndex]);
			containers.push(this.createLabelInputContainer(localizedConstants.OwnerText, ownerDropbox));
		}

		return this.createGroup(localizedConstants.GeneralSectionHeader, containers, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		let collationNames = this.viewInfo.collationNames?.options;
		if (collationNames?.length > 0) {
			let defaultIndex = this.viewInfo.collationNames.defaultValueIndex;
			this.objectInfo.collationName = collationNames[defaultIndex];
			let collationDropbox = this.createDropdown(localizedConstants.CollationText, async () => {
				this.objectInfo.collationName = collationDropbox.value as string;
			}, collationNames, collationNames[defaultIndex], true, DefaultInputWidth, true, true);
			containers.push(this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox));
		}

		let recoveryModels = this.viewInfo.recoveryModels?.options;
		if (recoveryModels?.length > 0) {
			let defaultIndex = this.viewInfo.recoveryModels.defaultValueIndex;
			this.objectInfo.recoveryModel = recoveryModels[defaultIndex];
			let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, async () => {
				this.objectInfo.recoveryModel = recoveryDropbox.value as string;
			}, recoveryModels, recoveryModels[defaultIndex]);
			containers.push(this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox));
		}

		let compatibilityLevels = this.viewInfo.compatibilityLevels?.options;
		if (compatibilityLevels?.length > 0) {
			let defaultIndex = this.viewInfo.compatibilityLevels.defaultValueIndex;
			this.objectInfo.compatibilityLevel = compatibilityLevels[defaultIndex];
			let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, async () => {
				this.objectInfo.compatibilityLevel = compatibilityDropbox.value as string;
			}, compatibilityLevels, compatibilityLevels[defaultIndex]);
			containers.push(this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox));
		}

		let containmentTypes = this.viewInfo.containmentTypes?.options;
		if (containmentTypes?.length > 0) {
			let defaultIndex = this.viewInfo.containmentTypes.defaultValueIndex;
			this.objectInfo.containmentType = containmentTypes[defaultIndex];
			let containmentDropbox = this.createDropdown(localizedConstants.ContainmentTypeText, async () => {
				this.objectInfo.containmentType = containmentDropbox.value as string;
			}, containmentTypes, containmentTypes[defaultIndex]);
			containers.push(this.createLabelInputContainer(localizedConstants.ContainmentTypeText, containmentDropbox));
		}

		return this.createGroup(localizedConstants.OptionsSectionHeader, containers, true, true);
	}
	//#endregion

	//#region Database Properties - General Tab
	private initializeBackupSection(): void {
		// Last Database Backup
		this.lastDatabaseBackupInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.LastDatabaseBackupText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.lastDatabaseBackup
		});
		const lastDatabaseBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseBackupText, this.lastDatabaseBackupInput);

		// Last Database Log Backup
		this.lastDatabaseLogBackupInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.LastDatabaseLogBackupText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.lastDatabaseLogBackup
		});
		const lastDatabaseLogBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseLogBackupText, this.lastDatabaseLogBackupInput);

		this.backupSection = this.createGroup(localizedConstants.BackupSectionHeader, [
			lastDatabaseBackupContainer,
			lastDatabaseLogBackupContainer
		], true);
	}

	private initializeDatabaseSection(): void {
		// Database Name
		this.nameInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.NamePropertyText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name
		});
		const nameContainer = this.createLabelInputContainer(localizedConstants.NamePropertyText, this.nameInput);

		// Database Status
		this.statusInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.StatusText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.status
		});
		const statusContainer = this.createLabelInputContainer(localizedConstants.StatusText, this.statusInput);

		// Database Owner
		this.ownerInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.OwnerPropertyText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.owner
		});
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerPropertyText, this.ownerInput);

		// Created Date
		this.dateCreatedInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.DateCreatedText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.dateCreated
		});
		const dateCreatedContainer = this.createLabelInputContainer(localizedConstants.DateCreatedText, this.dateCreatedInput);

		// Size
		this.sizeInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.SizeText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: convertNumToTwoDecimalStringInMB(this.objectInfo.sizeInMb)
		});
		const sizeContainer = this.createLabelInputContainer(localizedConstants.SizeText, this.sizeInput);

		// Space Available
		this.spaceAvailabeInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.SpaceAvailableText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: convertNumToTwoDecimalStringInMB(this.objectInfo.spaceAvailableInMb)
		});
		const spaceAvailabeContainer = this.createLabelInputContainer(localizedConstants.SpaceAvailableText, this.spaceAvailabeInput);

		// Number of Users
		this.numberOfUsersInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.NumberOfUsersText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.numberOfUsers.toString()
		});
		const numberOfUsersContainer = this.createLabelInputContainer(localizedConstants.NumberOfUsersText, this.numberOfUsersInput);

		// Memory Allocated To Memory Optimized Objects
		this.memoryAllocatedInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.MemoryAllocatedText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: convertNumToTwoDecimalStringInMB(this.objectInfo.memoryAllocatedToMemoryOptimizedObjectsInMb)
		});
		const memoryAllocatedContainer = this.createLabelInputContainer(localizedConstants.MemoryAllocatedText, this.memoryAllocatedInput);

		// Memory Used By Memory Optimized Objects
		this.memoryUsedInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.MemoryUsedText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: convertNumToTwoDecimalStringInMB(this.objectInfo.memoryUsedByMemoryOptimizedObjectsInMb)
		});
		const memoryUsedContainer = this.createLabelInputContainer(localizedConstants.MemoryUsedText, this.memoryUsedInput);

		// Collation
		this.collationInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.CollationText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.collationName
		});
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

	//#region Database Properties - Files Tab
	private initializeFilesGeneralSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Database name
		this.nameInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.DatabaseNameText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name
		});
		containers.push(this.createLabelInputContainer(localizedConstants.DatabaseNameText, this.nameInput));

		// Owner
		let loginNames = this.viewInfo.loginNames?.options;

		if (loginNames?.length > 0) {
			// Removing <default> login name from the list and adding current owner if not exists
			if (!this.viewInfo.loginNames?.options.find(owner => owner === this.objectInfo.owner)) {
				loginNames[0] = this.objectInfo.owner;
			} else {
				loginNames.splice(0, 1);
			}
			let ownerDropbox = this.createDropdown(localizedConstants.OwnerText, async () => {
				this.objectInfo.owner = ownerDropbox.value as string;
			}, loginNames, this.objectInfo.owner);
			containers.push(this.createLabelInputContainer(localizedConstants.OwnerText, ownerDropbox));
		}
		return this.createGroup('', containers, false);
	}

	private initializeDatabaseFilesSection(): azdata.GroupContainer {
		this.databaseFilesTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.text,
				value: localizedConstants.LogicalNameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FileTypeText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FilegroupText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.SizeInMbText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.AutogrowthMaxsizeText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.PathText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FileNameText
			}],
			data: this.objectInfo.files?.map(file => {
				return this.convertToDataView(file);

			}),
			height: getTableHeight(this.objectInfo.files?.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: DefaultTableWidth,
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();
		const addButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.AddButton,
			buttonHandler: (button) => this.onAddDatabaseFilesButtonClicked(button)
		};
		const removeButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.RemoveButton,
			buttonHandler: () => this.onRemoveDatabaseFilesButtonClicked()
		};
		const editbuttonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.EditButton,
			buttonHandler: (button) => this.onEditDatabaseFilesButtonClicked(button)
		};
		const databaseFilesButtonContainer = this.addButtonsForTable(this.databaseFilesTable, addButtonComponent, removeButtonComponent, editbuttonComponent);

		return this.createGroup(localizedConstants.DatabaseFilesText, [this.databaseFilesTable, databaseFilesButtonContainer], true);
	}

	/**
	 * Converts the file object to a data view object
	 * @param file database file object
	 * @returns data view object
	 */
	private convertToDataView(file: DatabaseFile): any[] {
		return [
			file.name,
			file.type,
			file.fileGroup,
			file.sizeInMb,
			file.isAutoGrowthEnabled ? localizedConstants.AutoGrowthValueStringGenerator(file.type !== localizedConstants.FilestreamFileType
				, file.autoFileGrowth.toString()
				, file.autoFileGrowthType === FileGrowthType.Percent
				, file.maxSizeLimitInMb) : localizedConstants.NoneText,
			file.path,
			file.fileNameWithExtension
		];
	}

	private async onAddDatabaseFilesButtonClicked(button: azdata.ButtonComponent): Promise<void> {
		// Open file dialog to create file
		const result = await this.openDatabaseFileDialog(button);
		if (!isUndefinedOrNull(result)) {
			this.objectInfo.files?.push(result);
			var newData = this.objectInfo.files?.map(file => {
				return this.convertToDataView(file);
			});
			await this.setTableData(this.databaseFilesTable, newData, DefaultMaxTableRowCount)
		}
	}

	private async onEditDatabaseFilesButtonClicked(button: azdata.ButtonComponent): Promise<void> {
		if (this.databaseFilesTable.selectedRows.length === 1) {
			const result = await this.openDatabaseFileDialog(button);
			if (!isUndefinedOrNull(result)) {
				this.objectInfo.files[this.databaseFilesTable.selectedRows[0]] = result;
				var newData = this.objectInfo.files?.map(file => {
					return this.convertToDataView(file);
				});
				await this.setTableData(this.databaseFilesTable, newData, DefaultMaxTableRowCount)
			}
		}
	}

	/**
	 * Removes the selected database file from the table
	 */
	private async onRemoveDatabaseFilesButtonClicked(): Promise<void> {
		if (this.databaseFilesTable.selectedRows.length === 1) {
			this.objectInfo.files?.splice(this.databaseFilesTable.selectedRows[0], 1);
			var newData = this.objectInfo.files?.map(file => {
				return this.convertToDataView(file);
			});
			await this.setTableData(this.databaseFilesTable, newData, DefaultMaxTableRowCount)
		}
	}

	/**
	 * Validate the selected row to enable/disable the remove button
	 * @returns true if the remove button should be enabled, false otherwise
	 */
	protected override get removeButtonEnabled(): boolean {
		let isEnabled = true;
		if (this.databaseFilesTable.selectedRows !== undefined) {
			const selectedRowId = this.objectInfo.files[this.databaseFilesTable.selectedRows[0]].id;
			// Cannot delete a Primary row data file, Id is always 1.
			if (this.databaseFilesTable.selectedRows.length === 1 && selectedRowId === 1) {
				isEnabled = false;
			}
			// Cannot remove a log file if there are no other log files, LogFiletype is always a Log file type
			else if (this.objectInfo.files[this.databaseFilesTable.selectedRows[0]].type === localizedConstants.LogFiletype) {
				isEnabled = false;
				this.objectInfo.files.forEach(file => {
					if (file.id !== selectedRowId && file.type === localizedConstants.LogFiletype) {
						isEnabled = true;
					}
				});
			}
		}
		return isEnabled;
	}

	private async openDatabaseFileDialog(button: azdata.ButtonComponent): Promise<DatabaseFile> {
		const defaultFileSizeInMb: number = 8
		const defaultFileGrowthInMb: number = 64
		const defaultFileGrowthInPercent: number = 10;
		const defaultMaxFileSizeLimitedToInMb: number = 100;
		const selectedFile = this.databaseFilesTable.selectedRows !== undefined ? this.objectInfo.files[this.databaseFilesTable?.selectedRows[0]] : undefined;
		if (!isUndefinedOrNull(selectedFile) && selectedFile.type === localizedConstants.FilestreamFileType) {
			selectedFile.autoFileGrowth = defaultFileGrowthInMb;
		}
		const isNewFile: boolean = button.ariaLabel === localizedConstants.AddButton;
		const isEditingNewFile: boolean = button.ariaLabel === localizedConstants.EditButton && selectedFile.id === undefined;
		const databaseFile: DatabaseFile = isNewFile ? {
			id: undefined,
			name: '',
			type: localizedConstants.RowsDataFileType,
			path: this.objectInfo.files[0].path,
			fileGroup: this.viewInfo.rowDataFileGroupsOptions[0],
			fileNameWithExtension: '',
			sizeInMb: defaultFileSizeInMb,
			isAutoGrowthEnabled: true,
			autoFileGrowth: defaultFileGrowthInMb,
			autoFileGrowthType: FileGrowthType.KB,
			maxSizeLimitInMb: defaultMaxFileSizeLimitedToInMb
		} : selectedFile;

		const dialog = new DatabaseFileDialog({
			title: (isNewFile || isEditingNewFile) ? localizedConstants.AddDatabaseFilesText : localizedConstants.EditDatabaseFilesText(databaseFile.name),
			viewInfo: this.viewInfo,
			files: this.objectInfo.files,
			isNewFile: isNewFile,
			isEditingNewFile: isEditingNewFile,
			databaseFile: databaseFile,
			defaultFileConstants: {
				defaultFileSizeInMb: defaultFileSizeInMb,
				defaultFileGrowthInMb: defaultFileGrowthInMb,
				defaultFileGrowthInPercent: defaultFileGrowthInPercent,
				defaultMaxFileSizeLimitedToInMb: defaultMaxFileSizeLimitedToInMb
			}
		});
		await dialog.open();
		return await dialog.waitForClose();
	}

	//#endregion

	//#region Database Properties - Options Tab
	private initializeOptionsGeneralSection(): void {
		let containers: azdata.Component[] = [];

		// Collation
		let collationNames = this.viewInfo.collationNames.options;
		let collationDropbox = this.createDropdown(localizedConstants.CollationText, async (newValue) => {
			this.objectInfo.collationName = newValue as string;
		}, collationNames, this.objectInfo.collationName, true, DefaultInputWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox));

		// Recovery Model
		let recoveryModels = this.viewInfo.recoveryModels.options;
		let displayOptionsArray = recoveryModels.length === 0 ? [this.objectInfo.recoveryModel] : recoveryModels;
		let isEnabled = recoveryModels.length === 0 ? false : true;
		let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, async (newValue) => {
			this.objectInfo.recoveryModel = newValue as string;
		}, displayOptionsArray, this.objectInfo.recoveryModel, isEnabled);
		containers.push(this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox));

		// Compatibility Level
		let compatibilityLevels = this.viewInfo.compatibilityLevels.options;
		let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, async (newValue) => {
			this.objectInfo.compatibilityLevel = newValue as string;
		}, compatibilityLevels, this.objectInfo.compatibilityLevel);
		containers.push(this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox));

		// Containment Type
		let containmentTypes = this.viewInfo.containmentTypes.options;
		displayOptionsArray = containmentTypes.length === 0 ? [this.objectInfo.containmentType] : containmentTypes;
		isEnabled = containmentTypes.length === 0 ? false : true;
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

		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.TargetRecoveryTimeInSecondsText,
			inputType: 'number',
			enabled: true,
			min: 0
		};
		// Recovery Time In Seconds
		this.targetRecoveryTimeInSecInput = this.createInputBox(async (newValue) => {
			this.objectInfo.targetRecoveryTimeInSec = Number(newValue);
		}, props);
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
		this.statusInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.StatusText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.status
		});
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
			height: getTableHeight(this.objectInfo.databaseScopedConfigurations.length, 1, DscTableRowLength),
			width: DefaultTableWidth
		}).component();

		this.dscTabSectionsContainer.push(this.createGroup('', [this.dscTable], true));
		this.disposables.push(
			this.dscTable.onRowSelected(
				async () => {
					// When refreshing the data on primary/secondary updates, we dont need to validate/toggle inputs again
					if (this.currentRowId !== this.dscTable.selectedRows[0]) {
						this.currentRowId = this.dscTable.selectedRows[0];
						await this.validateUpdateToggleDscPrimaryAndSecondaryOptions();
					}

					// This sets the focus to the primary/secondary inputs on data refresh
					if (!isUndefinedOrNull(this.setFocusToInput)) {
						await this.setFocusToInput.focus();
					}
				}
			)
		);
	}

	/**
	 * Validating the selected database scoped configuration and updating the primary and secondary dropdown options and their selected values
	 */
	private async validateUpdateToggleDscPrimaryAndSecondaryOptions(): Promise<void> {
		// Update the primary and secondary dropdown options based on the selected database scoped configuration
		this.currentRowObjectInfo = this.objectInfo.databaseScopedConfigurations[this.currentRowId];
		const isSecondaryCheckboxChecked = this.currentRowObjectInfo.valueForPrimary === this.currentRowObjectInfo.valueForSecondary;
		await this.hideDropdownAndInputSections();

		//  Cannot set the 'ELEVATE_ONLINE (11) and ELEVATE_RESUMABLE (12)' option for the secondaries replica while this option is only allowed to be set for the primary
		if (this.currentRowObjectInfo.id === 11 || this.currentRowObjectInfo.id === 12) {
			await this.dscPrimaryValueDropdownGroup.updateCssStyles({ 'visibility': 'visible' });
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify(this.viewInfo.dscElevateOptions) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: this.viewInfo.dscElevateOptions
					, value: this.currentRowObjectInfo.valueForPrimary
				});
			}
		}
		// MAXDOP (1) option accepts both number and 'OFF' as primary values, and  secondary value accepts only PRIMARY as value
		else if (this.currentRowObjectInfo.id === 1) {
			await this.showInputSection(isSecondaryCheckboxChecked);
			await this.valueForPrimaryInput.updateProperties({
				value: this.currentRowObjectInfo.valueForPrimary
				, max: MAXDOP_Max_Limit
			});
			await this.valueForSecondaryInput.updateProperties({
				value: this.currentRowObjectInfo.valueForSecondary
				, max: MAXDOP_Max_Limit
			});
		}
		// Cannot set the 'AUTO_ABORT_PAUSED_INDEX (25)' option for the secondaries replica while this option is only allowed to be set for the primary.
		else if (this.currentRowObjectInfo.id === 25) {
			await this.dscPrimaryValueInputGroup.updateCssStyles({ 'visibility': 'visible', 'margin-top': '-175px' });
			await this.valueForPrimaryInput.updateProperties({
				value: this.currentRowObjectInfo.valueForPrimary
				, max: PAUSED_RESUMABLE_INDEX_Max_Limit
			});
		}
		// Can only set OFF/Azure blob storage endpoint to the 'LEDGER_DIGEST_STORAGE_ENDPOINT (38)'s primary and secondary values
		else if (this.currentRowObjectInfo.id === 38) {
			await this.showDropdownsSection(isSecondaryCheckboxChecked);
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify([this.viewInfo.dscOnOffOptions[1]]) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: [this.viewInfo.dscOnOffOptions[1]] // Only OFF is allowed for primary value
					, value: this.currentRowObjectInfo.valueForPrimary
					, editable: true // This is to allow the user to enter the Azure blob storage endpoint
				});
			}
			if (JSON.stringify(this.valueForSecondaryDropdown.values) !== JSON.stringify([this.viewInfo.dscOnOffOptions[1]]) ||
				this.valueForSecondaryDropdown.value !== this.currentRowObjectInfo.valueForSecondary) {
				await this.valueForSecondaryDropdown.updateProperties({
					values: [this.viewInfo.dscOnOffOptions[1]] // Only OFF is allowed for secondary value
					, value: this.currentRowObjectInfo.valueForSecondary
					, editable: true // This is to allow the user to enter the Azure blob storage endpoint
				});
			}
		}
		// Cannot set the 'IDENTITY_CACHE (6)' option for the secondaries replica while this option is only allowed to be set for the primary.
		// Cannot set the 'GLOBAL_TEMPORARY_TABLE_AUTO_DROP (21)' option for the secondaries replica while this option is only allowed to be set for the primary.
		else if (this.currentRowObjectInfo.id === 6 || this.currentRowObjectInfo.id === 21) {
			await this.dscPrimaryValueDropdownGroup.updateCssStyles({ 'visibility': 'visible' });
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify(this.viewInfo.dscOnOffOptions) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: this.viewInfo.dscOnOffOptions
					, value: this.currentRowObjectInfo.valueForPrimary
				});
			}
		}
		// DW_COMPATIBILITY_LEVEL (26) options accepts 1(Enabled) or 0(Disabled) values as primary and secondary values
		else if (this.currentRowObjectInfo.id === 26) {
			await this.showDropdownsSection(isSecondaryCheckboxChecked);
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify(this.viewInfo.dscEnableDisableOptions) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: this.viewInfo.dscEnableDisableOptions
					, value: this.currentRowObjectInfo.valueForPrimary
				});
			}
			if (JSON.stringify(this.valueForSecondaryDropdown.values) !== JSON.stringify(this.viewInfo.dscEnableDisableOptions) ||
				this.valueForSecondaryDropdown.value !== this.currentRowObjectInfo.valueForSecondary) {
				await this.valueForSecondaryDropdown.updateProperties({
					values: this.viewInfo.dscEnableDisableOptions
					, value: this.currentRowObjectInfo.valueForSecondary
				});
			}
		}
		// All other options accepts primary and seconday values as ON/OFF/PRIMARY(only secondary)
		else {
			await this.showDropdownsSection(isSecondaryCheckboxChecked);
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify(this.viewInfo.dscOnOffOptions) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: this.viewInfo.dscOnOffOptions
					, value: this.currentRowObjectInfo.valueForPrimary
				});
			}
			if (JSON.stringify(this.valueForSecondaryDropdown.values) !== JSON.stringify(this.viewInfo.dscOnOffOptions) ||
				this.valueForSecondaryDropdown.value !== this.currentRowObjectInfo.valueForSecondary) {
				await this.valueForSecondaryDropdown.updateProperties({
					values: this.viewInfo.dscOnOffOptions
					, value: this.currentRowObjectInfo.valueForSecondary
				});
			}
		}
	}

	/**
	 * Initializes primary and secondary values of Input type
	 * @returns GroupContainer for primary value and secondary value
	 */
	private async initializeDscValueInputTypeSection(): Promise<azdata.GroupContainer> {
		// Primary value
		this.valueForPrimaryInput = this.createInputBox(async (newValue) => {
			if (this.currentRowObjectInfo.valueForPrimary !== newValue) {
				this.currentRowObjectInfo.valueForPrimary = newValue;
				if (this.dscTable.data[this.currentRowId][1] !== newValue) {
					this.dscTable.data[this.currentRowId][1] = newValue;
				}
				// Update the secondary value with the primary, when the set seconadry checkbox is checked
				if (this.setSecondaryCheckboxForInputType.checked && this.currentRowObjectInfo.id !== 25) {
					this.currentRowObjectInfo.valueForSecondary = newValue;
					this.dscTable.data[this.currentRowId][2] = newValue;
				}
				await this.updateDscTable(this.dscTable.data, this.valueForPrimaryInput);
			}
		}, {
			ariaLabel: localizedConstants.ValueForPrimaryColumnHeader,
			inputType: 'number',
			enabled: true,
			value: '',
			width: 150,
			min: 0
		});
		const primaryContainer = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.valueForPrimaryInput);
		this.dscPrimaryValueInputGroup = this.createGroup('', [primaryContainer], false, true);
		await this.dscPrimaryValueInputGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Apply Primary To Secondary checkbox
		this.setSecondaryCheckboxForInputType = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			await this.dscSecondaryValueInputGroup.updateCssStyles({ 'visibility': checked ? 'hidden' : 'visible' });
			this.currentRowObjectInfo.valueForSecondary = checked ? this.currentRowObjectInfo.valueForPrimary : this.dscOriginalData[this.currentRowId].valueForSecondary;
			await this.valueForSecondaryInput.updateProperties({ value: this.currentRowObjectInfo.valueForSecondary });
			if (this.dscTable.data[this.currentRowId][2] !== this.currentRowObjectInfo.valueForSecondary) {
				this.dscTable.data[this.currentRowId][2] = this.currentRowObjectInfo.valueForSecondary;
				await this.updateDscTable(this.dscTable.data);
			}
		}, true);
		this.dscSecondaryCheckboxForInputGroup = this.createGroup('', [this.setSecondaryCheckboxForInputType], false, true);
		await this.dscSecondaryCheckboxForInputGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Value for Secondary
		this.valueForSecondaryInput = this.createInputBox(async (newValue) => {
			this.currentRowObjectInfo.valueForSecondary = newValue;
			if (this.dscTable.data[this.currentRowId][2] !== newValue) {
				this.dscTable.data[this.currentRowId][2] = newValue;
				await this.updateDscTable(this.dscTable.data, this.valueForSecondaryInput);
			}
		}, {
			ariaLabel: localizedConstants.ValueForSecondaryColumnHeader,
			inputType: 'number',
			enabled: true,
			value: '',
			width: 150,
			min: 0
		});
		const secondaryContainer = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.valueForSecondaryInput);
		this.dscSecondaryValueInputGroup = this.createGroup('', [secondaryContainer], false, true);
		await this.dscSecondaryValueInputGroup.updateCssStyles({ 'visibility': 'hidden' });

		const maxDopGroup = this.createGroup('', [this.dscPrimaryValueInputGroup, this.dscSecondaryCheckboxForInputGroup, this.dscSecondaryValueInputGroup], false, true);
		await maxDopGroup.updateCssStyles({ 'margin-left': '-10px' });
		return maxDopGroup;
	}

	/**
	 * Initializes primary and secondary values of Dropdown type
	 * @returns GroupContainer of primary and secondary values
	 */
	private async initializeDscValueDropdownTypeSection(): Promise<azdata.GroupContainer> {
		// Configurations that won't support secondary value update
		const dscConfigurationsWithoutSecondaryValue = [6, 11, 12, 21];
		// Value for Primary
		this.valueForPrimaryDropdown = this.createDropdown(localizedConstants.ValueForPrimaryColumnHeader, async (newValue) => {
			if (this.currentRowObjectInfo.valueForPrimary !== newValue) {
				this.currentRowObjectInfo.valueForPrimary = newValue;
				this.dscTable.data[this.currentRowId][1] = newValue;
				// Update the secondary value with the primary, when the set seconadry checkbox is checked
				if (this.setSecondaryCheckboxForDropdowns.checked &&
					!dscConfigurationsWithoutSecondaryValue.includes(this.currentRowObjectInfo.id)) {
					this.currentRowObjectInfo.valueForSecondary = newValue;
					this.dscTable.data[this.currentRowId][2] = newValue;
				}
				await this.updateDscTable(this.dscTable.data);
			}
		}, [], '', true, 150)
		const primaryContainer = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.valueForPrimaryDropdown);
		this.dscPrimaryValueDropdownGroup = this.createGroup('', [primaryContainer], false, true);
		await this.dscPrimaryValueDropdownGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Apply Primary To Secondary checkbox
		this.setSecondaryCheckboxForDropdowns = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			await this.dscSecondaryValueDropdownGroup.updateCssStyles({ 'visibility': checked ? 'hidden' : 'visible' });
			this.currentRowObjectInfo.valueForSecondary = checked ? this.currentRowObjectInfo.valueForPrimary : this.dscOriginalData[this.currentRowId].valueForSecondary;
			await this.valueForSecondaryDropdown.updateProperties({ value: this.currentRowObjectInfo.valueForSecondary });
		}, true);
		this.dscSecondaryCheckboxForDropdownGroup = this.createGroup('', [this.setSecondaryCheckboxForDropdowns], false, true);
		await this.dscSecondaryCheckboxForDropdownGroup.updateCssStyles({ 'visibility': 'hidden' });

		// Value for Secondary
		this.valueForSecondaryDropdown = this.createDropdown(localizedConstants.ValueForSecondaryColumnHeader, async (newValue) => {
			if (!isUndefinedOrNull(newValue)) {
				this.currentRowObjectInfo.valueForSecondary = newValue as string;
				if (this.dscTable.data[this.currentRowId][2] !== newValue) {
					this.dscTable.data[this.currentRowId][2] = newValue;
					await this.updateDscTable(this.dscTable.data);
				}
			}
		}, [], '', true, 150);
		const secondaryContainer = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.valueForSecondaryDropdown);
		this.dscSecondaryValueDropdownGroup = this.createGroup('', [secondaryContainer], false, true);
		await this.dscSecondaryValueDropdownGroup.updateCssStyles({ 'visibility': 'hidden' });

		const valueGroup = this.createGroup('', [this.dscPrimaryValueDropdownGroup, this.dscSecondaryCheckboxForDropdownGroup, this.dscSecondaryValueDropdownGroup], true, true);
		await valueGroup.updateCssStyles({ 'margin-left': '-10px' });
		return valueGroup;
	}

	/**
	 * Make the dropdowns section for the selected database scoped configuration visible
	 * @param isSecondaryCheckboxChecked - Whether the secondary checkbox is checked or not
	 */
	private async showDropdownsSection(isSecondaryCheckboxChecked: boolean): Promise<void> {
		this.setSecondaryCheckboxForDropdowns.checked = isSecondaryCheckboxChecked;
		await this.dscPrimaryValueDropdownGroup.updateCssStyles({ 'visibility': 'visible' });
		await this.dscSecondaryCheckboxForDropdownGroup.updateCssStyles({ 'visibility': 'visible' });
		await this.dscSecondaryValueDropdownGroup.updateCssStyles({ 'visibility': isSecondaryCheckboxChecked ? 'hidden' : 'visible' });
	}

	/**
	 * Make the input section for the selected database scoped configuration visible
	 * @param isSecondaryCheckboxChecked - Whether the secondary checkbox is checked or not
	 */
	private async showInputSection(isSecondaryCheckboxChecked: boolean): Promise<void> {
		this.setSecondaryCheckboxForInputType.checked = isSecondaryCheckboxChecked;
		await this.dscPrimaryValueInputGroup.updateCssStyles({ 'visibility': 'visible', 'margin-top': '-175px' });
		await this.dscSecondaryCheckboxForInputGroup.updateCssStyles({ 'visibility': 'visible', 'margin-top': '-120px' });
		await this.dscSecondaryValueInputGroup.updateCssStyles({ 'visibility': isSecondaryCheckboxChecked ? 'hidden' : 'visible', 'margin-top': '-85px' });
	}

	/**
	 * Set all primary and secondary groups to hidden
	 */
	private async hideDropdownAndInputSections(): Promise<void> {
		await this.dscPrimaryValueInputGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscSecondaryCheckboxForInputGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscSecondaryValueInputGroup.updateCssStyles({ 'visibility': 'hidden', 'margin-top': '0px' });
		await this.dscPrimaryValueDropdownGroup.updateCssStyles({ 'visibility': 'hidden' });
		await this.dscSecondaryCheckboxForDropdownGroup.updateCssStyles({ 'visibility': 'hidden' });
		await this.dscSecondaryValueDropdownGroup.updateCssStyles({ 'visibility': 'hidden' });
	}

	/**
	 * Updates the data to the table and sets the focus to the selected row
	 * @param data - Modified data to be set in the table
	 */
	private async updateDscTable(data: any[][], inputToBeFocused: azdata.InputBoxComponent = undefined): Promise<void> {
		// Set the focus to the selected input box
		this.setFocusToInput = inputToBeFocused;
		await this.setTableData(this.dscTable, data, DscTableRowLength);
		// Restore the focus to previously selected row.
		this.dscTable.setActiveCell(this.currentRowId, 0);
	}
	// #endregion

	private initializeConfigureSLOSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		if (this.viewInfo.azureEditions?.length > 0) {
			let defaultEdition = this.viewInfo.azureEditions[0];
			this.objectInfo.azureEdition = defaultEdition;

			// Service Level Objective options
			let sloDetails = this.viewInfo.azureServiceLevelObjectives.find(details => details.editionDisplayName === defaultEdition);
			let serviceLevels = sloDetails?.editionOptions.options ?? [];
			let defaultIndex = sloDetails?.editionOptions.defaultValueIndex ?? 0;
			this.objectInfo.azureServiceLevelObjective = serviceLevels[defaultIndex];
			let serviceLevelDropbox = this.createDropdown(localizedConstants.CurrentSLOText, async () => {
				this.objectInfo.azureServiceLevelObjective = serviceLevelDropbox.value as string;
			}, serviceLevels, serviceLevels[defaultIndex]);

			// Maximum Database Size options
			let sizeDetails = this.viewInfo.azureMaxSizes.find(details => details.editionDisplayName === defaultEdition);
			let maxSizes = sizeDetails?.editionOptions.options ?? [];
			defaultIndex = sizeDetails?.editionOptions.defaultValueIndex ?? 0;
			this.objectInfo.azureMaxSize = maxSizes[defaultIndex];
			let sizeDropbox = this.createDropdown(localizedConstants.MaxSizeText, async () => {
				this.objectInfo.azureMaxSize = sizeDropbox.value as string;
			}, maxSizes, maxSizes[defaultIndex]);

			// Azure Database Edition options
			let editionDropbox = this.createDropdown(localizedConstants.EditionText, async () => {
				let edition = editionDropbox.value as string;
				this.objectInfo.azureEdition = edition;

				// Update dropboxes for SLO and Size, since they're edition specific
				sloDetails = this.viewInfo.azureServiceLevelObjectives?.find(details => details.editionDisplayName === edition);
				serviceLevels = sloDetails?.editionOptions.options ?? [];
				defaultIndex = sloDetails?.editionOptions.defaultValueIndex ?? 0;
				serviceLevelDropbox.loading = true;
				await serviceLevelDropbox.updateProperties({ value: serviceLevels[defaultIndex], values: serviceLevels });
				serviceLevelDropbox.loading = false;

				sizeDetails = this.viewInfo.azureMaxSizes?.find(details => details.editionDisplayName === edition);
				maxSizes = sizeDetails?.editionOptions.options ?? [];
				defaultIndex = sizeDetails?.editionOptions.defaultValueIndex ?? 0;
				sizeDropbox.loading = true;
				await sizeDropbox.updateProperties({ value: maxSizes[defaultIndex], values: maxSizes });
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
