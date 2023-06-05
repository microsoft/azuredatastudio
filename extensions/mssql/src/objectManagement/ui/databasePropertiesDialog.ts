/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as localizedConstants from '../localizedConstants';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { AlterUserDocUrl, CreateUserDocUrl } from '../constants';

export class DatabasePropertiesDialog extends ObjectManagementDialogBase<ObjectManagement.DatabasePropertiesInfo, ObjectManagement.DatabasePropertiesViewInfo> {

	// Tabs
	private generalTab: azdata.window.DialogTab;
	private filesTab: azdata.window.DialogTab;

	// Backup section and its inputs
	private backupSection: azdata.GroupContainer;
	private lastDatabaseBackupInput: azdata.InputBoxComponent;
	private lastDatabaseLogBackupInput: azdata.InputBoxComponent;

	// Database section and its inputs
	private databaseSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private statusInput: azdata.InputBoxComponent;
	private ownerInput: azdata.InputBoxComponent;
	private dateCreatedInput: azdata.InputBoxComponent;
	private sizeInput: azdata.InputBoxComponent;
	private spaceAvailabeInput: azdata.InputBoxComponent;
	private numberOfUsersInput: azdata.InputBoxComponent;
	private memoryAllocatedInput: azdata.InputBoxComponent;
	private memoryUsedInput: azdata.InputBoxComponent;

	// Maintenance section and its inputs
	private maintenanceSection: azdata.GroupContainer;
	private collationInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
		this.generalTab = azdata.window.createTab(localizedConstants.GeneralSectionHeader);
		this.filesTab = azdata.window.createTab(localizedConstants.FilesHeaderText);
	}

	protected async initializeUI(): Promise<void> {
		const sections: azdata.Component[] = [];

		this.initializeBackupSection();
		sections.push(this.backupSection);

		this.initializeDatabaseSection();
		sections.push(this.databaseSection);

		this.initializeMaintenanceSection();
		sections.push(this.maintenanceSection);

		this.formContainer.addItems(sections, this.getSectionItemLayout());
		this.registerTab(this.generalTab, [this.formContainer]);

		this.dialogObject.content = [this.generalTab, this.filesTab];
		azdata.window.openDialog(this.dialogObject);
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateUserDocUrl : AlterUserDocUrl;
	}

	private initializeBackupSection(): void {
		this.lastDatabaseBackupInput = this.createInputBox(localizedConstants.LastDatabaseBackupText, async (newValue) => {
			this.objectInfo.lastDatabaseBackup = newValue;
		}, this.objectInfo.lastDatabaseBackup, this.options.isNewObject);
		const lastDatabaseBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseBackupText, this.lastDatabaseBackupInput);

		this.lastDatabaseLogBackupInput = this.createInputBox(localizedConstants.LastDatabaseLogBackupText, async (newValue) => {
			this.objectInfo.lastDatabaseLogBackup = newValue;
		}, this.objectInfo.lastDatabaseLogBackup, this.options.isNewObject);
		const lastDatabaseLogBackupContainer = this.createLabelInputContainer(localizedConstants.LastDatabaseLogBackupText, this.lastDatabaseLogBackupInput);

		this.backupSection = this.createGroup(localizedConstants.BackupSectionHeader, [
			lastDatabaseBackupContainer,
			lastDatabaseLogBackupContainer
		], false);
	}

	private initializeDatabaseSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NamePropertyText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NamePropertyText, this.nameInput);

		this.statusInput = this.createInputBox(localizedConstants.StatusText, async (newValue) => {
			this.objectInfo.status = newValue;
		}, this.objectInfo.status, this.options.isNewObject);
		const statusContainer = this.createLabelInputContainer(localizedConstants.StatusText, this.statusInput);

		this.ownerInput = this.createInputBox(localizedConstants.OwnerPropertyText, async (newValue) => {
			this.objectInfo.owner = newValue;
		}, this.objectInfo.owner, this.options.isNewObject);
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerPropertyText, this.ownerInput);

		this.dateCreatedInput = this.createInputBox(localizedConstants.DateCreatedText, async (newValue) => {
			this.objectInfo.dateCreated = newValue;
		}, this.objectInfo.dateCreated, this.options.isNewObject);
		const dateCreatedContainer = this.createLabelInputContainer(localizedConstants.DateCreatedText, this.dateCreatedInput);

		this.sizeInput = this.createInputBox(localizedConstants.SizeText, async (newValue) => {
			this.objectInfo.size = newValue;
		}, this.objectInfo.size, this.options.isNewObject);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.SizeText, this.sizeInput);

		this.spaceAvailabeInput = this.createInputBox(localizedConstants.SpaceAvailableText, async (newValue) => {
			this.objectInfo.spaceAvailable = newValue;
		}, this.objectInfo.spaceAvailable, this.options.isNewObject);
		const spaceAvailabeContainer = this.createLabelInputContainer(localizedConstants.SpaceAvailableText, this.spaceAvailabeInput);

		this.numberOfUsersInput = this.createInputBox(localizedConstants.NumberOfUsersText, async (newValue) => {
			this.objectInfo.numberOfUsers = newValue;
		}, this.objectInfo.numberOfUsers, this.options.isNewObject);
		const numberOfUsersContainer = this.createLabelInputContainer(localizedConstants.NumberOfUsersText, this.numberOfUsersInput);

		this.memoryAllocatedInput = this.createInputBox(localizedConstants.MemoryAllocatedText, async (newValue) => {
			this.objectInfo.memoryAllocatedToMemoryOptimizedObjects = newValue;
		}, this.objectInfo.memoryAllocatedToMemoryOptimizedObjects, this.options.isNewObject);
		const memoryAllocatedContainer = this.createLabelInputContainer(localizedConstants.MemoryAllocatedText, this.memoryAllocatedInput);

		this.memoryUsedInput = this.createInputBox(localizedConstants.MemoryUsedText, async (newValue) => {
			this.objectInfo.memoryUsedByMemoryOptimizedObjects = newValue;
		}, this.objectInfo.memoryUsedByMemoryOptimizedObjects, this.options.isNewObject);
		const memoryUsedContainer = this.createLabelInputContainer(localizedConstants.MemoryUsedText, this.memoryUsedInput);

		this.databaseSection = this.createGroup(localizedConstants.DatabaseSectionHeader, [
			nameContainer,
			statusContainer,
			ownerContainer,
			dateCreatedContainer,
			sizeContainer,
			spaceAvailabeContainer,
			numberOfUsersContainer,
			memoryAllocatedContainer,
			memoryUsedContainer
		], false);
	}

	private initializeMaintenanceSection(): void {
		this.collationInput = this.createInputBox(localizedConstants.CollationText, async (newValue) => {
			this.objectInfo.collationName = newValue;
		}, this.objectInfo.collationName, this.options.isNewObject);
		const collationContainer = this.createLabelInputContainer(localizedConstants.CollationText, this.collationInput);

		this.maintenanceSection = this.createGroup(localizedConstants.MaintenanceSectionHeader, [collationContainer], false);
	}
}
