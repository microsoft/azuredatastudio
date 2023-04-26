/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterServerRoleDocUrl, CreateServerRoleDocUrl } from '../constants';

export class ServerRoleDialog extends ObjectManagementDialogBase<ObjectManagement.ServerRoleInfo, ObjectManagement.ServerRoleViewInfo> {
	// Sections
	private generalSection: azdata.GroupContainer;
	private membershipSection: azdata.GroupContainer;
	private memberSection: azdata.GroupContainer;

	// General section content
	private nameInput: azdata.InputBoxComponent;
	private ownerInput: azdata.InputBoxComponent;

	// Member section content
	private memberTable: azdata.TableComponent;
	private addMemberButton: azdata.ButtonComponent;
	private removeMemberButton: azdata.ButtonComponent;

	// Membership section content
	private membershipTable: azdata.TableComponent;


	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get docUrl(): string {
		return this.options.isNewObject ? CreateServerRoleDocUrl : AlterServerRoleDocUrl;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.initializeMemberSection();
		this.initializeMembershipSection();
		this.formContainer.addItems([this.generalSection, this.memberSection, this.membershipSection]);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.ownerInput = this.createInputBox(localizedConstants.OwnerText, async (newValue) => {
			this.objectInfo.owner = newValue;
		}, this.objectInfo.owner, !this.viewInfo.isFixedRole);
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerText, this.ownerInput);

		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer,
			ownerContainer
		], false);
	}

	private initializeMemberSection(): void {
		this.memberTable = this.createTable(localizedConstants.MemberSectionHeader, [
			{
				type: azdata.ColumnType.text,
				value: localizedConstants.NameText
			}
		], this.objectInfo.members.map(m => [m]));
		this.addMemberButton = this.createButton(localizedConstants.AddText, async () => { });
		this.removeMemberButton = this.createButton(localizedConstants.RemoveText, async () => { });
		const buttonContainer = this.createButtonContainer([this.addMemberButton, this.removeMemberButton]);
		this.memberSection = this.createGroup(localizedConstants.MemberSectionHeader, [this.memberTable, buttonContainer]);
	}

	private initializeMembershipSection(): void {
		this.membershipTable = this.createTableList<string>(localizedConstants.MembershipSectionHeader, [localizedConstants.ServerRoleTypeDisplayNameInTitle], this.viewInfo.serverRoles, this.objectInfo.memberships);
		this.membershipSection = this.createGroup(localizedConstants.MembershipSectionHeader, [this.membershipTable]);
	}
}
