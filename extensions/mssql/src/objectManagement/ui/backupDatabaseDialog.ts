/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { BackupInfo, IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { BackupDatabaseDocUrl } from '../constants';
import * as loc from '../localizedConstants';
import { DefaultButtonWidth, DefaultInputWidth, DefaultLongInputWidth, DefaultMinTableRowCount, DialogButton, getTableHeight } from '../../ui/dialogBase';
import { isUndefinedOrNull } from '../../types';
import { TaskExecutionMode } from 'azdata';
import { getErrorMessage } from '../../utils';
import { PhysicalDeviceType, MediaDeviceType } from '../constants';

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private readonly _fileFilters: azdata.window.FileFilters[] = [{ label: loc.BackupFilesLabel, filters: ['*.bak', '*.tm'] }];
	private _backupFilePaths: string[] = [];

	private _backupSetNameInput: azdata.InputBoxComponent;
	private _backupTypeDropdown: azdata.DropDownComponent;
	private _copyBackupCheckbox: azdata.CheckBoxComponent;
	private _backupDestDropdown: azdata.DropDownComponent;
	private _backupFilesTable: azdata.TableComponent;
	private _filesTableContainer: azdata.FlexContainer;
	private _backupUrlInput: azdata.InputBoxComponent;
	private _urlInputContainer: azdata.FlexContainer;

	private _existingMediaButton: azdata.RadioButtonComponent;
	private _appendExistingMediaButton: azdata.RadioButtonComponent;
	private _overwriteExistingMediaButton: azdata.RadioButtonComponent;

	private _newMediaButton: azdata.RadioButtonComponent;
	private _mediaNameInput: azdata.InputBoxComponent;
	private _mediaDescriptionInput: azdata.InputBoxComponent;

	private _verifyCheckbox: azdata.CheckBoxComponent;
	private _checksumCheckbox: azdata.CheckBoxComponent;
	private _continueOnErrorCheckbox: azdata.CheckBoxComponent;

	private _truncateLogButton: azdata.RadioButtonComponent;
	private _backupLogTailButton: azdata.RadioButtonComponent;

	private _compressionTypeDropdown: azdata.DropDownComponent;

	private _encryptCheckbox: azdata.CheckBoxComponent;
	private _algorithmDropdown?: azdata.DropDownComponent;
	private _encryptorDropdown?: azdata.DropDownComponent;

	private _defaultBackupFolderPath: string;
	private _defaultBackupPathSeparator: string;
	private _encryptorOptions: string[];

	/**
	 * Keeps track of the previous Backup Destination so that we don't reload controls
	 * unnecessarily when the user clicks on the same value in the Destination dropdown.
	 */
	private _oldDestination: string;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		// Increase dialog width since there are a lot of indented controls in the backup dialog
		options.width = '550px';
		super(objectManagementService, options, loc.BackupDatabaseDialogTitle(options.database), 'BackupDatabase');
		this.dialogObject.okButton.label = loc.BackupButtonLabel;
	}

	protected override get helpUrl(): string {
		return BackupDatabaseDocUrl;
	}

	protected override get isDirty(): boolean {
		let pathsPresent = this.useUrlMode ? this._backupUrlInput.value?.length > 0 : this._backupFilePaths?.length > 0;
		return pathsPresent && this._backupSetNameInput?.value?.length > 0;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.BackupDatabaseOperationDisplayName(this.objectInfo.name);
	}

	protected override get opensEditorSeparately(): boolean {
		return true;
	}

	protected override get startTaskOnApply(): boolean {
		return false; // The underlying backup operation in the SQL Tools Service starts its own task separately
	}

	private get encryptionSupported(): boolean {
		return this._encryptorOptions.length > 0;
	}

	private get useUrlMode(): boolean {
		if (this._backupDestDropdown) {
			return this._backupDestDropdown.value === loc.BackupUrlLabel;
		} else {
			return this.viewInfo.isManagedInstance;
		}
	}

	protected override async initializeUI(): Promise<void> {
		this._defaultBackupFolderPath = await this.objectManagementService.getBackupFolder(this.options.connectionUri);
		this._defaultBackupPathSeparator = this._defaultBackupFolderPath[0] === '/' ? '/' : '\\';
		this._encryptorOptions = this.getEncryptorOptions();

		let generalSection = await this.initializeGeneralSection();
		let optionsSection = this.initializeOptionsSection();

		this.formContainer.addItems([generalSection, optionsSection]);
	}

	private async initializeGeneralSection(): Promise<azdata.GroupContainer> {
		// Managed instance only supports URL mode, so disable unusable fields
		let isManaged = this.viewInfo.isManagedInstance;

		let components: azdata.Component[] = [];
		const backupTypes = [loc.BackupFull];
		if (this.objectInfo.name !== 'master') {
			backupTypes.push(loc.BackupDifferential);
			if (this.objectInfo.recoveryModel !== loc.RecoveryModelSimple) {
				backupTypes.push(loc.BackupTransactionLog);
			}
		}

		let defaultName = this.getDefaultBackupName();
		this._backupSetNameInput = this.createInputBox(() => undefined, {
			ariaLabel: defaultName,
			inputType: 'text',
			enabled: true,
			value: defaultName,
			width: DefaultInputWidth
		});
		let backupInputContainer = this.createLabelInputContainer(loc.BackupNameLabel, this._backupSetNameInput);
		components.push(backupInputContainer);

		// Recovery Model field is always disabled since it's a database setting
		let recoveryModelInput = this.createInputBox(() => undefined, {
			ariaLabel: this.objectInfo.recoveryModel,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.recoveryModel,
			width: DefaultInputWidth
		});
		let recoveryInputContainer = this.createLabelInputContainer(loc.BackupRecoveryLabel, recoveryModelInput);
		components.push(recoveryInputContainer);

		this._backupTypeDropdown = this.createDropdown(loc.BackupTypeLabel, async newValue => {
			if (newValue === loc.BackupTransactionLog) {
				this._truncateLogButton.enabled = true;
				this._backupLogTailButton.enabled = true;
			} else {
				this._truncateLogButton.enabled = false;
				this._backupLogTailButton.enabled = false;
			}
		}, backupTypes, backupTypes[0], !isManaged);
		let backupContainer = this.createLabelInputContainer(loc.BackupTypeLabel, this._backupTypeDropdown);
		components.push(backupContainer);

		this._copyBackupCheckbox = this.createCheckbox(loc.BackupCopyLabel, () => undefined, isManaged, !isManaged);
		components.push(this._copyBackupCheckbox);

		// Managed instance only supports URL mode, so lock the dest dropdown in that case
		const backupDestinations = [loc.BackupDiskLabel, loc.BackupUrlLabel];
		let defaultDest = isManaged ? backupDestinations[1] : backupDestinations[0];
		this._oldDestination = defaultDest;
		this._backupDestDropdown = this.createDropdown(loc.BackupToLabel, newValue => this.toggleBackupDestination(newValue), backupDestinations, defaultDest, !isManaged);
		let backupDestContainer = this.createLabelInputContainer(loc.BackupToLabel, this._backupDestDropdown);
		components.push(backupDestContainer);

		// URL input box for Backup to URL mode
		this._backupUrlInput = this.createInputBox(() => undefined, {
			inputType: 'text',
			width: DefaultLongInputWidth
		});
		let browseUrlButton = this.createButton(loc.BrowseText, loc.BrowseText, () => this.onBrowseUrlButtonClicked());
		browseUrlButton.width = DefaultButtonWidth;
		await browseUrlButton.updateCssStyles({ 'margin-left': '0px' });
		let urlInputGroup = this.createGroup(loc.BackupToUrlLabel, [this._backupUrlInput, browseUrlButton], false);

		this._urlInputContainer = this.modelView.modelBuilder.flexContainer().withItems([urlInputGroup]).component();
		await this._urlInputContainer.updateCssStyles({ 'flex-flow': 'column' });
		components.push(this._urlInputContainer);

		// Files table and associated buttons for Backup to Disk mode
		let defaultPath = `${this._defaultBackupFolderPath}${this._defaultBackupPathSeparator}${defaultName}.bak`;
		this._backupFilePaths.push(defaultPath);
		this._backupFilesTable = this.createTable(loc.BackupFilesLabel, [loc.BackupFilesLabel], [[defaultPath]]);

		let addButton: DialogButton = {
			buttonAriaLabel: loc.AddBackupFileAriaLabel,
			buttonHandler: async () => await this.onAddFilesButtonClicked()
		};
		let removeButton: DialogButton = {
			buttonAriaLabel: loc.RemoveBackupFileAriaLabel,
			buttonHandler: async () => await this.onRemoveFilesButtonClicked()
		};
		let buttonContainer = this.addButtonsForTable(this._backupFilesTable, addButton, removeButton);

		this._filesTableContainer = this.modelView.modelBuilder.flexContainer().withItems([this._backupFilesTable, buttonContainer]).component();
		await this._filesTableContainer.updateCssStyles({ 'flex-flow': 'column' });
		components.push(this._filesTableContainer);

		// Hide URL input or Files table depending on backup destination mode
		if (this.useUrlMode) {
			this._filesTableContainer.display = 'none';
		} else {
			this._urlInputContainer.display = 'none';
		}

		return this.createGroup(loc.GeneralSectionHeader, components, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		// Media options
		// Options for overwriting existing media
		const existingGroupId = 'BackupExistingMedia';
		this._appendExistingMediaButton = this.createRadioButton(loc.AppendToExistingBackup, existingGroupId, true, () => undefined, !this.useUrlMode);
		this._overwriteExistingMediaButton = this.createRadioButton(loc.OverwriteExistingBackups, existingGroupId, false, () => undefined, !this.useUrlMode);

		// Options for writing to new media
		this._mediaNameInput = this.createInputBox(() => undefined, { enabled: false });
		let mediaSetContainer = this.createLabelInputContainer(loc.BackupNewMediaName, this._mediaNameInput);
		this._mediaDescriptionInput = this.createInputBox(() => undefined, { enabled: false });
		let mediaDescriptionContainer = this.createLabelInputContainer(loc.BackupNewMediaDescription, this._mediaDescriptionInput);
		let newMediaButtonsGroup = this.createGroup('', [mediaSetContainer, mediaDescriptionContainer]);

		// Overall button that selects overwriting existing media - enabled by default
		const overwriteGroupId = 'BackupOverwriteMedia';
		this._existingMediaButton = this.createRadioButton(loc.BackupToExistingMedia, overwriteGroupId, true, async checked => {
			if (checked && !this.useUrlMode) {
				this._appendExistingMediaButton.enabled = true;
				this._overwriteExistingMediaButton.enabled = true;

				this._mediaNameInput.enabled = false;
				this._mediaDescriptionInput.enabled = false;

				if (this.encryptionSupported) {
					this._encryptCheckbox.enabled = false;
					this._algorithmDropdown.enabled = false;
					this._encryptorDropdown.enabled = false;
				}
			}
		}, !this.useUrlMode);
		let existingMediaButtonsGroup = this.createGroup('', [this._appendExistingMediaButton, this._overwriteExistingMediaButton]);

		// Overall button that selects writing to new media
		this._newMediaButton = this.createRadioButton(loc.BackupAndEraseExisting, overwriteGroupId, false, async checked => {
			if (checked && !this.useUrlMode) {
				this._appendExistingMediaButton.enabled = false;
				this._overwriteExistingMediaButton.enabled = false;

				this._mediaNameInput.enabled = true;
				this._mediaDescriptionInput.enabled = true;

				if (this.encryptionSupported) {
					this._encryptCheckbox.enabled = true;
					if (this._encryptCheckbox.checked) {
						this._algorithmDropdown.enabled = true;
						this._encryptorDropdown.enabled = true;
					}
				}
			}
		}, !this.useUrlMode);

		let overwriteGroup = this.createGroup(loc.BackupOverwriteMediaLabel, [
			this._existingMediaButton,
			existingMediaButtonsGroup,
			this._newMediaButton,
			newMediaButtonsGroup
		], false);

		// Reliability
		this._verifyCheckbox = this.createCheckbox(loc.VerifyBackupWhenFinished, () => undefined);
		this._checksumCheckbox = this.createCheckbox(loc.BackupPerformChecksum, () => undefined);
		this._continueOnErrorCheckbox = this.createCheckbox(loc.BackupContinueOnError, () => undefined);

		let reliabilityGroup = this.createGroup(loc.BackupReliabilityLabel, [this._verifyCheckbox, this._checksumCheckbox, this._continueOnErrorCheckbox], false);

		// Transaction log
		// Only should be enabled if backup type is Transaction Log
		let transactionComponents = [];
		const transactionGroupId = 'BackupTransactionLog';
		this._truncateLogButton = this.createRadioButton(loc.BackupTruncateLog, transactionGroupId, true, () => undefined, false);
		transactionComponents.push(this._truncateLogButton);

		this._backupLogTailButton = this.createRadioButton(loc.BackupLogTail, transactionGroupId, false, () => undefined, false);
		transactionComponents.push(this._backupLogTailButton);

		let transactionDescription = this.modelView.modelBuilder.text().withProps({ value: loc.TransactionLogNotice }).component();
		transactionComponents.push(transactionDescription);

		let transactionGroup = this.createGroup(loc.BackupTransactionLog, transactionComponents, false);

		// Compression
		let compressionValues = [loc.BackupDefaultSetting, loc.CompressBackup, loc.DontCompressBackup];
		this._compressionTypeDropdown = this.createDropdown(loc.BackupSetCompression, () => undefined, compressionValues, compressionValues[0]);
		let compressionContainer = this.createLabelInputContainer(loc.BackupSetCompression, this._compressionTypeDropdown);
		let compressionGroup = this.createGroup(loc.BackupCompressionLabel, [compressionContainer], false);

		// Encryption
		let encryptionComponents: azdata.Component[] = [];
		this._encryptCheckbox = this.createCheckbox(loc.EncryptBackup, async checked => {
			if (this.encryptionSupported) {
				this._algorithmDropdown.enabled = checked;
				this._encryptorDropdown.enabled = checked;
			}
		}, false, this.useUrlMode && this.encryptionSupported); // Normally encrypt is disabled until selecting New Media, but URL mode has no media options
		encryptionComponents.push(this._encryptCheckbox);

		if (this.encryptionSupported) {
			let algorithmComponents = [];
			let algorithmValues = [aes128, aes192, aes256, tripleDES];
			this._algorithmDropdown = this.createDropdown(loc.BackupAlgorithm, () => undefined, algorithmValues, algorithmValues[0], false);
			let algorithmContainer = this.createLabelInputContainer(loc.BackupAlgorithm, this._algorithmDropdown);
			algorithmComponents.push(algorithmContainer);

			this._encryptorDropdown = this.createDropdown(loc.BackupCertificate, () => undefined, this._encryptorOptions, this._encryptorOptions[0], false);
			let encryptorContainer = this.createLabelInputContainer(loc.BackupCertificate, this._encryptorDropdown);
			algorithmComponents.push(encryptorContainer);

			if (!this.useUrlMode) {
				let encryptionDescription = this.modelView.modelBuilder.text().withProps({ value: loc.BackupEncryptNotice }).component();
				algorithmComponents.push(encryptionDescription);
			}
			let algorithmGroup = this.createGroup('', algorithmComponents);
			encryptionComponents.push(algorithmGroup);
		} else {
			let encryptorWarning = this.modelView.modelBuilder.text().withProps({ value: loc.NoEncryptorWarning }).component();
			encryptionComponents.push(encryptorWarning);
		}
		let encryptionGroup = this.createGroup(loc.BackupEncryptionLabel, encryptionComponents, false);

		return this.createGroup(loc.OptionsSectionHeader, [overwriteGroup, reliabilityGroup, transactionGroup, compressionGroup, encryptionGroup], true, true);
	}

	private async onAddFilesButtonClicked(): Promise<void> {
		try {
			let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, this._defaultBackupFolderPath, this._fileFilters);
			await this.addNewFilePath(filePath);
		} catch (error) {
			this.dialogObject.message = {
				text: getErrorMessage(error),
				level: azdata.window.MessageLevel.Error
			};
		}
	}

	private async addNewFilePath(filePath: string | undefined): Promise<void> {
		if (filePath) {
			if (this._backupFilePaths.includes(filePath)) {
				this.dialogObject.message = {
					text: loc.PathAlreadyAddedError,
					level: azdata.window.MessageLevel.Error
				}
			} else {
				this._backupFilePaths.push(filePath);
				await this.updateTableData();
			}
		}
	}

	private async onRemoveFilesButtonClicked(): Promise<void> {
		let selectedRows = this._backupFilesTable.selectedRows;
		let deletedRowCount = 0;
		for (let row of selectedRows) {
			let index = row - deletedRowCount;
			this._backupFilePaths.splice(index, 1);
			deletedRowCount++;
		}
		await this.updateTableData();
	}

	private async updateTableData(): Promise<void> {
		await this._backupFilesTable.updateProperties({
			data: this._backupFilePaths.map(path => [path]),
			height: getTableHeight(this._backupFilePaths.length, DefaultMinTableRowCount)
		});
		this.onFormFieldChange();
	}

	private async onBrowseUrlButtonClicked(): Promise<void> {
		let defaultBackupName = `${this.getDefaultBackupName()}.bak`;
		let backupPath = await azdata.window.openBackupUrlBrowserDialog(this.options.connectionUri, defaultBackupName, false);
		if (backupPath) {
			this._backupUrlInput.value = backupPath;
		}
	}

	public override async generateScript(): Promise<string> {
		let backupInfo = this.createBackupInfo();
		let response = await this.objectManagementService.backupDatabase(this.options.connectionUri, backupInfo, TaskExecutionMode.script);
		if (!response.result) {
			throw new Error(loc.ScriptingFailedError);
		}
		// The backup call will open its own query window, so don't return any script here.
		return undefined;
	}

	public override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		let backupInfo = this.createBackupInfo();
		let response = await this.objectManagementService.backupDatabase(this.options.connectionUri, backupInfo, TaskExecutionMode.execute);
		if (!response.result) {
			throw new Error(loc.BackupFailedError);
		}
	}

	private getEncryptorOptions(): string[] {
		let options: string[] = [];
		if (this.objectInfo.backupEncryptors) {
			this.objectInfo.backupEncryptors.forEach((encryptor) => {
				let encryptorTypeStr = (encryptor.encryptorType === 0 ? loc.BackupServerCertificate : loc.BackupAsymmetricKey);
				options.push(`${encryptor.encryptorName} (${encryptorTypeStr})`);
			});
		}
		return options;
	}

	private getDefaultBackupName(): string {
		let d: Date = new Date();
		let dateTimeSuffix: string = `-${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}-${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`;
		let defaultBackupFileName = `${this.objectInfo.name}${dateTimeSuffix}`;
		return defaultBackupFileName;
	}

	private createBackupInfo(): BackupInfo {
		let encryptorName = '';
		let encryptorType: number | undefined;
		let encryptionAlgorithmIndex = 0;

		if (this._encryptCheckbox.checked && this.encryptionSupported) {
			if (!isUndefinedOrNull(this._encryptorDropdown.value)) {
				let selectedEncryptor = this._encryptorDropdown.value as string;
				let encryptorTypeStr = selectedEncryptor.substring(selectedEncryptor.lastIndexOf('(') + 1, selectedEncryptor.lastIndexOf(')'));
				encryptorType = (encryptorTypeStr === loc.BackupServerCertificate ? 0 : 1);
				encryptorName = selectedEncryptor.substring(0, selectedEncryptor.lastIndexOf('('));
			}

			encryptionAlgorithmIndex = (this._algorithmDropdown.values as string[]).indexOf(this._algorithmDropdown.value as string);
		}

		let backupDestPaths = this.useUrlMode ? [this._backupUrlInput.value] : this._backupFilePaths;
		let createNewMedia = this._newMediaButton.checked;
		let overwriteExistingMedia = this._overwriteExistingMediaButton.enabled && this._overwriteExistingMediaButton.checked;
		let deviceType = this.getBackupDeviceType();
		let backupInfo: BackupInfo = {
			databaseName: this.objectInfo.name,
			backupType: this.getBackupTypeNumber(),
			backupComponent: 0,
			backupDeviceType: deviceType,
			backupPathList: backupDestPaths,
			selectedFiles: undefined,
			backupsetName: this._backupSetNameInput.value,
			selectedFileGroup: undefined,
			backupPathDevices: this.getBackupMediaTypePairs(backupDestPaths),
			isCopyOnly: this._copyBackupCheckbox.checked,

			// Get advanced options
			formatMedia: createNewMedia,
			initialize: createNewMedia || overwriteExistingMedia,
			skipTapeHeader: createNewMedia,
			mediaName: (createNewMedia ? this._mediaNameInput.value : ''),
			mediaDescription: (createNewMedia ? this._mediaDescriptionInput.value : ''),
			checksum: this._checksumCheckbox.checked,
			continueAfterError: this._continueOnErrorCheckbox.checked,
			logTruncation: this._truncateLogButton.enabled ? this._truncateLogButton.checked : false,
			tailLogBackup: this._backupLogTailButton.enabled ? this._backupLogTailButton.checked : false,
			retainDays: 0,
			compressionOption: (this._compressionTypeDropdown.values as string[]).indexOf(this._compressionTypeDropdown.value as string),
			verifyBackupRequired: this._verifyCheckbox.checked,
			encryptionAlgorithm: encryptionAlgorithmIndex,
			encryptorType: encryptorType,
			encryptorName: encryptorName
		};

		return backupInfo;
	}

	private getBackupTypeNumber(): number {
		let backupType: number;
		switch (this._backupTypeDropdown.value) {
			case loc.BackupFull:
				backupType = 0;
				break;
			case loc.BackupDifferential:
				backupType = 1;
				break;
			case loc.BackupTransactionLog:
				backupType = 2;
				break;
		}
		return backupType;
	}

	private getBackupDeviceType(): PhysicalDeviceType {
		return this.useUrlMode ? PhysicalDeviceType.Url : PhysicalDeviceType.Disk;
	}

	private getBackupMediaTypePairs(filePaths: string[]): { [path: string]: MediaDeviceType } {
		let mediaType = this.useUrlMode ? MediaDeviceType.Url : MediaDeviceType.File;
		let pathMediaMap: { [path: string]: number } = {};
		filePaths.forEach(path => {
			pathMediaMap[path] = mediaType;
		});
		return pathMediaMap;
	}

	/**
	 * Toggles the dialog between using Disk or a storage URL as the backup destination.
	 */
	private async toggleBackupDestination(destination: string): Promise<void> {
		if (!this._oldDestination || this._oldDestination !== destination) {
			this._oldDestination = destination;
			let useUrlMode = destination === loc.BackupUrlLabel;

			// Media fields are disabled in URL mode and enabled for Disk mode
			this._existingMediaButton.enabled = !useUrlMode;
			this._newMediaButton.enabled = !useUrlMode;

			let useExistingMedia = this._existingMediaButton.checked;
			this._appendExistingMediaButton.enabled = useExistingMedia && !useUrlMode;
			this._overwriteExistingMediaButton.enabled = useExistingMedia && !useUrlMode;
			this._mediaNameInput.enabled = !useExistingMedia && !useUrlMode;
			this._mediaDescriptionInput.enabled = !useExistingMedia && !useUrlMode;

			// Show URL input or Files table depending on the selected mode
			if (useUrlMode) {
				this._urlInputContainer.display = 'flex';
				this._filesTableContainer.display = 'none';
			} else {
				this._urlInputContainer.display = 'none';
				this._filesTableContainer.display = 'flex';
			}
		}
	}
}

// Encryption algorithms
const aes128 = 'AES 128';
const aes192 = 'AES 192';
const aes256 = 'AES 256';
const tripleDES = 'Triple DES';
