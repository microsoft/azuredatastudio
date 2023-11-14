/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import * as localizedConstants from '../localizedConstants';

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { FindObjectDialog, FindObjectDialogResult } from './findObjectDialog';
import { deepClone } from '../../util/objects';
import { DefaultTableWidth, DialogButton, getTableHeight } from '../../ui/dialogBase';
import { ObjectSelectionMethod, ObjectSelectionMethodDialog } from './objectSelectionMethodDialog';
import { DatabaseLevelPrincipalViewInfo, SecurablePermissionItem, SecurablePermissions, SecurityPrincipalObject, SecurityPrincipalViewInfo } from '../interfaces';

const GrantColumnIndex = 2;
const WithGrantColumnIndex = 3;
const DenyColumnIndex = 4;

export interface PrincipalDialogOptions extends ObjectManagementDialogOptions {
	isDatabaseLevelPrincipal: boolean;
	supportEffectivePermissions: boolean;
}

/**
 * Base class for security principal dialogs such as user, role, etc.
 */
export abstract class PrincipalDialogBase<ObjectInfoType extends SecurityPrincipalObject, ViewInfoType extends SecurityPrincipalViewInfo<ObjectInfoType>> extends ObjectManagementDialogBase<ObjectInfoType, ViewInfoType> {
	protected securableTable: azdata.TableComponent;
	protected permissionTable: azdata.TableComponent;
	protected effectivePermissionTable: azdata.TableComponent;
	protected securableSection: azdata.GroupContainer;
	protected explicitPermissionTableLabel: azdata.TextComponent;
	protected effectivePermissionTableLabel: azdata.TextComponent;
	private securablePermissions: SecurablePermissions[] = [];

	constructor(objectManagementService: mssql.IObjectManagementService, private readonly dialogOptions: PrincipalDialogOptions) {
		super(objectManagementService, dialogOptions);
	}

	protected override async initializeUI(): Promise<void> {
		this.securablePermissions = deepClone(this.objectInfo.securablePermissions) ?? [];
		this.initializeSecurableSection();
	}

	private initializeSecurableSection(): void {
		const items: azdata.Component[] = [];
		const securableTableColumns = [localizedConstants.NameText, localizedConstants.ObjectTypeText];
		if (this.dialogOptions.isDatabaseLevelPrincipal) {
			securableTableColumns.splice(1, 0, localizedConstants.SchemaText);
		}
		this.securableTable = this.createTable(localizedConstants.SecurablesText, securableTableColumns, this.getSecurableTableData());
		const addButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.AddSecurableAriaLabel,
			buttonHandler: (button) => this.onAddSecurableButtonClicked(button)
		};
		const removeButtonComponent: DialogButton = {
			buttonAriaLabel: localizedConstants.RemoveSecurableAriaLabel,
			buttonHandler: () => this.onRemoveSecurableButtonClicked()
		};
		const buttonContainer = this.addButtonsForTable(this.securableTable, addButtonComponent, removeButtonComponent);
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
			width: DefaultTableWidth
		}).component();
		this.disposables.push(this.permissionTable.onCellAction(async (arg: azdata.ICheckboxCellActionEventArgs) => {
			const permissionName = this.permissionTable.data[arg.row][0] as string;
			const securable = this.securablePermissions[this.securableTable.selectedRows[0]];
			let permission: SecurablePermissionItem = securable.permissions.find(securablePermission => securablePermission.permission === permissionName);
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
		if (this.showEffectivePermissions) {
			this.effectivePermissionTableLabel = this.modelView.modelBuilder.text().withProps({ value: localizedConstants.EffectivePermissionsTableLabel }).component();
			this.effectivePermissionTable = this.createTable(localizedConstants.EffectivePermissionsTableLabel, [localizedConstants.PermissionColumnHeader], []);
			items.push(this.effectivePermissionTableLabel, this.effectivePermissionTable);
		}
		this.securableSection = this.createGroup(localizedConstants.SecurablesText, items, true, true);
	}

	private async onAddSecurableButtonClicked(button: azdata.ButtonComponent): Promise<void> {
		const selectedObjects: mssql.ObjectManagement.SearchResultItem[] = [];
		if (this.dialogOptions.isDatabaseLevelPrincipal) {
			const methodDialog = new ObjectSelectionMethodDialog({
				objectTypes: this.viewInfo.supportedSecurableTypes,
				schemas: (<DatabaseLevelPrincipalViewInfo<SecurityPrincipalObject>><unknown>this.viewInfo).schemas,
			});
			await methodDialog.open();
			const methodResult = await methodDialog.waitForClose();
			if (methodResult) {
				switch (methodResult.method) {
					case ObjectSelectionMethod.AllObjectsOfTypes:
						selectedObjects.push(... await this.searchForObjects(methodResult.objectTypes.map(item => item.name)));
						break;
					case ObjectSelectionMethod.AllObjectsOfSchema:
						selectedObjects.push(... await this.searchForObjects(this.viewInfo.supportedSecurableTypes.map(item => item.name), methodResult.schema));
						break;
					default:
						const objectsResult = await this.openFindObjectsDialog();
						if (objectsResult) {
							selectedObjects.push(...objectsResult.selectedObjects);
						}
						break;
				}
			}
		} else {
			const result = await this.openFindObjectsDialog();
			if (result) {
				selectedObjects.push(...result.selectedObjects);
			}
		}

		if (selectedObjects.length > 0) {
			selectedObjects.forEach(obj => {
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
		} else {
			this.dialogObject.message = {
				text: localizedConstants.NoSecurableObjectsFoundInfoMessage,
				level: azdata.window.MessageLevel.Information
			};
		}
		await button.focus();
	}

	private async searchForObjects(objectTypes: string[], schema: string = undefined): Promise<mssql.ObjectManagement.SearchResultItem[]> {
		this.updateLoadingStatus(true, localizedConstants.LoadingObjectsText);
		const result = await this.objectManagementService.search(this.contextId, objectTypes, undefined, schema);
		this.updateLoadingStatus(false, localizedConstants.LoadingObjectsText, localizedConstants.LoadingObjectsCompletedText(result.length));
		return result;
	}

	private async openFindObjectsDialog(): Promise<FindObjectDialogResult> {
		const dialog = new FindObjectDialog(this.objectManagementService, {
			objectTypes: this.viewInfo.supportedSecurableTypes,
			selectAllObjectTypes: false,
			multiSelect: true,
			contextId: this.contextId,
			title: localizedConstants.SelectSecurablesDialogTitle,
			showSchemaColumn: this.dialogOptions.isDatabaseLevelPrincipal
		});
		await dialog.open();
		return await dialog.waitForClose();
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
			if (this.dialogOptions.isDatabaseLevelPrincipal) {
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
		if (this.showEffectivePermissions) {
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

	private get showEffectivePermissions(): boolean {
		return !this.dialogOptions.isNewObject && this.dialogOptions.supportEffectivePermissions;
	}
}
