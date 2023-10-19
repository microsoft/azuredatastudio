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
		// let components: azdata.Component[] = [];

		let overwriteGroup = this.createGroup('Overwrite media', [], false);
		let reliabilityGroup = this.createGroup('Reliability', [], false);
		let transactionGroup = this.createGroup('Transaction log', [], false);

		let compressionGroup = this.createGroup('Compression', [], false);
		let encryptionGroup = this.createGroup('Encryption', [], false);

		return this.createGroup(loc.OptionsSectionHeader, [overwriteGroup, reliabilityGroup, transactionGroup, compressionGroup, encryptionGroup], true, true);
	}
}
