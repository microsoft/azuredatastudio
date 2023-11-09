/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../localizedConstants';
import * as localizedConstants from '../localizedConstants';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth, DefaultMaxTableRowCount, DefaultMinTableRowCount, DefaultTableWidth, getTableHeight } from '../../ui/dialogBase';
import { Database, DatabaseFileInfo, DatabaseViewInfo, RestoreDatabaseFileInfo } from '../interfaces';
import { IObjectManagementService } from 'mssql';
import { RestoreParams } from '../../contracts';
import { RestoreDatabaseFilesTabDocUrl, RestoreDatabaseGeneralTabDocUrl, RestoreDatabaseOptionsTabDocUrl } from '../constants';


const Dialog_Width = '1150px';
const RestoreInputsWidth = DefaultInputWidth + 650;
const RestoreTablesWidth = DefaultTableWidth + 650;

export class RestoreDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// restore diaog tabs
	private generalTab: azdata.Tab;
	private filesTab: azdata.Tab;
	private optionsTab: azdata.Tab;
	private activeTabId: string;
	private readonly generalTabId: string = 'restoreGeneralDatabaseId';
	private readonly filesTabId: string = 'restoreFilesDatabaseId';
	private readonly optionsTabId: string = 'restoreOptionsDatabaseId';
	private backupFilePathInput: azdata.InputBoxComponent;
	private backupFilePathContainer: azdata.FlexContainer;
	private backupFilePathButton: azdata.ButtonComponent;
	private relocateAllFiles: azdata.CheckBoxComponent;
	private overwriteExistingDatabase: azdata.CheckBoxComponent;
	private preserveReplicationSettings: azdata.CheckBoxComponent;
	private restrictAccessToRestoredDB: azdata.CheckBoxComponent;
	private standByFileInput: azdata.InputBoxComponent;
	private takeTailLogBackup: azdata.CheckBoxComponent;
	private leaveSourceDB: azdata.CheckBoxComponent;
	private closeExistingConnections: azdata.CheckBoxComponent;
	private restorePlanTable: azdata.TableComponent;
	private restoreDatabase: azdata.DropDownComponent;
	private restoreDatabaseTable: azdata.TableComponent;
	private restoreTo: azdata.InputBoxComponent;
	private tailLogBackupFile: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		options.width = Dialog_Width;
		super(objectManagementService, options, loc.RestoreDatabaseDialogTitle(options.database), 'RestoreDatabase');
		this.dialogObject.okButton.label = localizedConstants.RestoreText;
	}

	protected override get helpUrl(): string {
		return this.getRestoreDialogDocUrl();
	}

	private getRestoreDialogDocUrl(): string {
		let helpUrl = '';
		switch (this.activeTabId) {
			case this.generalTabId:
				helpUrl = RestoreDatabaseGeneralTabDocUrl;
				break;
			case this.filesTabId:
				helpUrl = RestoreDatabaseFilesTabDocUrl;
				break;
			case this.optionsTabId:
				helpUrl = RestoreDatabaseOptionsTabDocUrl;
				break;
			default:
				break;
		}
		return helpUrl;
	}

	protected async initializeUI(): Promise<void> {
		const tabs: azdata.Tab[] = [];
		// Initialize general Tab
		this.generalTab = {
			title: localizedConstants.GeneralSectionHeader,
			id: this.generalTabId,
			content: this.createGroup('', [
				this.initializeSourceSection(),
				this.initializeDestinationSection(),
				this.initializeRestorePlanSection()
			], false)
		};
		tabs.push(this.generalTab);

		this.filesTab = {
			title: localizedConstants.FilesSectionHeader,
			id: this.filesTabId,
			content: this.createGroup('', [
				this.initializeRestoreDatabaseFilesSection(),
				this.initializeRestoreDatabaseFilesDetailsSection()
			], false)
		};
		tabs.push(this.filesTab);

		this.optionsTab = {
			title: localizedConstants.OptionsSectionHeader,
			id: this.optionsTabId,
			content: this.createGroup('', [
				this.initializeRestoreOptionsSection(),
				this.initializeTailLogBackupSection(),
				this.initializeServerConnectionsSection()
			], false)
		};
		tabs.push(this.optionsTab);

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

	//#region General Tab
	private initializeSourceSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Restore from
		let restoreFrom = this.createDropdown(localizedConstants.RestoreFromText, async (newValue) => {
			if (newValue === localizedConstants.RestoreFromBackupFileOptionText) {
				this.backupFilePathContainer.display = 'inline-flex';
				this.restoreDatabase.enabled = false;
			} else {
				this.backupFilePathContainer.display = 'none';
				this.restoreDatabase.enabled = true;
			}
		}, [localizedConstants.RestoreFromDatabaseOptionText, localizedConstants.RestoreFromBackupFileOptionText],
			localizedConstants.RestoreFromDatabaseOptionText, true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.RestoreFromText, restoreFrom));

		// Backup file path
		this.backupFilePathInput = this.createInputBox(async (newValue) => {
			// this.result.path = newValue;
		}, {
			ariaLabel: localizedConstants.BackupFilePathText,
			inputType: 'text',
			enabled: true,
			value: '',
			width: RestoreInputsWidth - 30,
			placeHolder: localizedConstants.BackupFolderPathTitle
		});
		this.backupFilePathButton = this.createButton('...', '...', async () => { await this.createFileBrowser() });
		this.backupFilePathButton.width = 25;
		this.backupFilePathContainer = this.createLabelInputContainer(localizedConstants.BackupFilePathText, this.backupFilePathInput);
		this.backupFilePathContainer.addItems([this.backupFilePathButton], { flex: '10 0 auto' });
		this.backupFilePathContainer.display = 'none';
		containers.push(this.backupFilePathContainer);

		// source Database
		this.restoreDatabase = this.createDropdown(localizedConstants.DatabaseText, async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.sourceDatabaseName.currentValue = newValue;
			this.dialogObject.loading = true;
			// Get the new restore plan for the selected source database
			const restorePlanInfo = this.setRestoreOption();
			const restorePlan = await this.objectManagementService.getRestorePlan(restorePlanInfo);

			// Update the dailog values with the new restore plan
			await this.updateRestoreDialog(restorePlan);
			this.dialogObject.loading = false;
		}, this.viewInfo.restoreDatabaseInfo.sourceDatabaseNames, '', true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.DatabaseText, this.restoreDatabase));

		return this.createGroup(localizedConstants.SourceSectionText, containers, true);
	}

	private initializeDestinationSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];

		// target database
		let targetDatabase = this.createDropdown(localizedConstants.TargetDatabaseText, async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.targetDatabaseName.currentValue = newValue;
		}, this.viewInfo.restoreDatabaseInfo.targetDatabaseNames, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.targetDatabaseName.currentValue, true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.TargetDatabaseText, targetDatabase));

		// restore to
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.RestoreToText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.lastBackupTaken.currentValue
		};
		this.restoreTo = this.createInputBox(async () => { }, props);
		containers.push(this.createLabelInputContainer(localizedConstants.RestoreToText, this.restoreTo));

		return this.createGroup(localizedConstants.DestinationSectionText, containers, true);
	}

	private initializeRestorePlanSection(): azdata.GroupContainer {
		this.restorePlanTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.RestoreText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText,
				width: 200
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.ComponentText,
				width: 70
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.TypeText,
				width: 35
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.ServerText,
				width: 75
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.DatabaseText,
				width: 75
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.PositionText,
				width: 48
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FirstLSNText,
				width: 52
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.LastLSNText,
				width: 52
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.CheckpointLSNText,
				width: 88
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FullLSNText,
				width: 50
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.StartDateText,
				width: 85
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FinishDateText,
				width: 82
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.SizeText,
				width: 50
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.UserNameText,
				width: 65
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.ExpirationText,
				width: 60
			}],
			data: this.objectInfo.restoreOptions.restorePlanResponse.backupSetsToRestore?.map(plan => {
				return this.convertToDataView(plan);
			}),
			height: getTableHeight(this.objectInfo.restoreOptions.restorePlanResponse.backupSetsToRestore?.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: RestoreTablesWidth,
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();

		return this.createGroup(localizedConstants.SourceSectionText, [this.restorePlanTable], true);
	}

	/**
	 * Converts the database file info object to a data view object
	 * @param fileInfo database file info object
	 * @returns data view object
	 */
	private convertToDataView(fileInfo: DatabaseFileInfo): any[] {
		return [
			fileInfo.isSelected, //Restore
			fileInfo.properties[0].propertyValueDisplayName, //Name
			fileInfo.properties[1].propertyValueDisplayName, //Component
			fileInfo.properties[2].propertyValueDisplayName, //Type
			fileInfo.properties[3].propertyValueDisplayName, //Server
			fileInfo.properties[4].propertyValueDisplayName, //Database
			fileInfo.properties[5].propertyValueDisplayName, //Position
			fileInfo.properties[6].propertyValueDisplayName, //FirstLSN
			fileInfo.properties[7].propertyValueDisplayName, //LastLSN
			fileInfo.properties[8].propertyValueDisplayName, //CheckpointLSN
			fileInfo.properties[9].propertyValueDisplayName, //FullLSN
			fileInfo.properties[10].propertyValueDisplayName, //StartDate
			fileInfo.properties[11].propertyValueDisplayName, //FinishDate
			fileInfo.properties[12].propertyValueDisplayName, //Size
			fileInfo.properties[13].propertyValueDisplayName, //UserName
			fileInfo.properties[14].propertyValueDisplayName  //Expiration
		];
	}

	/**
	 * Creates a file browser and sets the path to the filePath
	 */
	private async createFileBrowser(): Promise<void> {
		let backupFolder = await this.objectManagementService.getBackupFolder(this.options.connectionUri);
		let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, backupFolder, [{ label: localizedConstants.allFiles, filters: ['*.bak'] }], true);
		if (filePath?.length > 0) {
			this.backupFilePathInput.value = filePath;
		}
	}

	/**
	 * Prepares the restore params to get restore plan for the selected source database
	 * @returns restore params
	 */
	private setRestoreOption(): RestoreParams {
		let options = {
			ownerUri: this.options.connectionUri,
			targetDatabaseName: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.targetDatabaseName.currentValue,
			sourceDatabaseName: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.sourceDatabaseName.currentValue,
			relocateDbFiles: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.relocateDbFiles.currentValue,
			readHeaderFromMedia: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.readHeaderFromMedia.currentValue,
			taskExecutionMode: azdata.TaskExecutionMode.execute,
			overwriteTargetDatabase: true,
		};

		const restoreParams: RestoreParams = {
			ownerUri: this.options.connectionUri,
			options: options
		};

		return restoreParams;
	}

	/**
	 * Updates the restore dialog with the latest restore plan details
	 */
	private async updateRestoreDialog(restorePlan: azdata.RestorePlanResponse): Promise<void> {
		// Update the objectInfo restore plan details with the new restore plan
		this.objectInfo.restoreOptions.restorePlanResponse = restorePlan;

		// Update Restore Plan table
		var restoreTableNewdata = this.objectInfo.restoreOptions.restorePlanResponse.backupSetsToRestore?.map(plan => {
			return this.convertToDataView(plan);
		});
		await this.setTableData(this.restorePlanTable, restoreTableNewdata, DefaultMaxTableRowCount);

		// Update Restore Database Files table
		var restoreDatabaseTableNewdata = this.objectInfo.restoreOptions.restorePlanResponse.dbFiles?.map(plan => {
			return this.convertToRestoreDbTableDataView(plan);
		});
		await this.setTableData(this.restoreDatabaseTable, restoreDatabaseTableNewdata, DefaultMaxTableRowCount);

		// Reset Restore to
		await this.restoreTo.updateProperty('value', this.objectInfo.restoreOptions.restorePlanResponse.planDetails.lastBackupTaken.currentValue);

		// Reset Stanby
		await this.standByFileInput.updateProperty('value', this.objectInfo.restoreOptions.restorePlanResponse.planDetails.standbyFile.defaultValue);

		//Reset Backup file
		await this.tailLogBackupFile.updateProperty('value', this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogBackupFile.defaultValue);
	}
	//#endregion

	//#region Files Tab
	private initializeRestoreDatabaseFilesSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Relocate all files
		this.relocateAllFiles = this.createCheckbox(localizedConstants.RelocateAllFilesText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.relocateDbFiles.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.relocateDbFiles.defaultValue, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.relocateDbFiles.isReadOnly);
		containers.push(this.relocateAllFiles);

		// Data	File folder
		const dataFileFolder = this.createInputBox(async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.dataFileFolder.currentValue = newValue;
		}, {
			ariaLabel: localizedConstants.DataFileFolderText,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.dataFileFolder.defaultValue,
			width: RestoreInputsWidth - 20
		});
		const dataDileFolderContainer = this.createLabelInputContainer(localizedConstants.DataFileFolderText, dataFileFolder);
		dataDileFolderContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(dataDileFolderContainer);

		// Log file folder
		const logFileFolder = this.createInputBox(async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.logFileFolder.currentValue = newValue;
		}, {
			ariaLabel: localizedConstants.LogFileFolderText,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.logFileFolder.defaultValue,
			width: RestoreInputsWidth - 20
		});
		const logFileFolderContainer = this.createLabelInputContainer(localizedConstants.LogFileFolderText, logFileFolder);
		logFileFolderContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(logFileFolderContainer);

		return this.createGroup(localizedConstants.RestoreDatabaseFilesAsText, containers, true);
	}

	private initializeRestoreDatabaseFilesDetailsSection(): azdata.GroupContainer {
		this.restoreDatabaseTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.text,
				value: localizedConstants.LogicalFileNameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FileTypeText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.OriginalFileNameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.RestoreAsText
			}],
			data: this.objectInfo.restoreOptions.restorePlanResponse.dbFiles?.map(plan => {
				return this.convertToRestoreDbTableDataView(plan);
			}),
			height: getTableHeight(this.objectInfo.restoreOptions.restorePlanResponse.dbFiles?.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			width: RestoreTablesWidth,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();

		return this.createGroup(localizedConstants.RestoreDatabaseFileDetailsText, [this.restoreDatabaseTable], true);
	}

	/**
	 * Converts the restore database file info object to a data view object
	 * @param fileInfo restore database file info object
	 * @returns data view object
	 */
	private convertToRestoreDbTableDataView(fileInfo: RestoreDatabaseFileInfo): any[] {
		return [
			fileInfo.logicalFileName,
			fileInfo.fileType,
			fileInfo.originalFileName,
			fileInfo.restoreAsFileName
		];
	}

	//#endregion

	//#region Options Tab
	private initializeRestoreOptionsSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Overwrite the existing database (WITH REPLACE)
		this.overwriteExistingDatabase = this.createCheckbox(localizedConstants.OverwriteTheExistingDatabaseText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.replaceDatabase.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.replaceDatabase.defaultValue);
		containers.push(this.overwriteExistingDatabase);

		// Preserve the replication settings (WITH KEEP_REPLICATION)
		this.preserveReplicationSettings = this.createCheckbox(localizedConstants.PreserveReplicationSettingsText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.keepReplication.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.keepReplication.defaultValue);
		containers.push(this.preserveReplicationSettings);

		// Restrict access to the restored database (WITH RESTRICTED_USER)
		this.restrictAccessToRestoredDB = this.createCheckbox(localizedConstants.RestrictAccessToRestoredDBText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.setRestrictedUser.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.setRestrictedUser.defaultValue);
		containers.push(this.restrictAccessToRestoredDB);

		//Recovery state
		let recoveryState = this.createDropdown(localizedConstants.RecoveryStateText, async (newValue) => {
			this.toggleRestoreOptionsOnRecoveryStateOptions(newValue as string);
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.recoveryState.currentValue = this.viewInfo.restoreDatabaseInfo.recoveryStateOptions.find(a => a.displayName === newValue).name as string;
		}, this.viewInfo.restoreDatabaseInfo.recoveryStateOptions.map(a => a.displayName)
			, this.viewInfo.restoreDatabaseInfo.recoveryStateOptions.find(a => a.name === this.objectInfo.restoreOptions.restorePlanResponse.planDetails.recoveryState.defaultValue).displayName
			, true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.RecoveryStateText, recoveryState));

		//Stand by file
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.StandbyFileText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth - 20,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.standbyFile.defaultValue
		};
		this.standByFileInput = this.createInputBox(async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.standbyFile.currentValue = newValue;
		}, props);
		const standByFileContainer = this.createLabelInputContainer(localizedConstants.StandbyFileText, this.standByFileInput);
		standByFileContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(standByFileContainer);

		return this.createGroup(localizedConstants.RestoreOptionsText, containers, true);
	}

	private initializeTailLogBackupSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Take tail-log backup before restore
		this.takeTailLogBackup = this.createCheckbox(localizedConstants.TakeTailLogBackupBeforeRestoreText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.backupTailLog.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.backupTailLog.defaultValue, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.backupTailLog.isReadOnly);
		containers.push(this.takeTailLogBackup);

		// leave source database in the restoring state (WITH NORECOVERY)
		this.leaveSourceDB = this.createCheckbox(localizedConstants.LeaveSourceDBText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogWithNoRecovery.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogWithNoRecovery.defaultValue, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogWithNoRecovery.isReadOnly);
		this.leaveSourceDB.CSSStyles = { 'margin-left': '20px' };
		containers.push(this.leaveSourceDB);

		// Tail log backup file
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.TailLogBackupFileText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth - 20,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogBackupFile.defaultValue
		};
		this.tailLogBackupFile = this.createInputBox(async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogBackupFile.currentValue = newValue;
		}, props);
		const tailLogBackupFileContainer = this.createLabelInputContainer(localizedConstants.TailLogBackupFileText, this.tailLogBackupFile);
		tailLogBackupFileContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(tailLogBackupFileContainer);

		return this.createGroup(localizedConstants.RestoreTailLogBackupText, containers, true);
	}

	private initializeServerConnectionsSection(): azdata.GroupContainer {
		// Close existing server connections to destination database
		this.closeExistingConnections = this.createCheckbox(localizedConstants.CloseExistingConnectionText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.closeExistingConnections.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.closeExistingConnections.defaultValue);

		return this.createGroup(localizedConstants.RestoreServerConnectionsOptionsText, [this.closeExistingConnections], true);
	}

	/**
	 * Enable/disable the restore options based on the recovery state option
	 * @param recoveryStateOption recovery state option
	 */
	private toggleRestoreOptionsOnRecoveryStateOptions(recoveryStateOption: string): void {
		let preserveReplicationSettingsEnableState = true;
		let standByFileEnableState = false;
		// Option - Restore with NoRecovery
		if (recoveryStateOption === this.viewInfo.restoreDatabaseInfo.recoveryStateOptions[1].displayName) {
			preserveReplicationSettingsEnableState = false;
		}
		// Option - Restore with standby
		else if (recoveryStateOption === this.viewInfo.restoreDatabaseInfo.recoveryStateOptions[2].displayName) {
			standByFileEnableState = true;
		}

		this.preserveReplicationSettings.enabled = preserveReplicationSettingsEnableState;
		this.standByFileInput.enabled = standByFileEnableState;
	}
	//#endregion
}
