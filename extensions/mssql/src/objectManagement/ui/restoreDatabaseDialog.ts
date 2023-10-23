/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../localizedConstants';
import * as localizedConstants from '../localizedConstants';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultInputWidth } from '../../ui/dialogBase';
import { Database, DatabaseViewInfo } from '../interfaces';
import { IObjectManagementService } from 'mssql';


export class RestoreDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	// restore diaog tabs
	private generalTab: azdata.Tab;
	private readonly generalTabId: string = 'generalDatabaseId';
	private backupFilePathInput: azdata.InputBoxComponent;
	private backupFilePathContainer: azdata.FlexContainer;
	private backupFilePathButton: azdata.ButtonComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
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
			}
			// this.objectInfo.collationName = collationDropbox.value as string;
		}, [localizedConstants.RestoreFromDatabaseOptionText, localizedConstants.RestoreFromBackupFileOptionText],
			localizedConstants.RestoreFromDatabaseOptionText, true, DefaultInputWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.RestoreFromText, restoreFrom));

		// Backup file path
		this.backupFilePathInput = this.createInputBox(async (newValue) => {
			// this.result.path = newValue;
		}, {
			ariaLabel: localizedConstants.BackupFilePathText,
			inputType: 'text',
			enabled: true,
			value: '',
			width: DefaultInputWidth - 30
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
		}, [], '', true, DefaultInputWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.DatabaseText, restoreDatabase));

		return this.createGroup(localizedConstants.SourceSectionText, containers, true);
	}

	private initializeDestinationSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];

		let targetDatabase = this.createDropdown(localizedConstants.TargetDatabaseText, async () => {
			// this.objectInfo.collationName = collationDropbox.value as string;
		}, [], '', true, DefaultInputWidth, true, true);
		containers.push(this.createLabelInputContainer(localizedConstants.TargetDatabaseText, targetDatabase));

		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.RestoreToText,
			required: false,
			enabled: false,
			width: DefaultInputWidth,
			value: ''
		};
		let restoreTo = this.createInputBox(async () => {
			// this.objectInfo.collationName = collationDropbox.value as string;
		}, props);
		containers.push(this.createLabelInputContainer(localizedConstants.RestoreToText, restoreTo));

		return this.createGroup(localizedConstants.DestinationSectionText, containers, true);
	}

	private initializeRestorePlanSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];

		return this.createGroup(localizedConstants.SourceSectionText, [
		], true);
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
}
