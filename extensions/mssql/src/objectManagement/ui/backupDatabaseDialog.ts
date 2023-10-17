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

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.BackupDatabaseDialogTitle(options.database), 'BackupDatabase');
		this.dialogObject.okButton.label = loc.BackupButtonLabel;
	}

	protected override get helpUrl(): string {
		return BackupDatabaseDocUrl;
	}

	protected override async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		let compressionSection = this.initializeCompressionSection();
		let encryptionSection = this.initializeEncryptionSection();
		let mediaSection = this.initializeMediaSection();
		let transactionSection = this.initializeTransactionSection();
		let reliabilitySection = this.initializeReliabilitySection();
		let expirationSection = this.initializeExpirationSection();

		this.formContainer.addItems([
			generalSection,
			compressionSection,
			encryptionSection,
			mediaSection,
			transactionSection,
			reliabilitySection,
			expirationSection
		]);
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

		let backupTypeDropdown = this.createDropdown('Backup type', newValue => {
			return Promise.resolve();
		}, [], '');
		components.push(backupTypeDropdown);

		let copyBackupCheckbox = this.createCheckbox('Copy-only backup', checked => {
			return Promise.resolve();
		});
		components.push(copyBackupCheckbox);

		let saveBackupCheckbox = this.createCheckbox('Save backup to URL', checked => {
			return Promise.resolve();
		}, false, false);
		components.push(saveBackupCheckbox);

		// TODO: Add backup files table

		return this.createGroup(loc.GeneralSectionHeader, components);
	}

	private initializeCompressionSection(): azdata.GroupContainer {
		let backupCompressionDropdown = this.createDropdown('Set backup compression', newValue => {
			return Promise.resolve();
		}, [], '');

		return this.createGroup(loc.BackupCompressionLabel, [backupCompressionDropdown]);
	}

	private initializeEncryptionSection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];

		return this.createGroup(loc.BackupEncryptionLabel, components);
	}

	private initializeMediaSection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];

		return this.createGroup(loc.BackupMediaLabel, components);
	}

	private initializeTransactionSection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];

		return this.createGroup(loc.BackupTransactionLogLabel, components);
	}

	private initializeReliabilitySection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];

		return this.createGroup(loc.BackupReliabilityLabel, components);
	}

	private initializeExpirationSection(): azdata.GroupContainer {
		let components: azdata.Component[] = [];

		return this.createGroup(loc.BackupExpirationLabel, components);
	}
}
