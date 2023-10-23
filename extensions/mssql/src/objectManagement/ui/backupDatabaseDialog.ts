/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { BackupDatabaseDocUrl } from '../constants';
import * as loc from '../localizedConstants';
import { DefaultInputWidth, DialogButton } from '../../ui/dialogBase';

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.BackupDatabaseDialogTitle(options.database), 'BackupDatabase');
		this.dialogObject.okButton.label = loc.BackupButtonLabel;
	}

	protected override get helpUrl(): string {
		return BackupDatabaseDocUrl;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.BackupDatabaseOperationDisplayName(this.objectInfo.name);
	}

	protected override get opensEditorSeparately(): boolean {
		return true;
	}

	protected override async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		let optionsSection = this.initializeOptionsSection();

		this.formContainer.addItems([generalSection, optionsSection]);
	}

	private initializeGeneralSection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];
		let backupInput = this.createInputBox(newValue => {
			return Promise.resolve();
		}, {
			ariaLabel: '',
			inputType: 'text',
			enabled: true,
			value: '',
			width: DefaultInputWidth
		});
		let backupInputContainer = this.createLabelInputContainer(loc.BackupNameLabel, backupInput);
		components.push(backupInputContainer);

		let inputBox = this.createInputBox(newValue => {
			return Promise.resolve();
		}, {
			ariaLabel: this.objectInfo.recoveryModel,
			inputType: 'text',
			enabled: false,
			value: this.objectInfo.recoveryModel,
			width: DefaultInputWidth
		});
		let recoveryModelInput = this.createLabelInputContainer(loc.BackupRecoveryLabel, inputBox);
		components.push(recoveryModelInput);

		const backupTypes = ['Full', 'Differential', 'Transaction Log'];
		let backupTypeDropdown = this.createDropdown(loc.BackupTypeLabel, async newValue => {
			// Update backup name with new backup type
			backupInput.value = backupInput.ariaLabel = `${this.objectInfo.name}-${newValue.replace(' ', '-')}-${new Date().toJSON().slice(0, 19)}`;
		}, backupTypes, backupTypes[0]);
		let backupContainer = this.createLabelInputContainer(loc.BackupTypeLabel, backupTypeDropdown);
		components.push(backupContainer);

		let copyBackupCheckbox = this.createCheckbox(loc.BackupCopyLabel, checked => {
			return Promise.resolve();
		});
		components.push(copyBackupCheckbox);

		let backupDestinations = [loc.BackupDiskLabel]; // TODO: Add URL type
		let backupDestDropdown = this.createDropdown(loc.BackupToLabel, checked => {
			return Promise.resolve();
		}, backupDestinations, backupDestinations[0]);
		let backupDestContainer = this.createLabelInputContainer(loc.BackupToLabel, backupDestDropdown);
		components.push(backupDestContainer);

		let filesTable = this.createTable(loc.BackupFilesLabel, [loc.BackupFilesLabel], []);
		this.disposables.push(filesTable.onRowSelected(() => this.onFileRowSelected()))
		components.push(filesTable);

		let addButton: DialogButton = {
			buttonAriaLabel: loc.AddBackupFileAriaLabel,
			buttonHandler: async () => await this.onAddFilesButtonClicked()
		};
		let removeButton: DialogButton = {
			buttonAriaLabel: loc.RemoveBackupFileAriaLabel,
			buttonHandler: async () => await this.onRemoveFilesButtonClicked()
		};
		const buttonContainer = this.addButtonsForTable(filesTable, addButton, removeButton);
		components.push(buttonContainer);

		return this.createGroup(loc.GeneralSectionHeader, components, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		// Overwrite media
		let existingMediaButton = this.createRadioButton('Back up the the existing media set', 'BackupOverwriteMedia', false, checked => {
			return Promise.resolve();
		}, false);
		let appendExistingButton = this.createRadioButton('Append to the existing backup set', 'BackupExistingMedia', false, checked => {
			return Promise.resolve();
		}, false);
		let overwriteExistingButton = this.createRadioButton('Overwrite all existing backup sets', 'BackupExistingMedia', false, checked => {
			return Promise.resolve();
		}, false);
		let existingMediaButtonsGroup = this.createGroup('', [appendExistingButton, overwriteExistingButton]);

		let newMediaButton = this.createRadioButton('Back up to a new media set, and erase all existing backup sets', 'BackupOverwriteMedia', false, checked => {
			return Promise.resolve();
		}, false);
		let mediaSetInput = this.createInputBox(newValue => {
			return Promise.resolve();
		}, { enabled: false });
		let mediaSetContainer = this.createLabelInputContainer('New media set name', mediaSetInput);
		let mediaDescriptionInput = this.createInputBox(newValue => {
			return Promise.resolve();
		}, { enabled: false });
		let mediaDescriptionContainer = this.createLabelInputContainer('New media set description', mediaDescriptionInput);
		let newMediaButtonsGroup = this.createGroup('', [mediaSetContainer, mediaDescriptionContainer]);

		let overwriteGroup = this.createGroup(loc.BackupOverwriteMediaLabel, [
			existingMediaButton,
			existingMediaButtonsGroup,
			newMediaButton,
			newMediaButtonsGroup
		], false);

		// Reliability
		let verifyCheckbox = this.createCheckbox('Verify backup when finished', checked => {
			return Promise.resolve();
		});
		let checksumCheckbox = this.createCheckbox('Perform checksum before writing to media', checked => {
			return Promise.resolve();
		});
		let continueCheckbox = this.createCheckbox('Continue on error', checked => {
			return Promise.resolve();
		});

		let reliabilityGroup = this.createGroup(loc.BackupReliabilityLabel, [verifyCheckbox, checksumCheckbox, continueCheckbox], false);

		// Transaction log
		// Only should be enabled if backup type is Transaction Log
		let truncateButton = this.createRadioButton('Truncate the transaction log', 'BackupTransactionLog', false, checked => {
			return Promise.resolve();
		}, false);
		let backupTailButton = this.createRadioButton('Back up the tail of the log, and leave the database in the restoring state', 'BackupTransactionLog', false, checked => {
			return Promise.resolve();
		}, false);
		let transactionDescription = this.modelView.modelBuilder.text().withProps({ value: 'Transaction Log options are only available only when Backup Type is set to Tansaction Log above. ' }).component();
		let transactionGroup = this.createGroup(loc.BackupTransactionLogLabel, [truncateButton, backupTailButton, transactionDescription], false);

		// Compression
		let compressionValues = ['Use the default server setting', 'Compress backup', 'Do not compress backup'];
		let compressionDropdown = this.createDropdown('Set backup compression', newValue => {
			return Promise.resolve();
		}, compressionValues, compressionValues[0]);
		let compressionContainer = this.createLabelInputContainer('Set backup compression', compressionDropdown);
		let compressionGroup = this.createGroup(loc.BackupCompressionLabel, [compressionContainer], false);

		// Encryption
		let encryptCheckbox = this.createCheckbox('Encrypt backup', checked => {
			return Promise.resolve();
		}, false, false);

		let algorithmValues = [aes128, aes192, aes256, tripleDES];
		let algorithmDropdown = this.createDropdown('Algorithm', newValue => {
			return Promise.resolve();
		}, algorithmValues, algorithmValues[0], false);
		let algorithmContainer = this.createLabelInputContainer('Algorithm', algorithmDropdown);

		let encryptorValues = this.getEncryptorOptions();
		let encryptorDropdown = this.createDropdown('Certificate or Asymmetric Key', newValue => {
			return Promise.resolve();
		}, encryptorValues, encryptorValues[0], false);
		let encryptorContainer = this.createLabelInputContainer('Certificate or Asymmetric Key', encryptorDropdown);

		let encryptionDescription = this.modelView.modelBuilder.text().withProps({ value: 'Encryption options are only available when \'Back up to a new media set\' is selected above. ' }).component();
		let algorithmGroup = this.createGroup('', [algorithmContainer, encryptorContainer, encryptionDescription]);
		let encryptionGroup = this.createGroup(loc.BackupEncryptionLabel, [encryptCheckbox, algorithmGroup], false);

		return this.createGroup(loc.OptionsSectionHeader, [overwriteGroup, reliabilityGroup, transactionGroup, compressionGroup, encryptionGroup], true, true);
	}

	private async onAddFilesButtonClicked(): Promise<void> {
	}

	private async onRemoveFilesButtonClicked(): Promise<void> {
	}

	private async onFileRowSelected(): Promise<void> {
	}

	public override async generateScript(): Promise<string> {
		return '';
	}

	public override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {

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
}

// const maxDevices: number = 64;

const aes128 = 'AES 128';
const aes192 = 'AES 192';
const aes256 = 'AES 256';
const tripleDES = 'Triple DES';
