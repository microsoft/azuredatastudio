/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import * as localizedConstants from '../localizedConstants';

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { FindObjectDialog } from './findObjectDialog';
import { deepClone } from '../../util/objects';
import { getTableHeight } from '../../ui/dialogBase';

const GrantColumnIndex = 2;
const WithGrantColumnIndex = 3;
const DenyColumnIndex = 4;

/**
 * Base class for security principal dialogs such as user, role, etc.
 */
export abstract class PrincipalDialogBase<ObjectInfoType extends mssql.ObjectManagement.SecurityPrincipalObject, ViewInfoType extends mssql.ObjectManagement.SecurityPrincipalViewInfo<ObjectInfoType>> extends ObjectManagementDialogBase<ObjectInfoType, ViewInfoType> {
	protected securableTable: azdata.TableComponent;
	protected permissionTable: azdata.TableComponent;
	protected effectivePermissionTable: azdata.TableComponent;
	protected securableSection: azdata.GroupContainer;
	protected explicitPermissionTableLabel: azdata.TextComponent;
	protected effectivePermissionTableLabel: azdata.TextComponent;
	private securablePermissions: mssql.ObjectManagement.SecurablePermissions[] = [];

	constructor(objectManagementService: mssql.IObjectManagementService, options: ObjectManagementDialogOptions, private readonly showSchemaColumn: boolean) {
		super(objectManagementService, options);
	}

	protected override async initializeUI(): Promise<void> {
		this.securablePermissions = deepClone(this.objectInfo.securablePermissions);
		this.initializeSecurableSection();
	}

	private initializeSecurableSection(): void {
		const items: azdata.Component[] = [];
		const securableTableColumns = [localizedConstants.NameText, localizedConstants.ObjectTypeText];
		if (this.showSchemaColumn) {
			securableTableColumns.splice(1, 0, localizedConstants.SchemaText);
		}
		this.securableTable = this.createTable(localizedConstants.SecurablesText, securableTableColumns, this.getSecurableTableData());
		const buttonContainer = this.addButtonsForTable(this.securableTable, localizedConstants.AddSecurableAriaLabel, localizedConstants.RemoveSecurableAriaLabel,
			() => this.onAddSecurableButtonClicked(), () => this.onRemoveSecurableButtonClicked());
		this.disposables.push(this.securableTable.onRowSelected(async () => {
			await this.updatePermissionsTable();
		}));
		this.explicitPermissionTableLabel = this.modelView.modelBuilder.text().withProps({ value: localizedConstants.ExplicitPermissionsTableLabel }).component();
		this.permissionTable = this.modelView.modelBuilder.table().withProps({
			ariaLabel: localizedConstants.ExplicitPermissionsTableLabel,
			columns:
				[{
					type: azdata.ColumnType.text,
					value: localizedConstants.PermissionColumnHeader
				}, {
					type: azdata.ColumnType.text,
					value: localizedConstants.GrantorColumnHeader
				}, {
					type: azdata.ColumnType.checkBox,
					value: localizedConstants.GrantColumnHeader
				}, {
					type: azdata.ColumnType.checkBox,
					value: localizedConstants.WithGrantColumnHeader
				}, {
					type: azdata.ColumnType.checkBox,
					value: localizedConstants.DenyColumnHeader
				}],
			data: [],
			height: getTableHeight(0),
		}).component();
		this.disposables.push(this.permissionTable.onCellAction(async (arg: azdata.ICheckboxCellActionEventArgs) => {
			const permissionName = this.permissionTable.data[arg.row][0];
			const securable = this.securablePermissions[this.securableTable.selectedRows[0]];
			let permission: mssql.ObjectManagement.SecurablePermissionItem = securable.permissions.find(securablePermission => securablePermission.permission === permissionName);
			if (!permission) {
				permission = {
					permission: permissionName,
					grantor: ''
				};
				securable.permissions.push(permission);
			}
			if (arg.column === GrantColumnIndex) {
				permission.grant = arg.checked ? true : undefined;
				if (!arg.checked) {
					permission.withGrant = undefined;
				}
			} else if (arg.column === WithGrantColumnIndex) {
				permission.withGrant = arg.checked ? true : undefined;
				if (arg.checked) {
					permission.grant = true;
				}
			} else if (arg.column === DenyColumnIndex) {
				permission.grant = arg.checked ? false : undefined;
				if (arg.checked) {
					permission.withGrant = undefined;
				}
			}
			await this.updatePermissionsTable();
			this.updateSecurablePermissions();
			// Restore the focus to previously selected cell.
			this.permissionTable.setActiveCell(arg.row, arg.column);
		}));

		items.push(this.securableTable, buttonContainer, this.explicitPermissionTableLabel, this.permissionTable);
		if (!this.options.isNewObject) {
			this.effectivePermissionTableLabel = this.modelView.modelBuilder.text().withProps({ value: localizedConstants.EffectivePermissionsTableLabel }).component();
			this.effectivePermissionTable = this.createTable(localizedConstants.EffectivePermissionsTableLabel, [localizedConstants.PermissionColumnHeader], []);
			items.push(this.effectivePermissionTableLabel, this.effectivePermissionTable);
		}
		this.securableSection = this.createGroup(localizedConstants.SecurablesText, items);
	}

	private async onAddSecurableButtonClicked(): Promise<void> {
		const dialog = new FindObjectDialog(this.objectManagementService, {
			objectTypes: this.viewInfo.supportedSecurableTypes,
			multiSelect: true,
			contextId: this.contextId,
			title: localizedConstants.SelectSecurablesDialogTitle,
			showSchemaColumn: this.showSchemaColumn
		});
		await dialog.open();
		const result = await dialog.waitForClose();
		if (result && result.selectedObjects.length > 0) {
			result.selectedObjects.forEach(obj => {
				if (this.securablePermissions.find(securable => securable.type === obj.type && securable.name === obj.name && securable.schema === obj.schema)) {
					return;
				}
				const securableTypeMetadata = this.viewInfo.supportedSecurableTypes.find(securableType => securableType.name === obj.type);
				this.securablePermissions.push({
					name: obj.name,
					schema: obj.schema,
					type: obj.type,
					permissions: securableTypeMetadata.permissions.map(permission => {
						return {
							permission: permission.name,
							grantor: '',
							grant: undefined,
							withGrant: undefined
						};
					}),
					effectivePermissions: []
				});
			});
			const data = this.getSecurableTableData();
			await this.setTableData(this.securableTable, data);
		}
	}

	private async onRemoveSecurableButtonClicked(): Promise<void> {
		if (this.securableTable.selectedRows.length === 1) {
			this.securablePermissions.splice(this.securableTable.selectedRows[0], 1);
			const data = this.getSecurableTableData();
			await this.setTableData(this.securableTable, data);
			this.updateSecurablePermissions();
		}
	}

	private getSecurableTableData(): string[][] {
		return this.securablePermissions.map(securable => {
			const row = [securable.name, this.getSecurableTypeDisplayName(securable.type)];
			if (this.showSchemaColumn) {
				row.splice(1, 0, securable.schema);
			}
			return row;
		});
	}

	private async updatePermissionsTable(): Promise<void> {
		let permissionsTableData: any[][] = [];
		let effectivePermissionsTableData: any[][] = [];
		let explicitPermissionsLabel = localizedConstants.ExplicitPermissionsTableLabel;
		let effectivePermissionsLabel = localizedConstants.EffectivePermissionsTableLabel;
		if (this.securableTable.selectedRows.length === 1) {
			const securable = this.securablePermissions[this.securableTable.selectedRows[0]];
			if (securable) {
				const securableDisplayName = securable.schema ? `${securable.schema}.${securable.name}` : securable.name;
				explicitPermissionsLabel = localizedConstants.ExplicitPermissionsTableLabelSelected(securableDisplayName);
				effectivePermissionsLabel = localizedConstants.EffectivePermissionsTableLabelSelected(securableDisplayName);
				const securableTypeMetadata = this.viewInfo.supportedSecurableTypes.find(securableType => securableType.name === securable.type);
				permissionsTableData = securable.permissions.map(permission => {
					return [permission.permission, permission.grantor, { checked: permission.grant === true }, { checked: permission.withGrant === true }, { checked: permission.grant === false }];
				});
				permissionsTableData = securableTypeMetadata.permissions.map(permissionMetadata => {
					const permission = securable.permissions.find(securablePermission => securablePermission.permission === permissionMetadata.name);
					return [
						permissionMetadata.name,
						permission?.grantor ?? '',
						{ checked: permission?.grant === true },
						{ checked: permission?.withGrant === true },
						{ checked: permission?.grant === false }];
				});
				effectivePermissionsTableData = securable.effectivePermissions.map(permission => [permission]);
			}
		}
		this.explicitPermissionTableLabel.value = explicitPermissionsLabel;
		await this.setTableData(this.permissionTable, permissionsTableData);
		if (!this.options.isNewObject) {
			this.effectivePermissionTableLabel.value = effectivePermissionsLabel;
			await this.setTableData(this.effectivePermissionTable, effectivePermissionsTableData);
		}
	}

	private updateSecurablePermissions(): void {
		// Only save securable permissions that have grant or deny value.
		this.objectInfo.securablePermissions = deepClone(this.securablePermissions.filter((securablePermissions) => {
			return securablePermissions.permissions.some(permission => permission.grant !== undefined);
		}));
		this.objectInfo.securablePermissions.forEach(securablePermissions => {
			securablePermissions.permissions = securablePermissions.permissions.filter(permission => permission.grant !== undefined);
		});
		this.onFormFieldChange();
	}

	private getSecurableTypeDisplayName(securableType: string): string {
		const securableTypeMetadata = this.viewInfo.supportedSecurableTypes.find(securableTypeMetadata => securableTypeMetadata.name === securableType);
		return securableTypeMetadata ? securableTypeMetadata.displayName : securableType;
	}
}
