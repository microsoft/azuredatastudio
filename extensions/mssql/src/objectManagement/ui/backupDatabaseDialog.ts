/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { BackupDatabaseDocUrl } from '../constants';
import * as loc from '../localizedConstants';
import { DefaultInputWidth } from '../../ui/dialogBase';

// const DialogWidth = '750px';

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		// options.width = DialogWidth;
		super(objectManagementService, options, loc.BackupDatabaseDialogTitle(options.database), 'BackupDatabase');
		this.dialogObject.okButton.label = loc.BackupButtonLabel;
	}

	protected override get helpUrl(): string {
		return BackupDatabaseDocUrl;
	}

	protected override async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		let optionsSection = this.initializeOptionsSection();

		this.formContainer.addItems([generalSection, optionsSection]);

		// let backupOptionsTab = this.initializeBackupOptionsTab();

		// const tabGroup = { title: '', tabs: [generalTab, mediaOptionsTab, backupOptionsTab] };
		// const tabbedPannel = this.modelView.modelBuilder.tabbedPanel()
		// 	.withTabs([tabGroup])
		// 	.withLayout({
		// 		orientation: azdata.TabOrientation.Vertical
		// 	})
		// 	.withProps({
		// 		CSSStyles: {
		// 			'margin': '-10px 0px 0px -10px'
		// 		}
		// 	}).component();
		// this.formContainer.addItem(tabbedPannel);
	}

	private initializeGeneralSection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];
		let inputBox = this.createInputBox(newValue => {
			return Promise.resolve();
		}, {
			ariaLabel: '',
			inputType: 'text',
			enabled: true,
			value: '',
			width: DefaultInputWidth
		});
		let backupInput = this.createLabelInputContainer('Backup name', inputBox);
		components.push(backupInput);

		inputBox = this.createInputBox(newValue => {
			return Promise.resolve();
		}, {
			ariaLabel: '',
			inputType: 'text',
			enabled: false,
			value: '',
			width: DefaultInputWidth
		});
		let recoveryModelInput = this.createLabelInputContainer('Recovery model', inputBox);
		components.push(recoveryModelInput);

		let backupTypes = ['Full', 'Differential', 'Transaction Log'];
		let backupTypeDropdown = this.createDropdown('Backup type', newValue => {
			return Promise.resolve();
		}, backupTypes, backupTypes[0]);
		let backupContainer = this.createLabelInputContainer('Backup type', backupTypeDropdown);
		components.push(backupContainer);

		let copyBackupCheckbox = this.createCheckbox('Copy-only backup', checked => {
			return Promise.resolve();
		});
		components.push(copyBackupCheckbox);

		let backupDestinations = ['Disk', 'URL'];
		let backupDestDropdown = this.createDropdown('Back up to', checked => {
			return Promise.resolve();
		}, backupDestinations, backupDestinations[0]);
		let backupDestContainer = this.createLabelInputContainer('Back up to', backupDestDropdown);
		components.push(backupDestContainer);

		// TODO: Add backup files table

		return this.createGroup(loc.GeneralSectionHeader, components, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		// Overwrite media
		let overwriteGroup = this.createGroup(loc.BackupOverwriteMediaLabel, [], false);

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
		let transactionGroup = this.createGroup(loc.BackupTransactionLogLabel, [truncateButton, backupTailButton], false);

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

		let algorithmValues = ['AES 128', 'AES 192', 'AES 256', 'Triple DES'];
		let algorithmDropdown = this.createDropdown('Algorithm', newValue => {
			return Promise.resolve();
		}, algorithmValues, algorithmValues[0], false);
		let algorithmContainer = this.createLabelInputContainer('Algorithm', algorithmDropdown);

		// TODO: add "Certificate or Encryption key" field

		let encryptionDescription = this.modelView.modelBuilder.text().withProps({ value: 'Encryption is available only when \'Back up to a new media set\' is selected above. ' }).component();

		let encryptionGroup = this.createGroup(loc.BackupEncryptionLabel, [encryptCheckbox, algorithmContainer, encryptionDescription], false);

		return this.createGroup(loc.OptionsSectionHeader, [overwriteGroup, reliabilityGroup, transactionGroup, compressionGroup, encryptionGroup], true, true);
	}
}
