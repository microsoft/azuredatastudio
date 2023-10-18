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

const DialogWidth = '750px';

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		options.width = DialogWidth;
		super(objectManagementService, options, loc.BackupDatabaseDialogTitle(options.database), 'BackupDatabase');
		this.dialogObject.okButton.label = loc.BackupButtonLabel;
	}

	protected override get helpUrl(): string {
		return BackupDatabaseDocUrl;
	}

	protected override async initializeUI(): Promise<void> {
		let generalTab = this.initializeGeneralTab();
		let mediaOptionsTab = this.initializeMediaOptionsTab();
		let backupOptionsTab = this.initializeBackupOptionsTab();

		const tabGroup = { title: '', tabs: [generalTab, mediaOptionsTab, backupOptionsTab] };
		const tabbedPannel = this.modelView.modelBuilder.tabbedPanel()
			.withTabs([tabGroup])
			.withLayout({
				orientation: azdata.TabOrientation.Vertical
			})
			.withProps({
				CSSStyles: {
					'margin': '-10px 0px 0px -10px'
				}
			}).component();

		this.formContainer.addItem(tabbedPannel);
	}

	private initializeGeneralTab(): azdata.Tab {
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

		let group = this.createGroup('', components, false);
		return this.createTab('generalId', loc.GeneralSectionHeader, group);
	}

	private initializeMediaOptionsTab(): azdata.Tab {
		let components: azdata.Component[] = [];

		let group = this.createGroup('', components, true, true);
		return this.createTab('mediaOptionsId', loc.BackupMediaOptionsLabel, group);
	}

	private initializeBackupOptionsTab(): azdata.Tab {
		let components: azdata.Component[] = [];

		let group = this.createGroup('', components, true, true);
		return this.createTab('backupOptionsId', loc.BackupOptionsLabel, group);
	}
}
