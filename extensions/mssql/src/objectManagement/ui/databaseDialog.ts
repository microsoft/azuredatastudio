/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth, DefaultTableWidth, DefaultMinTableRowCount, DefaultMaxTableRowCount, getTableHeight, DialogButton } from '../../ui/dialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { CreateDatabaseDocUrl, DatabaseGeneralPropertiesDocUrl, DatabaseFilesPropertiesDocUrl, DatabaseOptionsPropertiesDocUrl, DatabaseScopedConfigurationPropertiesDocUrl, DatabaseFileGroupsPropertiesDocUrl, QueryStorePropertiesDocUrl } from '../constants';
import { Database, DatabaseFile, DatabaseScopedConfigurationsInfo, DatabaseViewInfo, FileGrowthType, FileGroup, FileGroupType, FileStreamEffectiveLevel } from '../interfaces';
import { convertNumToTwoDecimalStringInMB } from '../utils';
import { isUndefinedOrNull } from '../../types';
import { DatabaseFileDialog } from './databaseFileDialog';
import * as vscode from 'vscode';

const MAXDOP_Max_Limit = 32767;
const PAUSED_RESUMABLE_INDEX_Max_Limit = 71582;
const DscTableRowLength = 20;

export class DatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// Database Properties tabs
	private generalTab: azdata.Tab;
	private filesTab: azdata.Tab;
	private optionsTab: azdata.Tab;
	private fileGroupsTab: azdata.Tab;
	private dscTab: azdata.Tab;
	private queryStoreTab: azdata.Tab;
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
	private rowDatafileGroupsOptions: string[];
	private filestreamDatafileGroupsOptions: string[];
	// fileGroups Tab
	private readonly fileGroupsTabId: string = 'fileGroupsDatabaseId';
	private rowsFilegroupsTable: azdata.TableComponent;
	private filestreamFilegroupsTable: azdata.TableComponent;
	private memoryOptimizedFilegroupsTable: azdata.TableComponent;
	private rowsFilegroupNameInput: azdata.InputBoxComponent;
	private rowsFilegroupNameContainer: azdata.FlexContainer;
	private rowsFileGroupButtonContainer: azdata.FlexContainer;
	private filestreamFilegroupNameInput: azdata.InputBoxComponent;
	private filestreamFilegroupNameContainer: azdata.FlexContainer;
	private filestreamFileGroupButtonContainer: azdata.FlexContainer;
	private memoryOptimizedFilegroupNameInput: azdata.InputBoxComponent;
	private memoryOptimizedFilegroupNameContainer: azdata.FlexContainer;
	private memoryOptimizedFileGroupButtonContainer: azdata.FlexContainer;
	private newFileGroupTemporaryId: number = 0;
	private rowDataFileGroupsTableRows: FileGroup[] = [];
	private filestreamDataFileGroupsTableRows: FileGroup[] = [];
	private memoryoptimizedFileGroupsTableRows: FileGroup[] = [];
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
	private currentRowId: number;
	private valueForPrimaryDropdown: azdata.DropDownComponent;
	private valueForSecondaryDropdown: azdata.DropDownComponent;
	private setSecondaryCheckboxForDropdowns: azdata.CheckBoxComponent;
	private valueForPrimaryInput: azdata.InputBoxComponent;
	private valueForSecondaryInput: azdata.InputBoxComponent;
	private setSecondaryCheckboxForInputType: azdata.CheckBoxComponent;
	private dscPrimaryValueDropdown: azdata.FlexContainer;
	private dscSecondaryValueDropdown: azdata.FlexContainer;
	private dscPrimaryValueInput: azdata.FlexContainer;
	private dscSecondaryValueInput: azdata.FlexContainer;
	private setFocusToInput: azdata.InputBoxComponent = undefined;
	private currentRowObjectInfo: DatabaseScopedConfigurationsInfo;
	// Query store Tab
	private readonly queryStoreTabId: string = 'queryStoreTabId';
	private queryStoreTabSectionsContainer: azdata.Component[] = [];
	private areQueryStoreOptionsEnabled: boolean;
	private requestedOperationMode: azdata.DropDownComponent;
	private dataFlushIntervalInMinutes: azdata.InputBoxComponent;
	private statisticsCollectionInterval: azdata.DropDownComponent;
	private maxPlansPerQuery: azdata.InputBoxComponent;
	private maxSizeinMB: azdata.InputBoxComponent;
	private queryStoreCaptureMode: azdata.DropDownComponent;
	private sizeBasedCleanupMode: azdata.DropDownComponent;
	private stateQueryThresholdInDays: azdata.InputBoxComponent;
	private waitStatisticsCaptureMode: azdata.DropDownComponent;
	private executionCount: azdata.InputBoxComponent;
	private staleThreshold: azdata.DropDownComponent;
	private totalCompileCPUTimeInMS: azdata.InputBoxComponent;
	private totalExecutionCPUTimeInMS: azdata.InputBoxComponent;
	private operationModeOffOption: string;
	private purgeQueryDataButton: azdata.ButtonComponent;


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
			case this.fileGroupsTabId:
				helpUrl = DatabaseFileGroupsPropertiesDocUrl;
				break;
			case this.optionsTabId:
				helpUrl = DatabaseOptionsPropertiesDocUrl;
				break;
			case this.dscTabId:
				helpUrl = DatabaseScopedConfigurationPropertiesDocUrl;
				break;
			case this.queryStoreTabId:
				helpUrl = QueryStorePropertiesDocUrl;
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

			// Prepare the copies of individual filegroups tables data and filegroups options for files tab
			if (!isUndefinedOrNull(this.objectInfo.filegroups)) {
				this.updateFileGroupsOptionsAndTableRows();
			}

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

			// Initilaize FileGroups Tab
			if (!isUndefinedOrNull(this.objectInfo.filegroups)) {
				const rowsFileGroupSection = await this.initializeRowsFileGroupSection();
				const fileStreamFileGroupSection = await this.initializeFileStreamFileGroupSection();
				const memoryOptimizedFileGroupSection = await this.initializeMemoryOptimizedFileGroupSection();
				this.fileGroupsTab = {
					title: localizedConstants.FileGroupsSectionHeader,
					id: this.fileGroupsTabId,
					content: this.createGroup('', [rowsFileGroupSection, fileStreamFileGroupSection, memoryOptimizedFileGroupSection], false)
				};
				tabs.push(this.fileGroupsTab);
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

			// Intialize Query Store Tab
			if (!isUndefinedOrNull(this.objectInfo.queryStoreOptions)) {
				this.initializeQueryStoreGeneralSection();
				this.initializeQueryStoreMonitoringSection();
				this.initializeQueryStoreRetentionSection();
				if (!isUndefinedOrNull(this.objectInfo.queryStoreOptions.capturePolicyOptions)) {
					this.initializeQueryStoreCapturePolicySection();
				}
				await this.initializeQueryStoreCurrentDiskStorageSection();
				this.queryStoreTab = {
					title: localizedConstants.QueryStoreTabHeader,
					id: this.queryStoreTabId,
					content: this.createGroup('', this.queryStoreTabSectionsContainer, false)
				}
				tabs.push(this.queryStoreTab);
			}

			// Initialize tab group with tabbed panel
			const propertiesTabGroup = { title: '', tabs: tabs };
			const propertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel()
				.withTabs([propertiesTabGroup])
				.withLayout({
					orientation: azdata.TabOrientation.Vertical
				})
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

		// Validate Rows Filegroup names
		if (this.objectInfo.filegroups?.length > 0) {
			let seenFilegroups = new Set<string>;
			this.objectInfo.filegroups.map(function (item) {
				if (item.name === '') {
					errors.push(localizedConstants.EmptyFilegroupNameError);
				} else if (seenFilegroups.has(item.name)) {
					errors.push(localizedConstants.FilegroupExistsError(item.name));
				} else {
					seenFilegroups.add(item.name)
				}
			});
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
		containers.push(this.createLabelInputContainer(localizedConstants.NameText, this.nameInput, true));

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

		if (!isUndefinedOrNull(this.objectInfo.isLedgerDatabase)) {
			let ledgerCheckbox = this.createCheckbox(localizedConstants.IsLedgerDatabaseText, async () => {
				this.objectInfo.isLedgerDatabase = ledgerCheckbox.checked;
			}, this.objectInfo.isLedgerDatabase);
			containers.push(ledgerCheckbox);
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
			await this.setTableData(this.databaseFilesTable, newData, DefaultMaxTableRowCount);
			await this.updateFileGroupsTablesfileCount(result.type);
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
				await this.setTableData(this.databaseFilesTable, newData, DefaultMaxTableRowCount);
				await this.updateFileGroupsTablesfileCount(result.type);
			}
		}
	}

	/**
	 * Removes the selected database file from the table
	 */
	private async onRemoveDatabaseFilesButtonClicked(): Promise<void> {
		if (this.databaseFilesTable.selectedRows.length === 1) {
			await this.updateFileGroupsTablesfileCount(this.objectInfo.files[this.databaseFilesTable.selectedRows[0]].type);
			this.objectInfo.files?.splice(this.databaseFilesTable.selectedRows[0], 1);
			var newData = this.objectInfo.files?.map(file => {
				return this.convertToDataView(file);
			});
			await this.setTableData(this.databaseFilesTable, newData, DefaultMaxTableRowCount);
		}
	}

	/**
	 * Updating the filegroups tables number of files count for each action of adding/editing/removing a database file
	 * @param fileType type of the file to get the data for the table
	 */
	private async updateFileGroupsTablesfileCount(fileType: string): Promise<void> {
		if (fileType === localizedConstants.RowsDataFileType) {
			let data = this.getTableData(FileGroupType.RowsFileGroup);
			await this.setTableData(this.rowsFilegroupsTable, data);
		}
		else if (fileType === localizedConstants.FilestreamFileType) {
			let data = this.getTableData(FileGroupType.FileStreamDataFileGroup);
			await this.setTableData(this.filestreamFilegroupsTable, data);
			data = this.getTableData(FileGroupType.MemoryOptimizedDataFileGroup);
			await this.setTableData(this.memoryOptimizedFilegroupsTable, data);
		}
	}

	/**
	 * Validate the selected row to enable/disable the remove button
	 * @returns true if the remove button should be enabled, false otherwise
	 */
	protected override removeButtonEnabled(table: azdata.TableComponent): boolean {
		let isEnabled = true;
		if (table === this.databaseFilesTable && this.databaseFilesTable.selectedRows !== undefined) {
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
		else if (table === this.rowsFilegroupsTable && this.rowsFilegroupsTable.selectedRows !== undefined && this.rowsFilegroupsTable.selectedRows.length === 1) {
			const selectedRow = this.rowDataFileGroupsTableRows[this.rowsFilegroupsTable.selectedRows[0]];
			// Cannot delete a row file if the fileGroup is Primary.
			if (selectedRow.name === 'PRIMARY' && selectedRow.id > 0) {
				isEnabled = false;
			}
		}
		else if (table === this.filestreamFilegroupsTable && this.filestreamFilegroupsTable.selectedRows?.length === 1) {
			// Disable remove button when server filestream access level is disabled.
			if (!this.serverFilestreamEnabled) {
				isEnabled = false;
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
			fileGroup: this.rowDatafileGroupsOptions.find(option => option === 'PRIMARY'),
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
			rowFilegroups: this.rowDatafileGroupsOptions,
			filestreamFilegroups: this.filestreamDatafileGroupsOptions,
			isNewFile: isNewFile,
			isEditingNewFile: isEditingNewFile,
			databaseFile: databaseFile,
			defaultFileConstants: {
				defaultFileSizeInMb: defaultFileSizeInMb,
				defaultFileGrowthInMb: defaultFileGrowthInMb,
				defaultFileGrowthInPercent: defaultFileGrowthInPercent,
				defaultMaxFileSizeLimitedToInMb: defaultMaxFileSizeLimitedToInMb
			},
			connectionUri: this.options.connectionUri
		}, this.objectManagementService);
		await dialog.open();
		return await dialog.waitForClose();
	}

	//#endregion

	//#region Database Properties - FileGroups Tab
	/**
	 * Initializes the rows filegroups section and updates the table data
	 * @returns Row data filegroups container
	 */
	private async initializeRowsFileGroupSection(): Promise<azdata.GroupContainer> {
		const data = this.getTableData(FileGroupType.RowsFileGroup);
		this.rowsFilegroupsTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText,
				width: 120
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FilesText,
				width: 60
			}, {
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.ReadOnlyText,
				width: 80
			}, {
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.DefaultText,
				width: 80
			}, {
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.AutogrowAllFilesText,
				width: 110
			}],
			data: data,
			height: getTableHeight(data.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: DefaultTableWidth,
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();
		this.rowsFilegroupNameContainer = await this.getFilegroupNameGroup(this.rowsFilegroupsTable, FileGroupType.RowsFileGroup);
		const addButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.AddFilegroupText,
			buttonHandler: () => this.onAddDatabaseFileGroupsButtonClicked(this.rowsFilegroupsTable)
		};
		const removeButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.RemoveButton,
			buttonHandler: () => this.onRemoveDatabaseFileGroupsButtonClicked(this.rowsFilegroupsTable)
		};
		this.rowsFileGroupButtonContainer = this.addButtonsForTable(this.rowsFilegroupsTable, addButtonComponent, removeButtonComponent);
		this.disposables.push(
			this.rowsFilegroupsTable.onCellAction(async (arg: azdata.ICheckboxCellActionEventArgs) => {
				let filegroup = this.rowDataFileGroupsTableRows[arg.row];
				// Read-Only column
				if (arg.column === 2) {
					filegroup.isReadOnly = arg.checked;
				}
				// Default column
				if (arg.column === 3) {
					this.updateFilegroupsDefaultColumnValues(arg, filegroup, FileGroupType.RowsFileGroup);
				}
				// Autogrow all files column
				if (arg.column === 4) {
					filegroup.autogrowAllFiles = arg.checked;
				}

				// Refresh the table with updated data
				let data = this.getTableData(FileGroupType.RowsFileGroup);
				await this.setTableData(this.rowsFilegroupsTable, data);
				this.onFormFieldChange();
			}),
			this.rowsFilegroupsTable.onRowSelected(
				async () => {
					if (this.rowsFilegroupsTable.selectedRows.length === 1) {
						const fileGroup = this.rowDataFileGroupsTableRows[this.rowsFilegroupsTable.selectedRows[0]];
						this.rowsFilegroupNameContainer.display = fileGroup.id < 0 ? 'inline-flex' : 'none';
						this.rowsFilegroupNameInput.value = fileGroup.name;
						this.onFormFieldChange();
					}
				}
			)
		);
		return this.createGroup(localizedConstants.RowsFileGroupsSectionText, [this.rowsFilegroupsTable, this.rowsFilegroupNameContainer, this.rowsFileGroupButtonContainer], true);
	}

	/**
	 * Initializes the filestream filegroups section and updates the table data
	 * @returns filestream data filegroups container
	 */
	private async initializeFileStreamFileGroupSection(): Promise<azdata.GroupContainer> {
		const data = this.getTableData(FileGroupType.FileStreamDataFileGroup);
		this.filestreamFilegroupsTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FilestreamFilesText
			}, {
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.ReadOnlyText
			}, {
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.DefaultText
			}],
			data: data,
			height: getTableHeight(data.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: DefaultTableWidth,
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();
		this.filestreamFilegroupNameContainer = await this.getFilegroupNameGroup(this.filestreamFilegroupsTable, FileGroupType.FileStreamDataFileGroup);
		const addButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.AddFilegroupText,
			buttonHandler: () => this.onAddDatabaseFileGroupsButtonClicked(this.filestreamFilegroupsTable),
			enabled: this.serverFilestreamEnabled
		};
		const removeButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.RemoveButton,
			buttonHandler: () => this.onRemoveDatabaseFileGroupsButtonClicked(this.filestreamFilegroupsTable)
		};
		this.filestreamFileGroupButtonContainer = this.addButtonsForTable(this.filestreamFilegroupsTable, addButtonComponent, removeButtonComponent);
		this.disposables.push(
			this.filestreamFilegroupsTable.onCellAction(async (arg: azdata.ICheckboxCellActionEventArgs) => {
				let filegroup = this.filestreamDataFileGroupsTableRows[arg.row];
				// Read-Only column
				if (arg.column === 2) {
					filegroup.isReadOnly = arg.checked;
				}
				// Default column
				else if (arg.column === 3) {
					this.updateFilegroupsDefaultColumnValues(arg, filegroup, FileGroupType.FileStreamDataFileGroup);
				}

				// Refresh the table with updated data
				let data = this.getTableData(FileGroupType.FileStreamDataFileGroup);
				await this.setTableData(this.filestreamFilegroupsTable, data);
				this.onFormFieldChange();
			}),
			this.filestreamFilegroupsTable.onRowSelected(
				async () => {
					if (this.filestreamFilegroupsTable.selectedRows.length === 1) {
						const fileGroup = this.filestreamDataFileGroupsTableRows[this.filestreamFilegroupsTable.selectedRows[0]];
						this.filestreamFilegroupNameContainer.display = fileGroup.id < 0 ? 'inline-flex' : 'none';
						this.filestreamFilegroupNameInput.value = fileGroup.name;
						this.onFormFieldChange();
					}
				}
			)
		);

		return this.createGroup(localizedConstants.FileStreamFileGroupsSectionText, [this.filestreamFilegroupsTable, this.filestreamFilegroupNameContainer, this.filestreamFileGroupButtonContainer], true);
	}

	/**
	 * Initializes the memory optimized filegroups section and updates the table data
	 * @returns Memory optimized filegroups container
	 */
	private async initializeMemoryOptimizedFileGroupSection(): Promise<azdata.GroupContainer> {
		const data = this.getTableData(FileGroupType.MemoryOptimizedDataFileGroup);
		this.memoryOptimizedFilegroupsTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FilestreamFilesText
			}],
			data: data,
			height: getTableHeight(data.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: DefaultTableWidth,
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();
		this.memoryOptimizedFilegroupNameContainer = await this.getFilegroupNameGroup(this.memoryOptimizedFilegroupsTable, FileGroupType.MemoryOptimizedDataFileGroup);
		const addButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.AddFilegroupText,
			buttonHandler: () => this.onAddDatabaseFileGroupsButtonClicked(this.memoryOptimizedFilegroupsTable),
			enabled: this.memoryoptimizedFileGroupsTableRows.length < 1
		};
		const removeButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.RemoveButton,
			buttonHandler: () => this.onRemoveDatabaseFileGroupsButtonClicked(this.memoryOptimizedFilegroupsTable)
		};
		this.memoryOptimizedFileGroupButtonContainer = this.addButtonsForTable(this.memoryOptimizedFilegroupsTable, addButtonComponent, removeButtonComponent);
		this.disposables.push(
			this.memoryOptimizedFilegroupsTable.onRowSelected(
				async () => {
					if (this.memoryOptimizedFilegroupsTable.selectedRows.length === 1) {
						const fileGroup = this.memoryoptimizedFileGroupsTableRows[this.memoryOptimizedFilegroupsTable.selectedRows[0]];
						this.memoryOptimizedFilegroupNameContainer.display = fileGroup.id < 0 ? 'inline-flex' : 'none';
						this.memoryOptimizedFilegroupNameInput.value = fileGroup.name;
						this.onFormFieldChange();
					}
				}
			)
		);

		return this.createGroup(localizedConstants.MemoryOptimizedFileGroupsSectionText, [this.memoryOptimizedFilegroupsTable, this.memoryOptimizedFilegroupNameContainer, this.memoryOptimizedFileGroupButtonContainer], true);
	}

	/**
	 * Overrides declarative table add button enabled/disabled state
	 * @param table table component
	 * @returns table add button enabled/disabled state
	 */
	public override addButtonEnabled(table: azdata.TableComponent | azdata.DeclarativeTableComponent): boolean {
		let enabled = true;
		if (table === this.memoryOptimizedFilegroupsTable) {
			enabled = this.memoryoptimizedFileGroupsTableRows.length < 1;
		}
		return enabled;
	}

	/**
	 * Update the default value for the filegroup
	 * @param arg selected checkbox event
	 * @param filegroup filegroup object
	 * @param filegroupType filegroup type
	 */
	private updateFilegroupsDefaultColumnValues(arg: azdata.ICheckboxCellActionEventArgs, filegroup: FileGroup, filegroupType: FileGroupType): void {
		if (arg.checked) {
			this.objectInfo.filegroups.forEach(fg => {
				if (fg.type === filegroupType) {
					fg.isDefault = fg.name === filegroup.name && fg.id === filegroup.id ? arg.checked : !arg.checked;
				}
			});
		} else {
			filegroup.isDefault = arg.checked;
		}
	}

	/**
	 * Adding new row to the respective table on its add button click
	 * @param table table component
	 */
	private async onAddDatabaseFileGroupsButtonClicked(table: azdata.TableComponent): Promise<void> {
		let newData: any[] | undefined;
		let newRow: FileGroup = {
			id: --this.newFileGroupTemporaryId,
			name: '',
			type: undefined,
			isReadOnly: false,
			isDefault: false,
			autogrowAllFiles: false
		};
		if (table === this.rowsFilegroupsTable) {
			newRow.type = FileGroupType.RowsFileGroup;
			newRow.isReadOnly = false;
			newRow.isDefault = false;
			newRow.autogrowAllFiles = false
			this.objectInfo.filegroups?.push(newRow);
			newData = this.getTableData(FileGroupType.RowsFileGroup);
		}
		else if (table === this.filestreamFilegroupsTable) {
			newRow.type = FileGroupType.FileStreamDataFileGroup;
			newRow.isReadOnly = false;
			newRow.isDefault = false;
			this.objectInfo.filegroups?.push(newRow);
			newData = this.getTableData(FileGroupType.FileStreamDataFileGroup);
		}
		else if (table === this.memoryOptimizedFilegroupsTable && this.memoryoptimizedFileGroupsTableRows.length < 1) {
			newRow.type = FileGroupType.MemoryOptimizedDataFileGroup;
			this.objectInfo.filegroups?.push(newRow);
			newData = this.getTableData(FileGroupType.MemoryOptimizedDataFileGroup);
		}

		if (newData !== undefined) {
			// Refresh the table with new row data
			this.updateFileGroupsOptionsAndTableRows();
			await this.setTableData(table, newData, DefaultMaxTableRowCount);
			table.setActiveCell(table.data?.length - 1, 0);
		}
	}

	/**
	 * Prepares the individual table rows for each filegroup type and list of filegroups options
	 * This will be useful to get the selected row data from the table to get the filegroup property details, helps when have duplicate rows added
	 */
	private updateFileGroupsOptionsAndTableRows(): void {
		// Filegroups rows for filegroups tab
		this.rowDataFileGroupsTableRows = this.objectInfo.filegroups?.filter(filegroup => filegroup.type === FileGroupType.RowsFileGroup);
		this.filestreamDataFileGroupsTableRows = this.objectInfo.filegroups?.filter(filegroup => filegroup.type === FileGroupType.FileStreamDataFileGroup);
		this.memoryoptimizedFileGroupsTableRows = this.objectInfo.filegroups?.filter(filegroup => filegroup.type === FileGroupType.MemoryOptimizedDataFileGroup);

		// Filegroups options for files tab
		this.filestreamDatafileGroupsOptions = this.objectInfo.filegroups?.filter(filegroup => filegroup.type === FileGroupType.FileStreamDataFileGroup || filegroup.type === FileGroupType.MemoryOptimizedDataFileGroup).map(filegroup => filegroup.name);
		this.rowDatafileGroupsOptions = this.objectInfo.filegroups?.filter(filegroup => filegroup.type === FileGroupType.RowsFileGroup).map(filegroup => filegroup.name);
		let index: number;
		if ((index = this.rowDatafileGroupsOptions.indexOf('PRIMARY')) !== -1) {
			this.rowDatafileGroupsOptions.unshift(this.rowDatafileGroupsOptions.splice(index, 1)[0]);
		}
	}

	/**
	 * Removed the selected row from the respective table on its remove button click
	 * @param table table component
	 */
	private async onRemoveDatabaseFileGroupsButtonClicked(table: azdata.TableComponent): Promise<void> {
		if (table === this.rowsFilegroupsTable) {
			if (this.rowsFilegroupsTable.selectedRows.length === 1) {
				const removeFilegroupIndex = this.objectInfo.filegroups.indexOf(this.rowDataFileGroupsTableRows[this.rowsFilegroupsTable.selectedRows[0]]);
				this.objectInfo.filegroups?.splice(removeFilegroupIndex, 1);
				var newData = this.getTableData(FileGroupType.RowsFileGroup);
				this.rowsFilegroupNameContainer.display = 'none';
			}
		}
		else if (table === this.filestreamFilegroupsTable) {
			if (this.filestreamFilegroupsTable.selectedRows.length === 1) {
				const removeFilegroupIndex = this.objectInfo.filegroups.indexOf(this.filestreamDataFileGroupsTableRows[this.filestreamFilegroupsTable.selectedRows[0]]);
				this.objectInfo.filegroups?.splice(removeFilegroupIndex, 1);
				var newData = this.getTableData(FileGroupType.FileStreamDataFileGroup);
				this.filestreamFilegroupNameContainer.display = 'none';
			}
		}
		else if (table === this.memoryOptimizedFilegroupsTable) {
			if (this.memoryOptimizedFilegroupsTable.selectedRows.length === 1) {
				const removeFilegroupIndex = this.objectInfo.filegroups.indexOf(this.memoryoptimizedFileGroupsTableRows[this.memoryOptimizedFilegroupsTable.selectedRows[0]]);
				this.objectInfo.filegroups?.splice(removeFilegroupIndex, 1);
				var newData = this.getTableData(FileGroupType.MemoryOptimizedDataFileGroup);
				this.memoryOptimizedFilegroupNameContainer.display = 'none';
			}
		}

		// Refresh the individual table rows object and table with updated data
		this.updateFileGroupsOptionsAndTableRows();
		await this.setTableData(table, newData);
		if (table.selectedRows !== undefined && table.selectedRows[0] !== undefined && table.selectedRows[0] < table.data?.length) {
			table.setActiveCell(table.selectedRows[0], 0);
		}
	}

	/**
	 * Creates the group container for filegroups input section
	 * @param table table component
	 * @param filegroupType filegroup type
	 * @returns filegroup name group container
	 */
	private async getFilegroupNameGroup(table: azdata.TableComponent, filegroupType: FileGroupType): Promise<azdata.FlexContainer> {
		const fgInput = this.getFilegroupNameInput(table, filegroupType);
		if (table === this.rowsFilegroupsTable) {
			this.rowsFilegroupNameInput = fgInput;
		} else if (table === this.filestreamFilegroupsTable) {
			this.filestreamFilegroupNameInput = fgInput;
		} else if (table === this.memoryOptimizedFilegroupsTable) {
			this.memoryOptimizedFilegroupNameInput = fgInput;
		}

		let fgInputGroupcontainer = this.createLabelInputContainer(localizedConstants.fileGroupsNameInput, [fgInput], false);
		await fgInputGroupcontainer.updateCssStyles({ 'margin': '0px 0px -10px 10px' });
		fgInputGroupcontainer.display = 'none';
		return fgInputGroupcontainer;
	}

	/**
	 * Creates input box for filegroup name
	 * @param table table component
	 * @param filegroupType filegroup type
	 * @returns Input component
	 */
	private getFilegroupNameInput(table: azdata.TableComponent, filegroupType: FileGroupType): azdata.InputBoxComponent {
		return this.createInputBox(async (value) => {
			if (table.selectedRows.length === 1) {
				let fg = null;
				if (table === this.rowsFilegroupsTable) {
					fg = this.rowDataFileGroupsTableRows[table.selectedRows[0]];
				} else if (table === this.filestreamFilegroupsTable) {
					fg = this.filestreamDataFileGroupsTableRows[table.selectedRows[0]];
				} else if (table === this.memoryOptimizedFilegroupsTable) {
					fg = this.memoryoptimizedFileGroupsTableRows[table.selectedRows[0]];
				}
				if (fg !== null && fg.id < 0) {
					fg.name = value;
					let data = this.getTableData(filegroupType);
					await this.setTableData(table, data);
					this.updateFileGroupsOptionsAndTableRows();
				}
			}
		}, {
			ariaLabel: localizedConstants.fileGroupsNameInput,
			inputType: 'text',
			enabled: true,
			value: '',
			width: DefaultInputWidth
		});
	}

	/**
	 * Converts the filegroup object to a data view object
	 * Note: Cannot change properties(Read-only, Default, Autogrow All files) of empty Rows data filegroups, the filegroup must contain at least one file
	 * Note: Cannot change properties(Read-only) of empty Filestream data filegroups, the filegroup must contain at least one file
	 * @param filegroupType filegroup type
	 * @returns data view object
	 */
	private getTableData(filegroupType: FileGroupType): any[] {
		let data: any[] = [];
		this.objectInfo.filegroups?.map(fileGroup => {
			const filesCount = this.objectInfo.files?.filter(file => file.fileGroup === fileGroup.name).length;
			if (filegroupType === FileGroupType.RowsFileGroup && fileGroup.type === filegroupType) {
				data.push([
					fileGroup.name,
					filesCount,
					{ checked: fileGroup.isReadOnly, enabled: (fileGroup.name !== 'PRIMARY' && filesCount > 0) },
					{ checked: fileGroup.isDefault, enabled: filesCount > 0 },
					{ checked: fileGroup.autogrowAllFiles, enabled: filesCount > 0 }
				]);
			} else if (fileGroup.type === FileGroupType.FileStreamDataFileGroup && fileGroup.type === filegroupType) {
				data.push([
					fileGroup.name,
					filesCount,
					{ checked: fileGroup.isReadOnly, enabled: filesCount > 0 && this.serverFilestreamEnabled },
					{ checked: fileGroup.isDefault, enabled: this.serverFilestreamEnabled },
				]);
			} else if (fileGroup.type === FileGroupType.MemoryOptimizedDataFileGroup && fileGroup.type === filegroupType) {
				data.push([
					fileGroup.name,
					filesCount
				]);
			}
		});

		return data;
	}

	/**
	 * Gets the server filestream enabled state
	 * @returns true if the server filestream access level is not null and not disabled
	 */
	private get serverFilestreamEnabled(): boolean {
		return this.viewInfo.serverFilestreamAccessLevel !== null && this.viewInfo.serverFilestreamAccessLevel !== FileStreamEffectiveLevel.Disabled;
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
		// Configurations that doesn't support secondary replica
		let secondaryUnsupportedConfigsSet = new Set<number>([11, 12, 25, 6, 21]);
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
				return [metaData.name.toLocaleUpperCase(),
				metaData.valueForPrimary,
				secondaryUnsupportedConfigsSet.has(metaData.id) ? localizedConstants.NotAvailableText : metaData.valueForSecondary]
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
			await this.dscPrimaryValueDropdown.updateCssStyles({ 'display': 'inline-flex' });
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
			await this.dscPrimaryValueInput.updateCssStyles({ 'display': 'inline-flex' });
			await this.valueForPrimaryInput.updateProperties({
				value: this.currentRowObjectInfo.valueForPrimary
				, max: PAUSED_RESUMABLE_INDEX_Max_Limit
			});
		}
		// Can only set OFF/Azure blob storage endpoint to the 'LEDGER_DIGEST_STORAGE_ENDPOINT (38)'s primary and secondary values
		else if (this.currentRowObjectInfo.id === 38) {
			await this.showDropdownsSection(isSecondaryCheckboxChecked);
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify([this.viewInfo.propertiesOnOffOptions[1]]) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: [this.viewInfo.propertiesOnOffOptions[1]] // Only OFF is allowed for primary value
					, value: this.currentRowObjectInfo.valueForPrimary
					, editable: true // This is to allow the user to enter the Azure blob storage endpoint
				});
			}
			if (JSON.stringify(this.valueForSecondaryDropdown.values) !== JSON.stringify([this.viewInfo.propertiesOnOffOptions[1]]) ||
				this.valueForSecondaryDropdown.value !== this.currentRowObjectInfo.valueForSecondary) {
				await this.valueForSecondaryDropdown.updateProperties({
					values: [this.viewInfo.propertiesOnOffOptions[1]] // Only OFF is allowed for secondary value
					, value: this.currentRowObjectInfo.valueForSecondary
					, editable: true // This is to allow the user to enter the Azure blob storage endpoint
				});
			}
		}
		// Cannot set the 'IDENTITY_CACHE (6)' option for the secondaries replica while this option is only allowed to be set for the primary.
		// Cannot set the 'GLOBAL_TEMPORARY_TABLE_AUTO_DROP (21)' option for the secondaries replica while this option is only allowed to be set for the primary.
		else if (this.currentRowObjectInfo.id === 6 || this.currentRowObjectInfo.id === 21) {
			await this.dscPrimaryValueDropdown.updateCssStyles({ 'display': 'inline-flex' });
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify(this.viewInfo.propertiesOnOffOptions) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: this.viewInfo.propertiesOnOffOptions
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
			if (JSON.stringify(this.valueForPrimaryDropdown.values) !== JSON.stringify(this.viewInfo.propertiesOnOffOptions) ||
				this.valueForPrimaryDropdown.value !== this.currentRowObjectInfo.valueForPrimary) {
				await this.valueForPrimaryDropdown.updateProperties({
					values: this.viewInfo.propertiesOnOffOptions
					, value: this.currentRowObjectInfo.valueForPrimary
				});
			}
			if (JSON.stringify(this.valueForSecondaryDropdown.values) !== JSON.stringify(this.viewInfo.propertiesOnOffOptions) ||
				this.valueForSecondaryDropdown.value !== this.currentRowObjectInfo.valueForSecondary) {
				await this.valueForSecondaryDropdown.updateProperties({
					values: this.viewInfo.propertiesOnOffOptions
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
		this.dscPrimaryValueInput = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.valueForPrimaryInput);
		this.dscPrimaryValueInput.display = 'none';

		// Apply Primary To Secondary checkbox
		this.setSecondaryCheckboxForInputType = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			await this.dscSecondaryValueInput.updateCssStyles({ 'display': checked ? 'none' : 'inline-flex' });
			this.currentRowObjectInfo.valueForSecondary = this.currentRowObjectInfo.valueForPrimary;
			await this.valueForSecondaryInput.updateProperties({ value: this.currentRowObjectInfo.valueForSecondary });
			if (this.dscTable.data[this.currentRowId][2] !== this.currentRowObjectInfo.valueForSecondary) {
				this.dscTable.data[this.currentRowId][2] = this.currentRowObjectInfo.valueForSecondary;
				await this.updateDscTable(this.dscTable.data);
			}
		}, true);
		this.setSecondaryCheckboxForInputType.display = 'none';

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
		this.dscSecondaryValueInput = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.valueForSecondaryInput);
		this.dscSecondaryValueInput.display = 'none';

		const inputTypegroup = this.createGroup('', [this.dscPrimaryValueInput, this.setSecondaryCheckboxForInputType, this.dscSecondaryValueInput], false, true);
		await inputTypegroup.updateCssStyles({ 'margin-top': '-30px' });
		return inputTypegroup;
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
		this.dscPrimaryValueDropdown = this.createLabelInputContainer(localizedConstants.ValueForPrimaryColumnHeader, this.valueForPrimaryDropdown);
		this.dscPrimaryValueDropdown.display = 'none';

		// Apply Primary To Secondary checkbox
		this.setSecondaryCheckboxForDropdowns = this.createCheckbox(localizedConstants.SetSecondaryText, async (checked) => {
			await this.dscSecondaryValueDropdown.updateCssStyles({ 'display': checked ? 'none' : 'inline-flex' });
			this.currentRowObjectInfo.valueForSecondary = this.currentRowObjectInfo.valueForPrimary;
			await this.valueForSecondaryDropdown.updateProperties({ value: this.currentRowObjectInfo.valueForSecondary });
		}, true);
		this.setSecondaryCheckboxForDropdowns.display = 'none';

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
		this.dscSecondaryValueDropdown = this.createLabelInputContainer(localizedConstants.ValueForSecondaryColumnHeader, this.valueForSecondaryDropdown);
		this.dscSecondaryValueDropdown.display = 'none';

		return this.createGroup('', [this.dscPrimaryValueDropdown, this.setSecondaryCheckboxForDropdowns, this.dscSecondaryValueDropdown], true, true);
	}

	/**
	 * Make the dropdowns section for the selected database scoped configuration visible
	 * @param isSecondaryCheckboxChecked - Whether the secondary checkbox is checked or not
	 */
	private async showDropdownsSection(isSecondaryCheckboxChecked: boolean): Promise<void> {
		this.setSecondaryCheckboxForDropdowns.checked = isSecondaryCheckboxChecked;
		this.setSecondaryCheckboxForDropdowns.display = 'inline-flex';
		await this.dscPrimaryValueDropdown.updateCssStyles({ 'display': 'inline-flex' });
		await this.dscSecondaryValueDropdown.updateCssStyles({ 'display': isSecondaryCheckboxChecked ? 'none' : 'inline-flex' });
	}

	/**
	 * Make the input section for the selected database scoped configuration visible
	 * @param isSecondaryCheckboxChecked - Whether the secondary checkbox is checked or not
	 */
	private async showInputSection(isSecondaryCheckboxChecked: boolean): Promise<void> {
		this.setSecondaryCheckboxForInputType.checked = isSecondaryCheckboxChecked;
		this.setSecondaryCheckboxForInputType.display = 'inline-flex';
		await this.dscPrimaryValueInput.updateCssStyles({ 'display': 'inline-flex' });
		await this.dscSecondaryValueInput.updateCssStyles({ 'display': isSecondaryCheckboxChecked ? 'none' : 'inline-flex' });
	}

	/**
	 * Set all primary and secondary groups to hidden
	 */
	private async hideDropdownAndInputSections(): Promise<void> {
		await this.dscPrimaryValueInput.updateCssStyles({ 'display': 'none' });
		this.setSecondaryCheckboxForInputType.display = 'none';
		await this.dscSecondaryValueInput.updateCssStyles({ 'display': 'none' });
		await this.dscPrimaryValueDropdown.updateCssStyles({ 'display': 'none' });
		this.setSecondaryCheckboxForDropdowns.display = 'none';
		await this.dscSecondaryValueDropdown.updateCssStyles({ 'display': 'none' });
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

	//#region Database Properties - Query Store Tab
	private initializeQueryStoreGeneralSection(): void {
		let containers: azdata.Component[] = [];
		const actualOperationMode = this.objectInfo.queryStoreOptions.actualMode;
		this.operationModeOffOption = 'Off'
		this.areQueryStoreOptionsEnabled = this.objectInfo.queryStoreOptions.actualMode !== this.operationModeOffOption;
		// Operation Mode (Actual)
		const operationModeActual = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ActualOperationModeText,
			inputType: 'text',
			enabled: false,
			value: actualOperationMode
		});
		containers.push(this.createLabelInputContainer(localizedConstants.ActualOperationModeText, operationModeActual));

		// Operation Mode (Requested)
		this.requestedOperationMode = this.createDropdown(localizedConstants.RequestedOperationModeText, async (newValue) => {
			this.objectInfo.queryStoreOptions.actualMode = newValue as string;
			this.areQueryStoreOptionsEnabled = newValue !== this.operationModeOffOption;
			await this.toggleQueryStoreOptions();
		}, this.viewInfo.operationModeOptions, String(this.objectInfo.queryStoreOptions.actualMode), true, DefaultInputWidth);
		containers.push(this.createLabelInputContainer(localizedConstants.RequestedOperationModeText, this.requestedOperationMode));

		const generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, containers, true);
		this.queryStoreTabSectionsContainer.push(generalSection);
	}

	private initializeQueryStoreMonitoringSection(): void {
		let containers: azdata.Component[] = [];
		// Data Flush Interval (Minutes)
		this.dataFlushIntervalInMinutes = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.dataFlushIntervalInMinutes = Number(newValue);
		}, {
			ariaLabel: localizedConstants.DataFlushIntervalInMinutesText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.dataFlushIntervalInMinutes),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.DataFlushIntervalInMinutesText, this.dataFlushIntervalInMinutes));

		// Statistics Collection Interval
		this.statisticsCollectionInterval = this.createDropdown(localizedConstants.StatisticsCollectionInterval, async (newValue) => {
			this.objectInfo.queryStoreOptions.statisticsCollectionInterval = String(newValue);
		}, this.viewInfo.statisticsCollectionIntervalOptions, this.objectInfo.queryStoreOptions.statisticsCollectionInterval, this.areQueryStoreOptionsEnabled, DefaultInputWidth);
		containers.push(this.createLabelInputContainer(localizedConstants.StatisticsCollectionInterval, this.statisticsCollectionInterval));

		const monitoringSection = this.createGroup(localizedConstants.MonitoringSectionText, containers, true);
		this.queryStoreTabSectionsContainer.push(monitoringSection);
	}

	private initializeQueryStoreRetentionSection(): void {
		let containers: azdata.Component[] = [];
		// Max Plans Per Query
		this.maxPlansPerQuery = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.maxPlansPerQuery = Number(newValue);
		}, {
			ariaLabel: localizedConstants.MaxPlansPerQueryText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.maxPlansPerQuery),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.MaxPlansPerQueryText, this.maxPlansPerQuery));

		// Max size (MB)
		this.maxSizeinMB = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.maxSizeInMB = Number(newValue);
		}, {
			ariaLabel: localizedConstants.MaxSizeInMbText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.maxSizeInMB),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.MaxSizeInMbText, this.maxSizeinMB));

		// Query Store Capture Mode
		this.queryStoreCaptureMode = this.createDropdown(localizedConstants.QueryStoreCaptureModeText, async (newValue) => {
			this.objectInfo.queryStoreOptions.queryStoreCaptureMode = newValue as string;
			await this.toggleQueryCapturePolicySection(newValue === localizedConstants.QueryStoreCapturemodeCustomText
				&& this.requestedOperationMode.value !== this.operationModeOffOption);
		}, this.viewInfo.queryStoreCaptureModeOptions, this.objectInfo.queryStoreOptions.queryStoreCaptureMode, this.areQueryStoreOptionsEnabled, DefaultInputWidth);
		containers.push(this.createLabelInputContainer(localizedConstants.QueryStoreCaptureModeText, this.queryStoreCaptureMode));

		// Size Based Cleanup Mode
		this.sizeBasedCleanupMode = this.createDropdown(localizedConstants.SizeBasedCleanupModeText, async (newValue) => {
			this.objectInfo.queryStoreOptions.sizeBasedCleanupMode = newValue as string;
		}, this.viewInfo.sizeBasedCleanupModeOptions, this.objectInfo.queryStoreOptions.sizeBasedCleanupMode, this.areQueryStoreOptionsEnabled, DefaultInputWidth);
		containers.push(this.createLabelInputContainer(localizedConstants.SizeBasedCleanupModeText, this.sizeBasedCleanupMode));

		// State Query Threshold (Days)
		this.stateQueryThresholdInDays = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.staleQueryThresholdInDays = Number(newValue);
		}, {
			ariaLabel: localizedConstants.StateQueryThresholdInDaysText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.staleQueryThresholdInDays),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.StateQueryThresholdInDaysText, this.stateQueryThresholdInDays));

		// Wait Statistics Capture Mode - supported from 2017 or higher
		if (!isUndefinedOrNull(this.objectInfo.queryStoreOptions.waitStatisticsCaptureMode)) {
			this.waitStatisticsCaptureMode = this.createDropdown(localizedConstants.WaitStatisticsCaptureModeText, async (newValue) => {
				// waitStatisticsCaptureMode value comes as On/Off, but options we provide are ON/OFF, handling selected value to match with the incoming value
				this.objectInfo.queryStoreOptions.waitStatisticsCaptureMode = newValue.charAt(0) + newValue.slice(1).toLowerCase() as string;
			}, this.viewInfo.propertiesOnOffOptions, this.objectInfo.queryStoreOptions.waitStatisticsCaptureMode.toUpperCase(), this.areQueryStoreOptionsEnabled, DefaultInputWidth);
			containers.push(this.createLabelInputContainer(localizedConstants.WaitStatisticsCaptureModeText, this.waitStatisticsCaptureMode));
		}
		const retentionSection = this.createGroup(localizedConstants.QueryStoreRetentionSectionText, containers, true);
		this.queryStoreTabSectionsContainer.push(retentionSection);
	}

	private initializeQueryStoreCapturePolicySection(): void {
		let containers: azdata.Component[] = [];
		// Execution Count
		this.executionCount = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.capturePolicyOptions.executionCount = Number(newValue);
		}, {
			ariaLabel: localizedConstants.ExecutionCountText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.capturePolicyOptions.executionCount),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.ExecutionCountText, this.executionCount));

		// Stale Threshold
		this.staleThreshold = this.createDropdown(localizedConstants.StaleThresholdText, async (newValue) => {
			this.objectInfo.queryStoreOptions.capturePolicyOptions.staleThreshold = newValue as string;
		}, this.viewInfo.staleThresholdOptions, this.objectInfo.queryStoreOptions.capturePolicyOptions.staleThreshold, this.areQueryStoreOptionsEnabled, DefaultInputWidth);
		containers.push(this.createLabelInputContainer(localizedConstants.StaleThresholdText, this.staleThreshold));

		// Total Compile CPU Time (ms)
		this.totalCompileCPUTimeInMS = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.capturePolicyOptions.totalCompileCPUTimeInMS = Number(newValue);
		}, {
			ariaLabel: localizedConstants.TotalCompileCPUTimeInMsText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.capturePolicyOptions.totalCompileCPUTimeInMS),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.TotalCompileCPUTimeInMsText, this.totalCompileCPUTimeInMS));

		// Total Execution CPU Time (ms)
		this.totalExecutionCPUTimeInMS = this.createInputBox(async (newValue) => {
			this.objectInfo.queryStoreOptions.capturePolicyOptions.totalExecutionCPUTimeInMS = Number(newValue);
		}, {
			ariaLabel: localizedConstants.TotalExecutionCPUTimeInMsText,
			inputType: 'number',
			enabled: this.areQueryStoreOptionsEnabled,
			value: String(this.objectInfo.queryStoreOptions.capturePolicyOptions.totalExecutionCPUTimeInMS),
			min: 0
		});
		containers.push(this.createLabelInputContainer(localizedConstants.TotalExecutionCPUTimeInMsText, this.totalExecutionCPUTimeInMS));

		const policySection = this.createGroup(localizedConstants.QueryStoreCapturePolicySectionText, containers, true);
		this.queryStoreTabSectionsContainer.push(policySection);
	}

	private async initializeQueryStoreCurrentDiskStorageSection(): Promise<void> {
		let containers: azdata.Component[] = [];
		// Database Max size
		const databaseName = this.createInputBox(async () => { }, {
			ariaLabel: this.objectInfo.name,
			inputType: 'text',
			enabled: false,
			value: localizedConstants.StringValueInMB(String(this.objectInfo.sizeInMb))
		});
		containers.push(this.createLabelInputContainer(this.objectInfo.name, databaseName));

		// Query Store Used
		const queryStoreUsed = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.QueryStoreUsedText,
			inputType: 'text',
			enabled: false,
			value: localizedConstants.StringValueInMB(String(this.objectInfo.queryStoreOptions.currentStorageSizeInMB))
		});
		containers.push(this.createLabelInputContainer(localizedConstants.QueryStoreUsedText, queryStoreUsed));

		// Query Store Available
		const queryStoreAvailable = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.QueryStoreAvailableText,
			inputType: 'text',
			enabled: false,
			value: localizedConstants.StringValueInMB(String(this.objectInfo.queryStoreOptions.maxSizeInMB - this.objectInfo.queryStoreOptions.currentStorageSizeInMB))
		});
		containers.push(this.createLabelInputContainer(localizedConstants.QueryStoreAvailableText, queryStoreAvailable));

		// Prge query data button
		this.purgeQueryDataButton = this.createButton(localizedConstants.PurgeQueryDataButtonText, localizedConstants.PurgeQueryDataButtonText, async () => {
			await this.purgeQueryStoreDataButtonClick();
		});
		this.purgeQueryDataButton.width = DefaultInputWidth;
		await this.purgeQueryDataButton.updateCssStyles({ 'margin': '10px 0px, 0px, 0px' });
		containers.push(this.createLabelInputContainer('', this.purgeQueryDataButton));

		const diskUsageSection = this.createGroup(localizedConstants.QueryStoreCurrentDiskUsageSectionText, containers, true);
		this.queryStoreTabSectionsContainer.push(diskUsageSection);
	}

	/**
	 *  Opens confirmation warning for clearing the query store data for the database
	 */
	private async purgeQueryStoreDataButtonClick(): Promise<void> {
		const response = await vscode.window.showWarningMessage(localizedConstants.PurgeQueryStoreDataMessage(this.objectInfo.name), localizedConstants.YesText);
		if (response !== localizedConstants.YesText) {
			return;
		}

		await this.objectManagementService.purgeQueryStoreData(this.options.connectionUri, this.options.database);
	}

	private async toggleQueryStoreOptions(): Promise<void> {
		this.dataFlushIntervalInMinutes.enabled
			= this.statisticsCollectionInterval.enabled
			= this.maxPlansPerQuery.enabled
			= this.maxSizeinMB.enabled
			= this.queryStoreCaptureMode.enabled
			= this.sizeBasedCleanupMode.enabled
			= this.stateQueryThresholdInDays.enabled = this.areQueryStoreOptionsEnabled;
		if (!isUndefinedOrNull(this.objectInfo.queryStoreOptions.waitStatisticsCaptureMode)) {
			this.waitStatisticsCaptureMode.enabled = this.areQueryStoreOptionsEnabled
		}
		await this.toggleQueryCapturePolicySection(this.areQueryStoreOptionsEnabled &&
			this.queryStoreCaptureMode.value === localizedConstants.QueryStoreCapturemodeCustomText);
	}

	private async toggleQueryCapturePolicySection(enable: boolean): Promise<void> {
		if (!isUndefinedOrNull(this.objectInfo.queryStoreOptions.capturePolicyOptions)) {
			this.executionCount.enabled
				= this.staleThreshold.enabled
				= this.totalCompileCPUTimeInMS.enabled
				= this.totalExecutionCPUTimeInMS.enabled = enable;
		}
	}
	//#endregion

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
