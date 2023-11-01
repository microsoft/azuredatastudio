/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../localizedConstants';
import * as localizedConstants from '../localizedConstants';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth, DefaultMaxTableRowCount, DefaultMinTableRowCount, DefaultTableWidth, getTableHeight } from '../../ui/dialogBase';
import { Database, DatabaseFileInfo, DatabaseViewInfo } from '../interfaces';
import { IObjectManagementService } from 'mssql';

const Dialog_Width = '750px';
const RestoreInputsWidth = DefaultInputWidth + 250;

export class RestoreDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// restore diaog tabs
	private generalTab: azdata.Tab;
	private filesTab: azdata.Tab;
	private optionsTab: azdata.Tab;
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
	private takeTailLogBackup: azdata.CheckBoxComponent;
	private leaveSourceDB: azdata.CheckBoxComponent;
	private closeExistingConnections: azdata.CheckBoxComponent;
	private restorePlanTable: azdata.TableComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		options.width = Dialog_Width;
		super(objectManagementService, options, loc.RestoreDatabaseDialogTitle(options.database), 'DetachDatabase');
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
				// this.activeTabId = tabId;
			}));
		this.formContainer.addItem(propertiesTabbedPannel);
	}

	protected override get helpUrl(): string {
		throw new Error('Method not implemented.');
	}

	//#region General Tab
	private initializeSourceSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Restore from
		let restoreFrom = this.createDropdown(localizedConstants.RestoreFromText, async (newValue) => {
			if (newValue === localizedConstants.RestoreFromBackupFileOptionText) {
				this.backupFilePathContainer.display = 'inline-flex';
			} else {
				this.backupFilePathContainer.display = 'none';
			}
			// this.objectInfo.collationName = collationDropbox.value as string;
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
		let restoreDatabase = this.createDropdown(localizedConstants.DatabaseText, async () => {
			// this.objectInfo.collationName = collationDropbox.value as string;
		}, this.viewInfo.restoreDatabaseInfo.sourceDatabaseNames, '', true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.DatabaseText, restoreDatabase));

		return this.createGroup(localizedConstants.SourceSectionText, containers, true);
	}

	private initializeDestinationSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];

		let targetDatabase = this.createDropdown(localizedConstants.TargetDatabaseText, async () => {
			// this.objectInfo.collationName = collationDropbox.value as string;
		}, this.viewInfo.restoreDatabaseInfo.targetDatabaseNames, this.objectInfo.name, true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.TargetDatabaseText, targetDatabase));

		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.RestoreToText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth,
			value: this.viewInfo.restoreDatabaseInfo.lastBackupTaken
		};
		let restoreTo = this.createInputBox(async () => { }, props);
		containers.push(this.createLabelInputContainer(localizedConstants.RestoreToText, restoreTo));

		return this.createGroup(localizedConstants.DestinationSectionText, containers, true);
	}

	private initializeRestorePlanSection(): azdata.GroupContainer {
		this.restorePlanTable = this.modelView.modelBuilder.table().withProps({
			columns: [{
				type: azdata.ColumnType.checkBox,
				value: localizedConstants.RestoreText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.ComponentText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.TypeText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.ServerText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.DatabaseText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.PositionText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FirstLSNText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.LastLSNText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.CheckpointLSNText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FullLSNText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.StartDateText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.FinishDateText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.SizeText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.UserNameText
			}, {
				type: azdata.ColumnType.text,
				value: localizedConstants.ExpirationText
			}],
			data: this.objectInfo.restoreOptions.restorePlanResponse.backupSetsToRestore?.map(plan => {
				return this.convertToDataView(plan);
			}),
			height: getTableHeight(this.objectInfo.restoreOptions.restorePlanResponse.backupSetsToRestore?.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: DefaultTableWidth,
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
	//#endregion

	//#region Files Tab
	private initializeRestoreDatabaseFilesSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Relocate all files
		this.relocateAllFiles = this.createCheckbox(localizedConstants.RelocateAllFilesText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.relocateDbFiles.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.relocateDbFiles.defaultValue);
		containers.push(this.relocateAllFiles);

		// Data	File folder
		const dataFileFolder = this.createInputBox(async (newValue) => {
			// this.result.path = newValue;
		}, {
			ariaLabel: localizedConstants.DataFileFolderText,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.dataFileFolder.defaultValue,
			width: RestoreInputsWidth
		});
		containers.push(this.createLabelInputContainer(localizedConstants.DataFileFolderText, dataFileFolder));

		// Log file folder
		const logFileFolder = this.createInputBox(async (newValue) => {
			// this.result.path = newValue;
		}, {
			ariaLabel: localizedConstants.LogFileFolderText,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.logFileFolder.defaultValue,
			width: RestoreInputsWidth
		});
		containers.push(this.createLabelInputContainer(localizedConstants.LogFileFolderText, logFileFolder));
		return this.createGroup(localizedConstants.RestoreDatabaseFilesAsText, containers, true);
	}

	private initializeRestoreDatabaseFilesDetailsSection(): azdata.GroupContainer {
		return this.createGroup(localizedConstants.RestoreDatabaseFileDetailsText, [
		], true);
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
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.recoveryState.currentValue = newValue as string;
		}, this.viewInfo.restoreDatabaseInfo.recoveryStateOptions, this.viewInfo.restoreDatabaseInfo.recoveryStateOptions[0], true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.RecoveryStateText, recoveryState));

		//Stand by file
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.StandbyFileText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.standbyFile.defaultValue
		};
		let restoreTo = this.createInputBox(async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.standbyFile.currentValue = newValue;
		}, props);
		containers.push(this.createLabelInputContainer(localizedConstants.StandbyFileText, restoreTo));

		return this.createGroup(localizedConstants.RestoreOptionsText, containers, true);
	}

	private initializeTailLogBackupSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Take tail-log backup before restore
		this.takeTailLogBackup = this.createCheckbox(localizedConstants.TakeTailLogBackupBeforeRestoreText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.backupTailLog.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.backupTailLog.defaultValue);
		containers.push(this.takeTailLogBackup);

		// leave source database in the restoring state (WITH NORECOVERY)
		this.leaveSourceDB = this.createCheckbox(localizedConstants.LeaveSourceDBText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogWithNoRecovery.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogWithNoRecovery.defaultValue);
		containers.push(this.leaveSourceDB);

		// Tail log backup file
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.TailLogBackupFileText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth,
			value: this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogBackupFile.defaultValue
		};
		let tailLogBackupFile = this.createInputBox(async (newValue) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.tailLogBackupFile.currentValue = newValue;
		}, props);
		containers.push(this.createLabelInputContainer(localizedConstants.TailLogBackupFileText, tailLogBackupFile));

		return this.createGroup(localizedConstants.RestoreTailLogBackupText, containers, true);
	}

	private initializeServerConnectionsSection(): azdata.GroupContainer {
		// Close existing server connections to destination database
		this.closeExistingConnections = this.createCheckbox(localizedConstants.CloseExistingConnectionText, async (checked) => {
			this.objectInfo.restoreOptions.restorePlanResponse.planDetails.closeExistingConnections.currentValue = checked;
		}, this.objectInfo.restoreOptions.restorePlanResponse.planDetails.closeExistingConnections.defaultValue);

		return this.createGroup(localizedConstants.RestoreServerConnectionsOptionsText, [this.closeExistingConnections], true);
	}
	//#endregion
}
