/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterServerRoleDocUrl, CreateServerRoleDocUrl } from '../constants';
import { FindObjectDialog } from './findObjectDialog';
import { PrincipalDialogBase } from './principalDialogBase';
import { ServerRoleInfo, ServerRoleViewInfo } from '../interfaces';

export class ServerRoleDialog extends PrincipalDialogBase<ServerRoleInfo, ServerRoleViewInfo> {
	// Sections
	private generalSection: azdata.GroupContainer;
	private membershipSection: azdata.GroupContainer;
	private memberSection: azdata.GroupContainer;

	// General section content
	private nameInput: azdata.InputBoxComponent;
	private ownerInput: azdata.InputBoxComponent;

	// Member section content
	private memberTable: azdata.TableComponent;

	// Membership section content
	private membershipTable: azdata.TableComponent;


	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, { ...options, isDatabaseLevelPrincipal: false, supportEffectivePermissions: false });
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateServerRoleDocUrl : AlterServerRoleDocUrl;
	}

	protected override async initializeUI(): Promise<void> {
		await super.initializeUI();
		this.initializeGeneralSection();
		this.initializeMemberSection();
		const sections: azdata.Component[] = [this.generalSection, this.memberSection];
		if (!this.viewInfo.isFixedRole) {
			this.initializeMembershipSection();
			sections.push(this.membershipSection);
			sections.push(this.securableSection);
		}
		this.formContainer.addItems(sections, this.getSectionItemLayout());
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(async (newValue) => {
			this.objectInfo.name = newValue;
		}, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name
		});
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.ownerInput = this.createInputBox(async (newValue) => {
			this.objectInfo.owner = newValue;
		}, {
			ariaLabel: localizedConstants.OwnerText,
			inputType: 'text',
			enabled: !this.viewInfo.isFixedRole,
			value: this.objectInfo.owner,
			width: 210
		});
		const browseOwnerButton = this.createButton(localizedConstants.BrowseText, localizedConstants.BrowseOwnerButtonAriaLabel, async () => {
			const dialog = new FindObjectDialog(this.objectManagementService, {
				objectTypes: localizedConstants.getObjectTypeInfo([
					ObjectManagement.NodeType.ServerLevelLogin,
					ObjectManagement.NodeType.ServerLevelServerRole
				]),
				selectAllObjectTypes: true,
				multiSelect: false,
				contextId: this.contextId,
				title: localizedConstants.SelectServerRoleOwnerDialogTitle
			});
			await dialog.open();
			const result = await dialog.waitForClose();
			if (result.selectedObjects.length > 0) {
				this.ownerInput.value = result.selectedObjects[0].name;
			}
		}, !this.viewInfo.isFixedRole);
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerText, this.ownerInput);
		ownerContainer.addItems([browseOwnerButton], { flex: '0 0 auto' });
		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer,
			ownerContainer
		], false);
	}

	private initializeMemberSection(): void {
		this.memberTable = this.createTable(localizedConstants.MemberSectionHeader, [localizedConstants.NameText], this.objectInfo.members.map(m => [m]));
		const buttonContainer = this.addButtonsForTable(this.memberTable,
			{
				buttonAriaLabel: localizedConstants.AddMemberAriaLabel,
				buttonHandler: async () => {
					const dialog = new FindObjectDialog(this.objectManagementService, {
						objectTypes: localizedConstants.getObjectTypeInfo([
							ObjectManagement.NodeType.ServerLevelLogin,
							ObjectManagement.NodeType.ServerLevelServerRole
						]),
						selectAllObjectTypes: true,
						multiSelect: true,
						contextId: this.contextId,
						title: localizedConstants.SelectServerRoleMemberDialogTitle
					});
					await dialog.open();
					const result = await dialog.waitForClose();
					await this.addMembers(result.selectedObjects.map(r => r.name));
				}
			}, {
			buttonAriaLabel: localizedConstants.RemoveMemberAriaLabel,
			buttonHandler: async () => {
				if (this.memberTable.selectedRows.length === 1) {
					await this.removeMember(this.memberTable.selectedRows[0]);
				}
			}
		});
		this.memberSection = this.createGroup(localizedConstants.MemberSectionHeader, [this.memberTable, buttonContainer]);
	}

	private async addMembers(names: string[]): Promise<void> {
		names.forEach(n => {
			if (this.objectInfo.members.indexOf(n) === -1) {
				this.objectInfo.members.push(n);
			}
		});
		await this.updateMembersTable();
	}

	private async removeMember(idx: number): Promise<void> {
		this.objectInfo.members.splice(idx, 1);
		await this.updateMembersTable();
	}

	private async updateMembersTable(): Promise<void> {
		await this.setTableData(this.memberTable, this.objectInfo.members.map(m => [m]));
		this.onFormFieldChange();
	}

	private initializeMembershipSection(): void {
		this.membershipTable = this.createTableList<string>(localizedConstants.MembershipSectionHeader, [localizedConstants.ServerRoleTypeDisplayNameInTitle], this.viewInfo.serverRoles, this.objectInfo.memberships);
		this.membershipSection = this.createGroup(localizedConstants.MembershipSectionHeader, [this.membershipTable]);
	}
}
