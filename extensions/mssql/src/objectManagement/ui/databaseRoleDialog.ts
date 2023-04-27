/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterDatabaseRoleDocUrl, CreateDatabaseRoleDocUrl } from '../constants';
import { FindObjectDialog } from './findObjectDialog';

export class DatabaseRoleDialog extends ObjectManagementDialogBase<ObjectManagement.DatabaseRoleInfo, ObjectManagement.DatabaseRoleViewInfo> {
	// Sections
	private generalSection: azdata.GroupContainer;
	private ownedSchemasSection: azdata.GroupContainer;
	private memberSection: azdata.GroupContainer;

	// General section content
	private nameInput: azdata.InputBoxComponent;
	private ownerInput: azdata.InputBoxComponent;

	// Owned Schemas section content
	private ownedSchemaTable: azdata.TableComponent;

	// Member section content
	private memberTable: azdata.TableComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get docUrl(): string {
		return this.options.isNewObject ? CreateDatabaseRoleDocUrl : AlterDatabaseRoleDocUrl;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.initializeOwnedSchemasSection();
		this.initializeMemberSection();
		this.formContainer.addItems([this.generalSection, this.ownedSchemasSection, this.memberSection]);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.ownerInput = this.createInputBox(localizedConstants.OwnerText, async (newValue) => {
			this.objectInfo.owner = newValue;
		}, this.objectInfo.owner, true, 'text', 210);
		const browseOwnerButton = this.createButton(localizedConstants.BrowseText, localizedConstants.BrowseOwnerButtonAriaLabel, async () => {
			const dialog = new FindObjectDialog(this.objectManagementService, {
				objectTypes: [ObjectManagement.NodeType.ApplicationRole, ObjectManagement.NodeType.DatabaseRole, ObjectManagement.NodeType.User],
				multiSelect: false,
				contextId: this.contextId,
				title: localizedConstants.SelectDatabaseRoleOwnerDialogTitle
			});
			await dialog.open();
			const result = await dialog.waitForClose();
			if (result.selectedObjects.length > 0) {
				this.ownerInput.value = result.selectedObjects[0].name;
			}
		});
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerText, this.ownerInput);
		ownerContainer.addItems([browseOwnerButton], { flex: '0 0 auto' });

		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [nameContainer, ownerContainer], false);
	}

	private initializeMemberSection(): void {
		this.memberTable = this.createTable(localizedConstants.MemberSectionHeader, [
			{
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText
			}
		], this.objectInfo.members.map(m => [m]));
		const buttonContainer = this.addButtonsForTable(this.memberTable, localizedConstants.AddMemberAriaLabel, localizedConstants.RemoveMemberAriaLabel,
			async () => {
				const dialog = new FindObjectDialog(this.objectManagementService, {
					objectTypes: [ObjectManagement.NodeType.DatabaseRole, ObjectManagement.NodeType.User],
					multiSelect: true,
					contextId: this.contextId,
					title: localizedConstants.SelectDatabaseRoleMemberDialogTitle
				});
				await dialog.open();
				const result = await dialog.waitForClose();
				this.addMembers(result.selectedObjects.map(r => r.name));
			},
			async () => {
				if (this.memberTable.selectedRows.length === 1) {
					this.removeMember(this.memberTable.selectedRows[0]);
				}
			});
		this.memberSection = this.createGroup(localizedConstants.MemberSectionHeader, [this.memberTable, buttonContainer]);
	}

	private addMembers(names: string[]): void {
		names.forEach(n => {
			if (this.objectInfo.members.indexOf(n) === -1) {
				this.objectInfo.members.push(n);
			}
		});
		this.updateMembersTable();
	}

	private removeMember(idx: number): void {
		this.objectInfo.members.splice(idx, 1);
		this.updateMembersTable();
	}

	private updateMembersTable(): void {
		this.setTableData(this.memberTable, this.objectInfo.members.map(m => [m]));
		this.onFormFieldChange();
	}

	private initializeOwnedSchemasSection(): void {
		this.ownedSchemaTable = this.createTableList<string>(localizedConstants.OwnedSchemaSectionHeader, [localizedConstants.SchemaText], this.viewInfo.schemas, this.objectInfo.ownedSchemas);
		this.ownedSchemasSection = this.createGroup(localizedConstants.MembershipSectionHeader, [this.ownedSchemaTable]);
	}
}
