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
import { DefaultInputWidth, DefaultMinTableRowCount, DialogButton, getTableHeight } from '../../ui/dialogBase';
import { isUndefinedOrNull } from '../../types';
import { TaskExecutionMode } from 'azdata';
import { getErrorMessage } from '../../utils';

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private readonly _fileFilters: azdata.window.FileFilters[] = [{ label: loc.BackupFilesLabel, filters: ['*.bak', '*.tm'] }];
	private _backupFilePaths: string[] = [];

	private _backupSetNameInput: azdata.InputBoxComponent;
	private _backupTypeDropdown: azdata.DropDownComponent;
	private _copyBackupCheckbox: azdata.CheckBoxComponent;
	private _backupDestDropdown: azdata.DropDownComponent;
	private _backupFilesTable: azdata.TableComponent;

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
		return this._backupFilePaths?.length > 0 && this._backupSetNameInput?.value?.length > 0;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.BackupDatabaseOperationDisplayName(this.objectInfo.name);
	}

	protected override get opensEditorSeparately(): boolean {
		return true;
	}

	private get encryptionSupported(): boolean {
		return this._encryptorOptions.length > 0;
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
		let components: azdata.Component[] = [];
		const backupTypes = [loc.BackupFull];
		if (this.objectInfo.name !== 'master') {
			backupTypes.push(loc.BackupDifferential);
			if (this.objectInfo.recoveryModel !== loc.RecoveryModelSimple) {
				backupTypes.push(loc.BackupTransactionLog);
			}
		}

		let defaultName = this.getDefaultBackupName(backupTypes[0]);
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
		}, backupTypes, backupTypes[0]);
		let backupContainer = this.createLabelInputContainer(loc.BackupTypeLabel, this._backupTypeDropdown);
		components.push(backupContainer);

		this._copyBackupCheckbox = this.createCheckbox(loc.BackupCopyLabel, () => undefined);
		components.push(this._copyBackupCheckbox);

		const backupDestinations = [loc.BackupDiskLabel]; // TODO: Add URL type when enabled
		this._backupDestDropdown = this.createDropdown(loc.BackupToLabel, () => undefined, backupDestinations, backupDestinations[0]);
		let backupDestContainer = this.createLabelInputContainer(loc.BackupToLabel, this._backupDestDropdown);
		components.push(backupDestContainer);

		let defaultPath = `${this._defaultBackupFolderPath}${this._defaultBackupPathSeparator}${defaultName}.bak`;
		this._backupFilePaths.push(defaultPath);
		this._backupFilesTable = this.createTable(loc.BackupFilesLabel, [loc.BackupFilesLabel], [[defaultPath]]);
		components.push(this._backupFilesTable);

		let addButton: DialogButton = {
			buttonAriaLabel: loc.AddBackupFileAriaLabel,
			buttonHandler: async () => await this.onAddFilesButtonClicked()
		};
		let removeButton: DialogButton = {
			buttonAriaLabel: loc.RemoveBackupFileAriaLabel,
			buttonHandler: async () => await this.onRemoveFilesButtonClicked()
		};
		const buttonContainer = this.addButtonsForTable(this._backupFilesTable, addButton, removeButton);
		components.push(buttonContainer);

		return this.createGroup(loc.GeneralSectionHeader, components, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		// Media options
		// Options for overwriting existing media - enabled by default
		const existingGroupId = 'BackupExistingMedia';
		this._appendExistingMediaButton = this.createRadioButton(loc.AppendToExistingBackup, existingGroupId, true, () => undefined);
		this._overwriteExistingMediaButton = this.createRadioButton(loc.OverwriteExistingBackups, existingGroupId, false, () => undefined);

		// Options for writing to new media
		this._mediaNameInput = this.createInputBox(() => undefined, { enabled: false });
		let mediaSetContainer = this.createLabelInputContainer(loc.BackupNewMediaName, this._mediaNameInput);
		this._mediaDescriptionInput = this.createInputBox(() => undefined, { enabled: false });
		let mediaDescriptionContainer = this.createLabelInputContainer(loc.BackupNewMediaDescription, this._mediaDescriptionInput);
		let newMediaButtonsGroup = this.createGroup('', [mediaSetContainer, mediaDescriptionContainer]);

		// Overall button that selects overwriting existing media - enabled by default
		const overwriteGroupId = 'BackupOverwriteMedia';
		this._existingMediaButton = this.createRadioButton(loc.BackupToExistingMedia, overwriteGroupId, true, async checked => {
			if (checked) {
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
		});
		let existingMediaButtonsGroup = this.createGroup('', [this._appendExistingMediaButton, this._overwriteExistingMediaButton]);

		// Overall button that selects writing to new media
		this._newMediaButton = this.createRadioButton(loc.BackupAndEraseExisting, overwriteGroupId, false, async checked => {
			if (checked) {
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
		});

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
		const transactionGroupId = 'BackupTransactionLog';
		this._truncateLogButton = this.createRadioButton(loc.BackupTruncateLog, transactionGroupId, true, () => undefined, false);
		this._backupLogTailButton = this.createRadioButton(loc.BackupLogTail, transactionGroupId, false, () => undefined, false);
		let transactionDescription = this.modelView.modelBuilder.text().withProps({ value: loc.TransactionLogNotice }).component();
		let transactionGroup = this.createGroup(loc.BackupTransactionLog, [this._truncateLogButton, this._backupLogTailButton, transactionDescription], false);

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
		}, false, false);
		encryptionComponents.push(this._encryptCheckbox);

		if (this.encryptionSupported) {
			let algorithmValues = [aes128, aes192, aes256, tripleDES];
			this._algorithmDropdown = this.createDropdown(loc.BackupAlgorithm, () => undefined, algorithmValues, algorithmValues[0], false);
			let algorithmContainer = this.createLabelInputContainer(loc.BackupAlgorithm, this._algorithmDropdown);

			this._encryptorDropdown = this.createDropdown(loc.BackupCertificate, () => undefined, this._encryptorOptions, this._encryptorOptions[0], false);
			let encryptorContainer = this.createLabelInputContainer(loc.BackupCertificate, this._encryptorDropdown);

			let encryptionDescription = this.modelView.modelBuilder.text().withProps({ value: loc.BackupEncryptNotice }).component();
			let algorithmGroup = this.createGroup('', [algorithmContainer, encryptorContainer, encryptionDescription]);
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
			if (filePath) {
				this._backupFilePaths.push(filePath);
				await this.updateTableData();
			}
		} catch (error) {
			this.dialogObject.message = {
				text: getErrorMessage(error),
				level: azdata.window.MessageLevel.Error
			};
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

	public override async generateScript(): Promise<string> {
		let backupInfo = this.createBackupInfo();
		let response = await this.objectManagementService.backupDatabase(this.options.connectionUri, backupInfo, TaskExecutionMode.script);
		if (!response.result) {
			throw new Error('Script operation failed.');
		}
		// The backup call will open its own query window, so don't return any script here.
		return undefined;
	}

	public override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		let backupInfo = this.createBackupInfo();
		let response = await this.objectManagementService.backupDatabase(this.options.connectionUri, backupInfo, TaskExecutionMode.execute);
		if (!response.result) {
			throw new Error('Backup operation failed.');
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

	private getDefaultBackupName(backupType: string): string {
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

		let filePaths = this._backupFilePaths;
		let createNewMedia = this._newMediaButton.checked;
		let overwriteExistingMedia = this._overwriteExistingMediaButton.enabled && this._overwriteExistingMediaButton.checked;
		let backupInfo: BackupInfo = {
			databaseName: this.objectInfo.name,
			backupType: this.getBackupTypeNumber(),
			backupComponent: 0,
			backupDeviceType: this.getBackupDeviceType(),
			backupPathList: filePaths,
			selectedFiles: undefined,
			backupsetName: this._backupSetNameInput.value,
			selectedFileGroup: undefined,
			backupPathDevices: this.getBackupTypePairs(filePaths),
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

	private getBackupDeviceType(): number {
		if (this._backupDestDropdown.value === loc.BackupUrlLabel) {
			return PhysicalDeviceType.Url;
		}
		return PhysicalDeviceType.Disk;
	}

	private getBackupTypePairs(filePaths: string[]): { [path: string]: number } {
		let pathDeviceMap: { [path: string]: number } = {};
		let deviceType = this.getBackupDeviceType();
		filePaths.forEach(path => {
			pathDeviceMap[path] = deviceType;
		});
		return pathDeviceMap;
	}
}

// const maxDevices: number = 64;

const aes128 = 'AES 128';
const aes192 = 'AES 192';
const aes256 = 'AES 256';
const tripleDES = 'Triple DES';

enum PhysicalDeviceType {
	Disk = 2,
	FloppyA = 3,
	FloppyB = 4,
	Tape = 5,
	Pipe = 6,
	CDRom = 7,
	Url = 9,
	Unknown = 100
}
