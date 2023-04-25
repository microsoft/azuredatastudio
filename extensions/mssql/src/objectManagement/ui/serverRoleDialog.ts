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

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		return errors;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.initializeMemberSection();
		this.initializeMembershipSection();
		this.formContainer.addItems([this.generalSection, this.memberSection, this.membershipSection]);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, this.objectInfo.name, this.options.isNewObject);
		this.disposables.push(this.nameInput.onTextChanged(async () => {
			this.objectInfo.name = this.nameInput.value!;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.ownerInput = this.createInputBox(localizedConstants.OwnerText, this.objectInfo.owner, !this.viewInfo.isFixedRole);
		this.disposables.push(this.nameInput.onTextChanged(async () => {
			this.objectInfo.name = this.nameInput.value!;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
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
		this.addMemberButton = this.modelView.modelBuilder.button().withProps({ label: localizedConstants.AddText, secondary: true }).component();
		this.removeMemberButton = this.modelView.modelBuilder.button().withProps({
			label: localizedConstants.RemoveText, secondary: true, CSSStyles: {
				'margin-left': '5px'
			}
		}).component();
		const buttonContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', justifyContent: 'flex-end' }).withItems([this.addMemberButton, this.removeMemberButton], { flex: '0 0 auto' }).component();
		this.memberSection = this.createGroup(localizedConstants.MemberSectionHeader, [this.memberTable, buttonContainer]);
	}

	private initializeMembershipSection(): void {
		this.membershipTable = this.createTableList(localizedConstants.MembershipSectionHeader, this.viewInfo.serverRoles, this.objectInfo.memberships);
		this.membershipSection = this.createGroup(localizedConstants.MembershipSectionHeader, [this.membershipTable]);
	}
}
