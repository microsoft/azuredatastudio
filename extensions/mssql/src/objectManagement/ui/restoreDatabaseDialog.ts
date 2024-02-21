/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../localizedConstants';
import * as localizedConstants from '../localizedConstants';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth, DefaultMaxTableRowCount, DefaultMinTableRowCount, DefaultTableWidth, getTableHeight } from '../../ui/dialogBase';
import { Database, DatabaseViewInfo } from '../interfaces';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { RestoreDatabaseFilesTabDocUrl, RestoreDatabaseGeneralTabDocUrl, RestoreDatabaseOptionsTabDocUrl } from '../constants';
import { isUndefinedOrNull } from '../../types';
import { MediaDeviceType } from '../constants';
import { S3AddBackupFileDialog } from './S3AddBackupFileDialog';

const Dialog_Width = '1150px';
const RestoreInputsWidth = DefaultInputWidth + 650;
const RestoreTablesWidth = DefaultTableWidth + 650;
const SelectFolderInputWidth = DefaultInputWidth + 600
const SelectFolderButtonWidth = 25;

export class RestoreDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// restore dialog tabs
	private generalTab: azdata.Tab;
	private filesTab: azdata.Tab;
	private optionsTab: azdata.Tab;
	private activeTabId: string;
	private readonly generalTabId: string = 'restoreGeneralDatabaseId';
	private readonly filesTabId: string = 'restoreFilesDatabaseId';
	private readonly optionsTabId: string = 'restoreOptionsDatabaseId';
	private restoreProvider: azdata.RestoreProvider;
	private backupFilePathInput: azdata.DropDownComponent;
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
	private restoreFrom: azdata.DropDownComponent;
	private dataFileFolder: azdata.InputBoxComponent;
	private dataFileFolderButton: azdata.ButtonComponent;
	private dataFileFolderContainer: azdata.FlexContainer;
	private logFileFolder: azdata.InputBoxComponent;
	private logFileFolderButton: azdata.ButtonComponent;
	private logFileFolderContainer: azdata.FlexContainer;
	private targetDatabase: azdata.DropDownComponent;
	private isManagedInstance: boolean;
	private backupFilePath: string = '';
	private backupURLPath: string = '';

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		options.width = Dialog_Width;
		super(objectManagementService, options, loc.RestoreDatabaseDialogTitle, 'RestoreDatabase');
		this.restoreProvider = azdata.dataprotocol.getProvider<azdata.RestoreProvider>('MSSQL', azdata.DataProviderType.RestoreProvider);
		this.dialogObject.okButton.label = localizedConstants.RestoreText;
	}

	protected override get helpUrl(): string {
		return this.restoreDialogDocUrl;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.RestoreDatabaseOperationDisplayName(this.objectInfo.name);
	}

	protected override get isDirty(): boolean {
		return this.objectInfo.restorePlanResponse?.backupSetsToRestore?.filter(plan => plan.isSelected === true).length > 0;
	}

	protected override get opensEditorSeparately(): boolean {
		return true;
	}

	protected override get startTaskOnApply(): boolean {
		return false; // The underlying restore operation in the SQL Tools Service starts its own task separately
	}

	private get restoreDialogDocUrl(): string {
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

		if (!this.isManagedInstance) {
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
		}

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

	/**
	 * Validates the input by custom validations
	 * @returns error messages
	 */
	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();

		// Managed instance doesn't support restoring on the existing database
		if (this.isManagedInstance && this.viewInfo.restoreDatabaseInfo.targetDatabaseNames.includes(this.targetDatabase.value.toString())) {
			errors.push(localizedConstants.DatabaseAlreadyExists(this.targetDatabase.value.toString()));
		}
		return errors;
	}

	/**
	 * Generate the script to restore the selected database or file
	 * @returns Script to restore the database
	 */
	public override async generateScript(): Promise<string> {
		let restoreInfo = this.createRestoreInfo();
		restoreInfo.taskExecutionMode = azdata.TaskExecutionMode.script;
		let response = await this.restoreProvider.restore(this.options.connectionUri, restoreInfo);
		if (!isUndefinedOrNull(response.errorMessage)) {
			throw new Error(response.errorMessage);
		}
		// The restore call will open its own query window, so don't return any script here.
		return undefined;
	}

	/**
	 * Saving changes on Restore button click
	 */
	public override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		let restoreInfo = this.createRestoreInfo();
		restoreInfo.taskExecutionMode = azdata.TaskExecutionMode.execute;
		let response = await this.restoreProvider.restore(this.options.connectionUri, restoreInfo);
		if (!isUndefinedOrNull(response.errorMessage)) {
			throw new Error(response.errorMessage);
		}
	}

	/**
	 * Prepares and returns restore params to restore a database
	 * @returns Restore params
	 */
	private createRestoreInfo(): azdata.RestoreInfo {
		const isRestoreFromBackupFile = this.restoreFrom.value === localizedConstants.RestoreFromBackupFileOptionText;
		const isRestoreFromDatabase = this.restoreFrom.value === localizedConstants.RestoreFromDatabaseOptionText;
		let options: { [key: string]: any } = {};
		Object.entries(this.objectInfo.restorePlanResponse?.planDetails).forEach(([key, value]) => {
			if (value !== null && value.currentValue !== undefined) {
				options[key] = value.currentValue;
			}
		});
		options.sessionId = this.objectInfo.restorePlanResponse.sessionId;
		options.backupFilePaths = this.isManagedInstance || !isRestoreFromDatabase ? this.backupFilePathInput.value : null;
		options.readHeaderFromMedia = this.isManagedInstance || isRestoreFromBackupFile ? true : false;
		options.overwriteTargetDatabase = false;
		options.selectedBackupSets = this.objectInfo.restorePlanResponse?.backupSetsToRestore?.filter(a => a.isSelected).map(a => a.id);
		options.deviceType = this.getRestoreMediaDeviceType();
		options.targetDatabaseName = this.targetDatabase.value;

		const restoreInfo: azdata.RestoreInfo = {
			options: options
		};

		return restoreInfo;
	}

	//#region General Tab
	private initializeSourceSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];

		// Managed instance only supports URL mode, so disable unusable fields
		this.isManagedInstance = this.viewInfo.isManagedInstance;

		// Restore from
		const restoreFromDropdownOptions = this.isManagedInstance ? [localizedConstants.RestoreFromUrlText, localizedConstants.RestoreFromS3UrlText] : [localizedConstants.RestoreFromDatabaseOptionText, localizedConstants.RestoreFromBackupFileOptionText, localizedConstants.RestoreFromUrlText, localizedConstants.RestoreFromS3UrlText];
		this.restoreFrom = this.createDropdown(localizedConstants.RestoreFromText, async (newValue) => {
			if (newValue === localizedConstants.RestoreFromBackupFileOptionText || newValue === localizedConstants.RestoreFromUrlText) {
				this.backupFilePathContainer.display = 'inline-flex';
				this.restoreDatabase.enabled = false;
				this.backupFilePathInput.enabled = false;
				const path = newValue === localizedConstants.RestoreFromUrlText ? this.backupURLPath : this.backupFilePath;
				await this.backupFilePathInput.updateProperties({
					value: path,
					values: [path]
				});
			} else if (newValue === localizedConstants.RestoreFromDatabaseOptionText) {
				this.backupFilePathContainer.display = 'none';
				this.restoreDatabase.enabled = true;
			} else if (newValue === localizedConstants.RestoreFromS3UrlText) {
				this.backupFilePathInput.enabled = true;
				this.backupFilePathContainer.display = 'inline-flex';
				this.restoreDatabase.enabled = false;
				const credentials = (await this.objectManagementService.getCredentialNames(this.options.connectionUri)).filter(url => url.startsWith('s3://'));
				credentials.unshift('');
				await this.backupFilePathInput.updateProperties({
					value: '',
					values: credentials
				});
			}
			await this.updateNewRestorePlanToDialog();
		}, restoreFromDropdownOptions, restoreFromDropdownOptions[0], !this.isManagedInstance, RestoreInputsWidth);
		containers.push(this.createLabelInputContainer(localizedConstants.RestoreFromText, this.restoreFrom));

		// Backup file path
		this.backupFilePathInput = this.createDropdown(localizedConstants.BackupFilePathText, async (newValue) => {
			await this.updateNewRestorePlanToDialog();
		}, [''], localizedConstants.BackupFolderPathTitle, false, RestoreInputsWidth - 30, false, true)

		this.backupFilePathButton = this.createButton('...', localizedConstants.BrowseFilesLabel, async () => {
			switch (this.restoreFrom.value) {
				case localizedConstants.RestoreFromUrlText:
					await this.createBackupUrlFileBrowser();
					break;
				case localizedConstants.RestoreFromBackupFileOptionText:
					await this.createBackupFileBrowser();
					break;
				case localizedConstants.RestoreFromS3UrlText:
					await this.createRestoreS3Url();
					break;
			}
			await this.updateNewRestorePlanToDialog();
		});
		this.backupFilePathButton.width = SelectFolderButtonWidth;
		this.backupFilePathContainer = this.createLabelInputContainer(localizedConstants.BackupFilePathText, this.backupFilePathInput);
		this.backupFilePathContainer.addItems([this.backupFilePathButton], { flex: '10 0 auto' });
		this.backupFilePathContainer.display = this.isManagedInstance ? 'inline-flex' : 'none';
		containers.push(this.backupFilePathContainer);

		// source Database
		this.restoreDatabase = this.isManagedInstance ?
			this.createDropdown(localizedConstants.DatabaseText, async () => { }, [], '', false, RestoreInputsWidth - 20, false, false)
			: this.createDropdown(localizedConstants.DatabaseText, async (newValue) => {
				if (this.restoreFrom.value !== localizedConstants.RestoreFromUrlText) {
					this.objectInfo.restorePlanResponse.planDetails.sourceDatabaseName.currentValue = newValue;
					this.targetDatabase.value = newValue;
					await this.updateNewRestorePlanToDialog();
				}
			}, this.viewInfo.restoreDatabaseInfo.sourceDatabaseNames, this.objectInfo.restorePlanResponse?.planDetails.sourceDatabaseName.currentValue, true, RestoreInputsWidth, false);
		const restoreDatabaseContainer = this.createLabelInputContainer(localizedConstants.DatabaseText, this.restoreDatabase);
		restoreDatabaseContainer.CSSStyles = { 'margin-left': this.isManagedInstance ? '20px' : '0px' };
		containers.push(restoreDatabaseContainer);

		return this.createGroup(localizedConstants.SourceSectionText, containers, true);
	}

	private initializeDestinationSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// target database
		this.targetDatabase = this.createDropdown(this.isManagedInstance ? localizedConstants.DatabaseText : localizedConstants.TargetDatabaseText, async (newValue) => {
			if (this.objectInfo.restorePlanResponse !== null) {
				this.objectInfo.restorePlanResponse.planDetails.targetDatabaseName.currentValue = newValue;
			}
			this.objectInfo.name = newValue;
		}, this.viewInfo.restoreDatabaseInfo.targetDatabaseNames, this.objectInfo.restorePlanResponse?.planDetails.targetDatabaseName.currentValue, true, RestoreInputsWidth, true, false);
		this.targetDatabase.fireOnTextChange = true;
		this.targetDatabase.required = true;
		containers.push(this.createLabelInputContainer(this.isManagedInstance ? localizedConstants.DatabaseText : localizedConstants.TargetDatabaseText, this.targetDatabase));

		// restore to
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.RestoreToText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth,
			value: this.objectInfo.restorePlanResponse?.planDetails.lastBackupTaken.currentValue
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
			data: this.objectInfo.restorePlanResponse?.backupSetsToRestore?.map(plan => {
				return this.convertRestorePlanObjectToDataView(plan);
			}),
			height: getTableHeight(this.objectInfo.restorePlanResponse?.backupSetsToRestore?.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
			width: RestoreTablesWidth,
			forceFitColumns: azdata.ColumnSizingMode.DataFit,
			CSSStyles: {
				'margin-left': '10px'
			}
		}).component();
		this.disposables.push(
			this.restorePlanTable.onCellAction(async (arg: azdata.ICheckboxCellActionEventArgs) => {
				let backupSets = this.objectInfo.restorePlanResponse?.backupSetsToRestore;
				if (arg.checked) {
					for (let i = arg.row; i >= 0; i--) {
						backupSets[i].isSelected = arg.checked;
					}
				} else {
					for (let i = arg.row; i < backupSets.length; i++) {
						backupSets[i].isSelected = arg.checked;
					}
				}

				// Refresh the table with updated data
				const newData = backupSets?.map(plan => {
					return this.convertRestorePlanObjectToDataView(plan);
				});
				await this.setTableData(this.restorePlanTable, newData);
				this.onFormFieldChange();
			})
		);
		return this.createGroup(localizedConstants.RestorePlanSectionText, [this.restorePlanTable], true);
	}

	/**
	 * Converts the database file info object to a data view object
	 * @param fileInfo database file info object
	 * @returns data view object
	 */
	private convertRestorePlanObjectToDataView(fileInfo: azdata.DatabaseFileInfo): any[] {
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
	 * Creates a file browser and sets the path to the backup filePath
	 */
	private async createBackupFileBrowser(): Promise<void> {
		let backupFolder = await this.objectManagementService.getBackupFolder(this.options.connectionUri);
		let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, backupFolder, [{ label: localizedConstants.allFiles, filters: ['*.bak'] }]);
		if (filePath?.length > 0) {
			this.backupFilePath = filePath;
			await this.backupFilePathInput.updateProperties({
				value: this.backupFilePath,
				values: [this.backupFilePath]
			});
		}
	}

	/**
	 * Creates a file browser and sets the path to the data folder Path
	 */
	private async createDataFileBrowser(input: azdata.InputBoxComponent): Promise<void> {
		let dataFolder = await this.objectManagementService.getDataFolder(this.options.connectionUri);
		let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, dataFolder, [{ label: localizedConstants.allFiles, filters: [] }], true);
		if (filePath?.length > 0) {
			input.value = filePath;
		}
	}

	/**
	 * Creates a file browser and sets the path to the backup url Path
	 */
	private async createBackupUrlFileBrowser(): Promise<void> {
		let backupPath = await azdata.window.openBackupUrlBrowserDialog(this.options.connectionUri, '', true);
		if (backupPath && !backupPath.includes('undefined')) {
			this.backupURLPath = backupPath;
			await this.backupFilePathInput.updateProperties({
				value: this.backupURLPath,
				values: [this.backupURLPath]
			});
		}
	}

	/**
	 * Creates a file browser and sets the path to the backup url Path
	 */
	private async createRestoreS3Url(): Promise<void> {
		const dialog = new S3AddBackupFileDialog(this.objectManagementService, this.options.connectionUri);
		await dialog.open();
		let result = await dialog.waitForClose()
		if (result) {
			this.backupURLPath = result.backupFilePath;
			const options = this.backupFilePathInput.values.map(s => s.toString());
			options.push(this.backupURLPath);
			await this.backupFilePathInput.updateProperties({
				value: this.backupURLPath,
				values: options
			});
		}
	}

	/**
	 * Gets current media devide type for database/backupFile or URL types
	 * @returns Media device type
	 */
	private getRestoreMediaDeviceType(): MediaDeviceType {
		return this.restoreFrom.value === localizedConstants.RestoreFromBackupFileOptionText ? MediaDeviceType.File : MediaDeviceType.Url;
	}

	/**
	 * Get the new restore plan and updates the dialog properties
	 */
	private async updateNewRestorePlanToDialog(): Promise<void> {
		this.dialogObject.loading = true;
		try {
			// Get the new restore plan for the selected file
			const restorePlanInfo = this.setRestoreOption();
			const restorePlan = await this.restoreProvider.getRestorePlan(this.options.connectionUri, restorePlanInfo);

			// Update the dialog values with the new restore plan
			await this.updateRestoreDialog(restorePlan);
		} finally {
			this.dialogObject.loading = false;
		}
	}

	/**
	 * Prepares the restore params to get restore plan for the selected source database
	 * @returns restore params
	 */
	private setRestoreOption(): azdata.RestoreInfo {
		const restoreFromDatabase = this.restoreFrom.value === localizedConstants.RestoreFromDatabaseOptionText;
		let options = {
			targetDatabaseName: this.objectInfo.restorePlanResponse?.planDetails?.targetDatabaseName?.currentValue,
			sourceDatabaseName: restoreFromDatabase ? this.objectInfo.restorePlanResponse?.planDetails?.sourceDatabaseName?.currentValue : null,
			relocateDbFiles: this.objectInfo.restorePlanResponse?.planDetails?.relocateDbFiles?.currentValue,
			readHeaderFromMedia: restoreFromDatabase ? false : true,
			overwriteTargetDatabase: true,
			backupFilePaths: restoreFromDatabase ? null : this.backupFilePathInput.value,
			deviceType: this.getRestoreMediaDeviceType()
		};

		const restoreInfo: azdata.RestoreInfo = {
			taskExecutionMode: azdata.TaskExecutionMode.execute,
			options: options
		};

		return restoreInfo;
	}

	/**
	 * Updates the restore dialog with the latest restore plan details
	 */
	private async updateRestoreDialog(restorePlan: azdata.RestorePlanResponse): Promise<void> {
		// Update the objectInfo restore plan details with the new restore plan
		this.objectInfo.restorePlanResponse = restorePlan;

		// Update Source database name
		// If restoring from URL or File, cannot select any other database as source, but can select different database when restoring from a database
		if (this.restoreFrom.value === localizedConstants.RestoreFromDatabaseOptionText) {
			await this.restoreDatabase.updateProperties({
				values: this.viewInfo.restoreDatabaseInfo.sourceDatabaseNames,
				value: restorePlan.planDetails?.sourceDatabaseName?.currentValue
			});
		} else {
			let sourceDB = restorePlan.planDetails?.sourceDatabaseName?.currentValue ?? '';
			await this.restoreDatabase.updateProperties({
				values: [sourceDB],
				value: sourceDB
			});
		}

		// Update Restore Plan table
		var restoreTableNewdata = restorePlan?.backupSetsToRestore?.map(plan => {
			return this.convertRestorePlanObjectToDataView(plan);
		});
		await this.setTableData(this.restorePlanTable, restoreTableNewdata, DefaultMaxTableRowCount);

		// Reset Restore to
		await this.restoreTo.updateProperty('value', restorePlan.planDetails.lastBackupTaken.currentValue);

		if (!this.isManagedInstance) {
			// Update Restore Database Files table
			var restoreDatabaseTableNewdata = restorePlan.dbFiles?.map(plan => {
				return this.convertToRestoreDbTableDataView(plan);
			});
			await this.setTableData(this.restoreDatabaseTable, restoreDatabaseTableNewdata, DefaultMaxTableRowCount);

			// Reset Relocate all files checkbox
			this.relocateAllFiles.checked = restorePlan.planDetails.relocateDbFiles.defaultValue;
			this.relocateAllFiles.enabled = !restorePlan.planDetails.relocateDbFiles.isReadOnly;

			// Reset Stanby
			await this.standByFileInput.updateProperty('value', restorePlan.planDetails.standbyFile.defaultValue);

			// Reset tail-log backup checkbox
			this.takeTailLogBackup.checked = restorePlan.planDetails.backupTailLog.defaultValue;
			this.takeTailLogBackup.enabled = !restorePlan.planDetails.backupTailLog.isReadOnly;

			// Reset leave source db checkbox
			this.leaveSourceDB.checked = restorePlan.planDetails.tailLogWithNoRecovery.defaultValue;
			this.leaveSourceDB.enabled = !restorePlan.planDetails.tailLogWithNoRecovery.isReadOnly;

			// Reset Tail-log backup file
			await this.tailLogBackupFile.updateProperty('value', restorePlan.planDetails.tailLogBackupFile.defaultValue);

			// Server connection
			this.closeExistingConnections.checked = restorePlan.planDetails.closeExistingConnections.defaultValue;
			this.closeExistingConnections.enabled = !restorePlan.planDetails.closeExistingConnections.isReadOnly;
		}
	}
	//#endregion

	//#region Files Tab
	private initializeRestoreDatabaseFilesSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Relocate all files
		this.relocateAllFiles = this.createCheckbox(localizedConstants.RelocateAllFilesText, async (checked) => {
			this.objectInfo.restorePlanResponse.planDetails.relocateDbFiles.currentValue = checked;
			this.dataFileFolder.enabled
				= this.logFileFolder.enabled
				= this.dataFileFolderButton.enabled
				= this.logFileFolderButton.enabled = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.relocateDbFiles.defaultValue, !this.objectInfo.restorePlanResponse.planDetails.relocateDbFiles.isReadOnly);
		containers.push(this.relocateAllFiles);

		// Data	File folder
		this.dataFileFolder = this.createInputBox(async (newValue) => {
			this.objectInfo.restorePlanResponse.planDetails.dataFileFolder.currentValue = newValue;
		}, {
			ariaLabel: localizedConstants.DataFileFolderText,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.restorePlanResponse.planDetails.dataFileFolder.defaultValue,
			width: SelectFolderInputWidth
		});
		this.dataFileFolderButton = this.createButton('...', localizedConstants.BrowseFilesLabel, async () => { await this.createDataFileBrowser(this.dataFileFolder) });
		this.dataFileFolderButton.width = SelectFolderButtonWidth;
		this.dataFileFolderButton.enabled = false;
		this.dataFileFolderContainer = this.createLabelInputContainer(localizedConstants.DataFileFolderText, this.dataFileFolder);
		this.dataFileFolderContainer.addItems([this.dataFileFolderButton], { flex: '10 0 auto' });
		this.dataFileFolderContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(this.dataFileFolderContainer);

		// Log file folder
		this.logFileFolder = this.createInputBox(async (newValue) => {
			this.objectInfo.restorePlanResponse.planDetails.logFileFolder.currentValue = newValue;
		}, {
			ariaLabel: localizedConstants.LogFileFolderText,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.restorePlanResponse.planDetails.logFileFolder.defaultValue,
			width: SelectFolderInputWidth
		});
		this.logFileFolderButton = this.createButton('...', localizedConstants.BrowseFilesLabel, async () => { await this.createDataFileBrowser(this.logFileFolder) });
		this.logFileFolderButton.width = SelectFolderButtonWidth;
		this.logFileFolderButton.enabled = false;
		this.logFileFolderContainer = this.createLabelInputContainer(localizedConstants.LogFileFolderText, this.logFileFolder);
		this.logFileFolderContainer.addItems([this.logFileFolderButton], { flex: '10 0 auto' });
		this.logFileFolderContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(this.logFileFolderContainer);

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
			data: this.objectInfo.restorePlanResponse.dbFiles?.map(plan => {
				return this.convertToRestoreDbTableDataView(plan);
			}),
			height: getTableHeight(this.objectInfo.restorePlanResponse.dbFiles?.length, DefaultMinTableRowCount, DefaultMaxTableRowCount),
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
	private convertToRestoreDbTableDataView(fileInfo: azdata.RestoreDatabaseFileInfo): any[] {
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
			this.objectInfo.restorePlanResponse.planDetails.replaceDatabase.currentValue = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.replaceDatabase.defaultValue);
		containers.push(this.overwriteExistingDatabase);

		// Preserve the replication settings (WITH KEEP_REPLICATION)
		this.preserveReplicationSettings = this.createCheckbox(localizedConstants.PreserveReplicationSettingsText, async (checked) => {
			this.objectInfo.restorePlanResponse.planDetails.keepReplication.currentValue = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.keepReplication.defaultValue);
		containers.push(this.preserveReplicationSettings);

		// Restrict access to the restored database (WITH RESTRICTED_USER)
		this.restrictAccessToRestoredDB = this.createCheckbox(localizedConstants.RestrictAccessToRestoredDBText, async (checked) => {
			this.objectInfo.restorePlanResponse.planDetails.setRestrictedUser.currentValue = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.setRestrictedUser.defaultValue);
		containers.push(this.restrictAccessToRestoredDB);

		// Recovery state
		let recoveryState = this.createDropdown(localizedConstants.RecoveryStateText, async (newValue) => {
			this.toggleRestoreOptionsOnRecoveryStateOptions(newValue as string);
			this.objectInfo.restorePlanResponse.planDetails.recoveryState.currentValue = this.viewInfo.restoreDatabaseInfo.recoveryStateOptions.find(a => a.displayName === newValue).name as string;
		}, this.viewInfo.restoreDatabaseInfo.recoveryStateOptions.map(a => a.displayName)
			, this.viewInfo.restoreDatabaseInfo.recoveryStateOptions.find(a => a.name === this.objectInfo.restorePlanResponse.planDetails.recoveryState.defaultValue).displayName
			, true, RestoreInputsWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.RecoveryStateText, recoveryState));

		// Stand by file
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.StandbyFileText,
			required: false,
			enabled: false,
			width: RestoreInputsWidth - 20,
			value: this.objectInfo.restorePlanResponse.planDetails.standbyFile.defaultValue
		};
		this.standByFileInput = this.createInputBox(async (newValue) => {
			this.objectInfo.restorePlanResponse.planDetails.standbyFile.currentValue = newValue;
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
			this.objectInfo.restorePlanResponse.planDetails.backupTailLog.currentValue = checked;
			this.leaveSourceDB.enabled = checked;
			this.tailLogBackupFile.enabled = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.backupTailLog.defaultValue, !this.objectInfo.restorePlanResponse.planDetails.backupTailLog.isReadOnly);
		containers.push(this.takeTailLogBackup);

		// leave source database in the restoring state (WITH NORECOVERY)
		this.leaveSourceDB = this.createCheckbox(localizedConstants.LeaveSourceDBText, async (checked) => {
			this.objectInfo.restorePlanResponse.planDetails.tailLogWithNoRecovery.currentValue = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.tailLogWithNoRecovery.defaultValue, !this.objectInfo.restorePlanResponse.planDetails.tailLogWithNoRecovery.isReadOnly);
		this.leaveSourceDB.CSSStyles = { 'margin-left': '20px' };
		containers.push(this.leaveSourceDB);

		// Tail log backup file
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.TailLogBackupFileText,
			required: false,
			enabled: true,
			width: RestoreInputsWidth - 20,
			value: this.objectInfo.restorePlanResponse.planDetails.tailLogBackupFile.defaultValue
		};
		this.tailLogBackupFile = this.createInputBox(async (newValue) => {
			this.objectInfo.restorePlanResponse.planDetails.tailLogBackupFile.currentValue = newValue;
		}, props);
		const tailLogBackupFileContainer = this.createLabelInputContainer(localizedConstants.TailLogBackupFileText, this.tailLogBackupFile);
		tailLogBackupFileContainer.CSSStyles = { 'margin-left': '20px' };
		containers.push(tailLogBackupFileContainer);

		return this.createGroup(localizedConstants.RestoreTailLogBackupText, containers, true);
	}

	private initializeServerConnectionsSection(): azdata.GroupContainer {
		// Close existing server connections to destination database
		this.closeExistingConnections = this.createCheckbox(localizedConstants.CloseExistingConnectionText, async (checked) => {
			this.objectInfo.restorePlanResponse.planDetails.closeExistingConnections.currentValue = checked;
		}, this.objectInfo.restorePlanResponse.planDetails.closeExistingConnections.defaultValue);

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
