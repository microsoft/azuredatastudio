/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { HdfsModel } from '../hdfsModel';
import { IFileSource } from '../../objectExplorerNodeProvider/fileSources';
import { PermissionStatus, AclEntry, AclType, getImageForType, AclEntryScope, AclEntryPermission } from '../../hdfs/aclEntry';
import { cssStyles } from './uiConstants';
import * as loc from '../../localizedConstants';
import { HdfsError } from '../webhdfs';
import { ApiWrapper } from '../../apiWrapper';
import { IconPathHelper } from '../../iconHelper';
import { HdfsFileType } from '../fileStatus';

const permissionsTypeIconColumnWidth = 35;
const permissionsNameColumnWidth = 250;
const permissionsInheritColumnWidth = 50;
const permissionsReadColumnWidth = 50;
const permissionsWriteColumnWidth = 50;
const permissionsExecuteColumnWidth = 50;
const permissionsDeleteColumnWidth = 50;

const permissionsRowHeight = 35;
const locationLabelHeight = 23; // Fits the text size without too much white space

const checkboxSize = 20;


type PermissionCheckboxesMapping = {
	model: AclEntry,
	access: { read: azdata.CheckBoxComponent, write: azdata.CheckBoxComponent, execute: azdata.CheckBoxComponent },
	default: { read: azdata.CheckBoxComponent, write: azdata.CheckBoxComponent, execute: azdata.CheckBoxComponent }
};

export class ManageAccessDialog {

	private hdfsModel: HdfsModel;
	private viewInitialized: boolean = false;

	private modelBuilder: azdata.ModelBuilder;
	private rootLoadingComponent: azdata.LoadingComponent;
	private stickyCheckbox: azdata.CheckBoxComponent;
	private inheritDefaultsCheckbox: azdata.CheckBoxComponent;
	private posixPermissionsContainer: azdata.FlexContainer;
	private namedUsersAndGroupsPermissionsContainer: azdata.FlexContainer;
	private addUserOrGroupInput: azdata.InputBoxComponent;
	private dialog: azdata.window.Dialog;
	private applyRecursivelyButton: azdata.window.Button;
	private defaultSectionComponents: azdata.Component[] = [];
	private posixPermissionCheckboxesMapping: PermissionCheckboxesMapping[] = [];
	private namedSectionInheritCheckboxes: azdata.CheckBoxComponent[] = [];
	private addUserOrGroupSelectedType: AclType;

	constructor(private hdfsPath: string, private fileSource: IFileSource, private readonly apiWrapper: ApiWrapper) {
		this.hdfsModel = new HdfsModel(this.fileSource, this.hdfsPath);
		this.hdfsModel.onPermissionStatusUpdated(permissionStatus => this.handlePermissionStatusUpdated(permissionStatus));
	}

	public openDialog(): void {
		if (!this.dialog) {
			this.dialog = this.apiWrapper.createDialog(loc.manageAccessTitle, 'HdfsManageAccess', true);
			this.dialog.okButton.label = loc.applyText;

			this.applyRecursivelyButton = azdata.window.createButton(loc.applyRecursivelyText);
			this.applyRecursivelyButton.onClick(async () => {
				try {
					azdata.window.closeDialog(this.dialog);
					await this.hdfsModel.apply(true);
				} catch (err) {
					this.apiWrapper.showErrorMessage(loc.errorApplyingAclChanges(err instanceof HdfsError ? err.message : err));
				}
			});
			this.dialog.customButtons = [this.applyRecursivelyButton];
			this.dialog.registerCloseValidator(async (): Promise<boolean> => {
				try {
					await this.hdfsModel.apply();
					return true;
				} catch (err) {
					this.apiWrapper.showErrorMessage(loc.errorApplyingAclChanges(err instanceof HdfsError ? err.message : err));
				}
				return false;
			});
			const tab = azdata.window.createTab(loc.manageAccessTitle);
			tab.registerContent(async (modelView: azdata.ModelView) => {
				this.modelBuilder = modelView.modelBuilder;

				const rootContainer = modelView.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column', width: '100%', height: '100%' })
					.component();

				this.rootLoadingComponent = modelView.modelBuilder.loadingComponent().withItem(rootContainer).component();

				// We nest the content inside another container for the margins - getting them on the root container isn't supported
				const contentContainer = modelView.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column', width: '100%', height: '100%' })
					.component();
				rootContainer.addItem(contentContainer, { CSSStyles: { 'margin-left': '20px', 'margin-right': '20px' } });

				const locationContainer = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

				const locationLabel = modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({
						value: loc.locationTitle,
						CSSStyles: { ...cssStyles.titleCss }
					}).component();

				const pathLabel = modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({
						value: this.hdfsPath,
						title: this.hdfsPath,
						height: locationLabelHeight,
						CSSStyles: { 'user-select': 'text', 'overflow': 'hidden', 'text-overflow': 'ellipsis', ...cssStyles.titleCss }
					}).component();

				locationContainer.addItem(locationLabel,
					{
						flex: '0 0 auto',
						CSSStyles: { 'margin-bottom': '5px' }
					});
				locationContainer.addItem(pathLabel,
					{
						flex: '1 1 auto',
						CSSStyles: { 'border': '1px solid #ccc', 'padding': '5px', 'margin-left': '10px', 'min-height': `${locationLabelHeight}px` }
					});

				contentContainer.addItem(locationContainer, { flex: '0 0 auto', CSSStyles: { 'margin-top': '20px' } });

				// =====================
				// = Permissions Title =
				// =====================
				const permissionsTitle = modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({ value: loc.permissionsHeader })
					.component();
				contentContainer.addItem(permissionsTitle, { CSSStyles: { 'margin-top': '15px', ...cssStyles.titleCss } });

				// =============================
				// = POSIX permissions section =
				// =============================

				const posixPermissionsContainer = this.createPermissionsHeaderRow(modelView.modelBuilder, '', /*includeInherit*/false, /*includeStickyAndInherit*/true);
				contentContainer.addItem(posixPermissionsContainer, { CSSStyles: { ...cssStyles.tableHeaderLayoutCss } });

				// Empty initially - this is going to eventually be populated with the owner/owning/other group permissions
				this.posixPermissionsContainer = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
				contentContainer.addItem(this.posixPermissionsContainer, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '20px' } });

				// ===========================
				// = Add User Or Group Input =
				// ===========================

				const addUserOrGroupTitle = modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({ value: loc.addUserOrGroupHeader, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
					.component();
				contentContainer.addItem(addUserOrGroupTitle, { CSSStyles: { 'margin-top': '15px', ...cssStyles.titleCss } });

				const typeContainer = modelView.modelBuilder.flexContainer().withProperties({ flexFlow: 'row' }).component();
				const aclEntryTypeGroup = 'aclEntryType';
				const userTypeButton = this.createRadioButton(modelView.modelBuilder, loc.userLabel, aclEntryTypeGroup, AclType.user);
				const groupTypeButton = this.createRadioButton(modelView.modelBuilder, loc.groupLabel, aclEntryTypeGroup, AclType.group);
				userTypeButton.checked = true;
				this.addUserOrGroupSelectedType = AclType.user;

				typeContainer.addItems([userTypeButton, groupTypeButton], { flex: '0 0 auto' });
				contentContainer.addItem(typeContainer, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '5px' } });
				const addUserOrGroupInputRow = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();

				this.addUserOrGroupInput = modelView.modelBuilder.inputBox()
					.withProperties<azdata.InputBoxProperties>({
						inputType: 'text',
						placeHolder: loc.enterNamePlaceholder,
						width: 250,
						stopEnterPropagation: true
					})
					.component();
				this.addUserOrGroupInput.onEnterKeyPressed((value: string) => {
					this.hdfsModel.createAndAddAclEntry(value, this.addUserOrGroupSelectedType);
					this.addUserOrGroupInput.value = '';
				});
				const addUserOrGroupButton = modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: loc.addLabel, width: 75 }).component();
				addUserOrGroupButton.onDidClick(() => {
					this.hdfsModel.createAndAddAclEntry(this.addUserOrGroupInput.value, this.addUserOrGroupSelectedType);
					this.addUserOrGroupInput.value = '';
				});
				addUserOrGroupButton.enabled = false; // Init to disabled since we don't have any name entered in yet
				this.addUserOrGroupInput.onTextChanged(() => {
					if (this.addUserOrGroupInput.value === '') {
						addUserOrGroupButton.enabled = false;
					} else {
						addUserOrGroupButton.enabled = true;
					}
				});

				addUserOrGroupInputRow.addItem(this.addUserOrGroupInput, { flex: '0 0 auto' });
				addUserOrGroupInputRow.addItem(addUserOrGroupButton, { flex: '0 0 auto', CSSStyles: { 'margin-left': '20px' } });

				contentContainer.addItem(addUserOrGroupInputRow, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '20px' } });

				// =================================================
				// = Named Users and Groups permissions header row =
				// =================================================

				const namedUsersAndGroupsPermissionsHeaderRow = this.createPermissionsHeaderRow(modelView.modelBuilder, loc.namedUsersAndGroupsHeader, /*includeInherit*/true, /*includeStickyAndInherit*/false);
				contentContainer.addItem(namedUsersAndGroupsPermissionsHeaderRow, { CSSStyles: { ...cssStyles.tableHeaderLayoutCss } });

				// Empty initially - this is eventually going to be populated with the ACL entries set for this path
				this.namedUsersAndGroupsPermissionsContainer = modelView.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column' })
					.component();
				contentContainer.addItem(this.namedUsersAndGroupsPermissionsContainer, { flex: '1', CSSStyles: { 'overflow': 'scroll', 'min-height': '200px' } });

				this.viewInitialized = true;
				this.handlePermissionStatusUpdated(this.hdfsModel.permissionStatus);
				await modelView.initializeModel(this.rootLoadingComponent);
			});
			this.dialog.content = [tab];
		}

		this.applyRecursivelyButton.hidden = true; // Always hide the button until we get the status back saying whether this is a directory or not
		azdata.window.openDialog(this.dialog);
	}

	private handlePermissionStatusUpdated(permissionStatus: PermissionStatus): void {
		if (!permissionStatus || !this.viewInitialized) {
			return;
		}

		this.stickyCheckbox.checked = permissionStatus.stickyBit;
		this.inheritDefaultsCheckbox.checked =
			!permissionStatus.owner.getPermission(AclEntryScope.default) &&
			!permissionStatus.group.getPermission(AclEntryScope.default) &&
			!permissionStatus.other.getPermission(AclEntryScope.default);
		// Update display status for headers for the Default section - you can't set Default ACLs for non-directories so we just hide that column
		this.defaultSectionComponents.forEach(component => component.display = this.hdfsModel.fileStatus.type === HdfsFileType.Directory ? '' : 'none');
		this.applyRecursivelyButton.hidden = this.hdfsModel.fileStatus.type !== HdfsFileType.Directory;
		this.inheritDefaultsCheckbox.display = this.hdfsModel.fileStatus.type === HdfsFileType.Directory ? '' : 'none';
		// POSIX permission owner/group/other
		const ownerPermissionsRow = this.createPermissionsRow(this.modelBuilder, permissionStatus.owner, /*includeDelete*/false, /*includeInherit*/false);
		const owningGroupPermissionsRow = this.createPermissionsRow(this.modelBuilder, permissionStatus.group, /*includeDelete*/false, /*includeInherit*/false);
		const otherPermissionsRow = this.createPermissionsRow(this.modelBuilder, permissionStatus.other, /*includeDelete*/false, /*includeInherit*/false);
		this.posixPermissionsContainer.clearItems();
		this.posixPermissionsContainer.addItems([ownerPermissionsRow, owningGroupPermissionsRow, otherPermissionsRow], { CSSStyles: { 'border-bottom': cssStyles.tableBorderCss, 'border-top': cssStyles.tableBorderCss, 'margin-right': '14px' } });

		this.namedUsersAndGroupsPermissionsContainer.clearItems();
		// Named users and groups
		permissionStatus.aclEntries.forEach(entry => {
			const namedEntryRow = this.createPermissionsRow(this.modelBuilder, entry, /*includeDelete*/true, /*includeInherit*/true);
			this.namedUsersAndGroupsPermissionsContainer.addItem(namedEntryRow, { CSSStyles: { 'border-bottom': cssStyles.tableBorderCss, 'border-top': cssStyles.tableBorderCss } });
		});

		this.rootLoadingComponent.loading = false;
	}

	private createRadioButton(modelBuilder: azdata.ModelBuilder, label: string, name: string, aclEntryType: AclType): azdata.RadioButtonComponent {
		const button = modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({ label: label, name: name }).component();
		button.onDidClick(() => {
			this.addUserOrGroupSelectedType = aclEntryType;
		});
		return button;
	}

	private createPermissionsRow(builder: azdata.ModelBuilder, entry: AclEntry, includeDelete: boolean, includeInherit: boolean): azdata.FlexContainer {
		const rowContainer = builder.flexContainer().withLayout({ flexFlow: 'row', height: permissionsRowHeight }).component();

		// Icon
		const iconCell = builder.image()
			.withProperties<azdata.ImageComponentProperties>({
				iconPath: getImageForType(entry.type),
				width: permissionsTypeIconColumnWidth,
				height: permissionsRowHeight,
				iconWidth: 20,
				iconHeight: 20
			})
			.component();
		rowContainer.addItem(iconCell, { flex: '0 0 auto' });

		// Name
		const nameCell = builder.text().withProperties({ value: entry.displayName }).component();
		rowContainer.addItem(nameCell);

		// Access - Read
		const accessReadComponents = createCheckbox(builder, entry.getPermission(AclEntryScope.access).read, true, permissionsReadColumnWidth, permissionsRowHeight);
		rowContainer.addItem(accessReadComponents.container, { flex: '0 0 auto' });
		accessReadComponents.checkbox.onChanged(() => {
			entry.getPermission(AclEntryScope.access).read = accessReadComponents.checkbox.checked;
		});

		// Access - Write
		const accessWriteComponents = createCheckbox(builder, entry.getPermission(AclEntryScope.access).write, true, permissionsWriteColumnWidth, permissionsRowHeight);
		rowContainer.addItem(accessWriteComponents.container, { flex: '0 0 auto' });
		accessWriteComponents.checkbox.onChanged(() => {
			entry.getPermission(AclEntryScope.access).write = accessWriteComponents.checkbox.checked;
		});

		// Access - Execute
		const accessExecuteComponents = createCheckbox(builder, entry.getPermission(AclEntryScope.access).execute, true, permissionsExecuteColumnWidth, permissionsRowHeight);
		rowContainer.addItem(accessExecuteComponents.container, { flex: '0 0 auto', CSSStyles: { 'border-right': this.hdfsModel.fileStatus.type === HdfsFileType.Directory ? cssStyles.tableBorderCss : '' } });
		accessExecuteComponents.checkbox.onChanged(() => {
			entry.getPermission(AclEntryScope.access).execute = accessExecuteComponents.checkbox.checked;
		});

		const permissionsCheckboxesMapping: PermissionCheckboxesMapping = {
			model: entry,
			access: { read: accessReadComponents.checkbox, write: accessWriteComponents.checkbox, execute: accessExecuteComponents.checkbox },
			default: { read: undefined, write: undefined, execute: undefined }
		};

		// Only directories can set ACL defaults so we hide the column for non-directories
		if (this.hdfsModel.fileStatus.type === HdfsFileType.Directory) {

			const defaultPermission = entry.getPermission(AclEntryScope.default);

			const defaultReadComponents = createCheckbox(builder, defaultPermission && defaultPermission.read, !!defaultPermission, permissionsReadColumnWidth, permissionsRowHeight);
			const defaultWriteComponents = createCheckbox(builder, defaultPermission && defaultPermission.write, !!defaultPermission, permissionsWriteColumnWidth, permissionsRowHeight);
			const defaultExecuteComponents = createCheckbox(builder, defaultPermission && defaultPermission.execute, !!defaultPermission, permissionsExecuteColumnWidth, permissionsRowHeight);
			permissionsCheckboxesMapping.default = { read: defaultReadComponents.checkbox, write: defaultWriteComponents.checkbox, execute: defaultExecuteComponents.checkbox };

			// Default - Inherit
			if (includeInherit) {
				const defaultInheritComponents = createCheckbox(builder, !defaultPermission, !this.inheritDefaultsCheckbox.checked, permissionsInheritColumnWidth, permissionsRowHeight);
				defaultInheritComponents.checkbox.onChanged(() => {
					defaultReadComponents.checkbox.enabled = !defaultInheritComponents.checkbox.checked;
					defaultWriteComponents.checkbox.enabled = !defaultInheritComponents.checkbox.checked;
					defaultExecuteComponents.checkbox.enabled = !defaultInheritComponents.checkbox.checked;
					if (defaultInheritComponents.checkbox.checked) {
						entry.removePermission(AclEntryScope.default);
						defaultReadComponents.checkbox.checked = false;
						defaultWriteComponents.checkbox.checked = false;
						defaultExecuteComponents.checkbox.checked = false;
					} else {
						// Default to the access settings - this is what HDFS does if you don't
						// specify the complete set of default ACLs for owner, owning group and other
						const accessRead = accessReadComponents.checkbox.checked;
						const accessWrite = accessWriteComponents.checkbox.checked;
						const accessExecute = accessExecuteComponents.checkbox.checked;
						defaultReadComponents.checkbox.checked = accessRead;
						defaultWriteComponents.checkbox.checked = accessWrite;
						defaultExecuteComponents.checkbox.checked = accessExecute;
						entry.addPermission(AclEntryScope.default,
							new AclEntryPermission(accessRead, accessWrite, accessExecute));
					}
				});
				this.namedSectionInheritCheckboxes.push(defaultInheritComponents.checkbox);
				rowContainer.addItem(defaultInheritComponents.container, { flex: '0 0 auto', CSSStyles: { 'border-right': cssStyles.tableBorderCss } });
			}


			// Default - Read
			rowContainer.addItem(defaultReadComponents.container, { flex: '0 0 auto' });
			defaultReadComponents.checkbox.onChanged(() => {
				entry.getPermission(AclEntryScope.default).read = defaultReadComponents.checkbox.checked;
			});

			// Default - Write
			rowContainer.addItem(defaultWriteComponents.container, { flex: '0 0 auto' });
			defaultWriteComponents.checkbox.onChanged(() => {
				entry.getPermission(AclEntryScope.default).write = defaultWriteComponents.checkbox.checked;
			});

			// Default - Execute
			rowContainer.addItem(defaultExecuteComponents.container, { flex: '0 0 auto' });
			defaultExecuteComponents.checkbox.onChanged(() => {
				entry.getPermission(AclEntryScope.default).execute = defaultExecuteComponents.checkbox.checked;
			});
		}

		this.posixPermissionCheckboxesMapping.push(permissionsCheckboxesMapping);

		const deleteContainer = builder.flexContainer().withLayout({ width: permissionsDeleteColumnWidth, height: permissionsRowHeight }).component();

		if (includeDelete) {
			const deleteButton = builder.button()
				.withProperties<azdata.ButtonProperties>(
					{
						label: '',
						title: loc.deleteTitle,
						iconPath: IconPathHelper.delete,
						width: 20,
						height: 20
					})
				.component();
			deleteButton.onDidClick(() => { this.hdfsModel.deleteAclEntry(entry); });
			deleteContainer.addItem(deleteButton);
		}
		rowContainer.addItem(deleteContainer, { flex: '0 0 auto', CSSStyles: { 'margin-top': '7px', 'margin-left': '5px' } });

		return rowContainer;
	}

	/**
	 * Creates the header row for the permissions tables. This contains headers for the name and read/write/execute for the
	 * access section. If the path is for a directory then a default section is included for specifying default permissions.
	 * @param modelBuilder The builder used to create the model components
	 * @param nameColumnText The text to display for the name column
	 */
	private createPermissionsHeaderRow(modelBuilder: azdata.ModelBuilder, nameColumnText: string, includeInherit: boolean, includeStickyAndInherit: boolean): azdata.FlexContainer {
		const rowsContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();

		// Section Headers
		const sectionHeaderContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', justifyContent: 'flex-end' }).component();

		if (includeStickyAndInherit) {
			this.inheritDefaultsCheckbox = modelBuilder.checkBox()
				.withProperties<azdata.CheckBoxProperties>({
					width: checkboxSize,
					height: checkboxSize,
					checked: false, // Will be set when we get the model update
					label: loc.inheritDefaultsLabel
				})
				.component();

			this.inheritDefaultsCheckbox.onChanged(() => {
				if (this.inheritDefaultsCheckbox.checked) {
					this.namedSectionInheritCheckboxes.forEach(c => {
						c.enabled = false;
						c.checked = true;
					});
				} else {
					this.namedSectionInheritCheckboxes.forEach(c => {
						c.enabled = true;
						c.checked = false;
					});
				}
				// Go through each of the rows for owner/owning group/other and update
				// their checkboxes based on the new value of the inherit checkbox
				this.posixPermissionCheckboxesMapping.forEach(m => {
					m.default.read.enabled = !this.inheritDefaultsCheckbox.checked;
					m.default.write.enabled = !this.inheritDefaultsCheckbox.checked;
					m.default.execute.enabled = !this.inheritDefaultsCheckbox.checked;
					if (this.inheritDefaultsCheckbox.checked) {
						m.model.removePermission(AclEntryScope.default);
						m.default.read.checked = false;
						m.default.write.checked = false;
						m.default.execute.checked = false;
					} else {
						// Default to the access settings - this is what HDFS does if you don't
						// specify the complete set of default ACLs for owner, owning group and other
						const accessRead = m.access.read.checked;
						const accessWrite = m.access.write.checked;
						const accessExecute = m.access.execute.checked;
						m.default.read.checked = accessRead;
						m.default.write.checked = accessWrite;
						m.default.execute.checked = accessExecute;
						m.model.addPermission(AclEntryScope.default, new AclEntryPermission(accessRead, accessWrite, accessExecute));
					}
				});
			});
			this.defaultSectionComponents.push(this.inheritDefaultsCheckbox);
			sectionHeaderContainer.addItem(this.inheritDefaultsCheckbox);
		}

		// Access
		const accessSectionHeader = modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: loc.accessHeader,
				CSSStyles: {
					'width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`,
					'min-width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`,
					...cssStyles.permissionsTableHeaderCss
				}
			})
			.component();
		sectionHeaderContainer.addItem(accessSectionHeader, { flex: '0 0 auto' });

		// Default
		const defaultSectionHeader = modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: loc.defaultHeader,
				CSSStyles: {
					'width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`,
					'min-width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`,
					...cssStyles.permissionsTableHeaderCss
				}
			})
			.component();
		sectionHeaderContainer.addItem(defaultSectionHeader, { flex: '0 0 auto' });
		this.defaultSectionComponents.push(defaultSectionHeader);

		// Delete - just used as a spacer
		const deleteSectionHeader = modelBuilder.text().component();
		sectionHeaderContainer.addItem(deleteSectionHeader, { CSSStyles: { 'width': `${permissionsDeleteColumnWidth}px`, 'min-width': `${permissionsDeleteColumnWidth}px` } });

		rowsContainer.addItem(sectionHeaderContainer);

		// Table headers
		const headerRowContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();

		if (includeStickyAndInherit) {
			// Sticky
			this.stickyCheckbox = modelBuilder.checkBox()
				.withProperties<azdata.CheckBoxProperties>({
					width: checkboxSize,
					height: checkboxSize,
					checked: false, // Will be set when we get the model update
					label: loc.stickyLabel
				})
				.component();
			this.stickyCheckbox.onChanged(() => {
				this.hdfsModel.permissionStatus.stickyBit = this.stickyCheckbox.checked;
			});
			headerRowContainer.addItem(this.stickyCheckbox);
		}

		// Name
		const nameCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: nameColumnText }).component();
		headerRowContainer.addItem(nameCell, { flex: '1 1 auto', CSSStyles: { 'width': `${permissionsNameColumnWidth}px`, 'min-width': `${permissionsNameColumnWidth}px`, ...cssStyles.tableHeaderCss } });

		// Access Permissions Group
		const accessReadCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.readHeader, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
		headerRowContainer.addItem(accessReadCell, { CSSStyles: { 'width': `${permissionsReadColumnWidth}px`, 'min-width': `${permissionsReadColumnWidth}px` } });
		const accessWriteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.writeHeader, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
		headerRowContainer.addItem(accessWriteCell, { CSSStyles: { 'width': `${permissionsWriteColumnWidth}px`, 'min-width': `${permissionsWriteColumnWidth}px` } });
		const accessExecuteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.executeHeader, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
		headerRowContainer.addItem(accessExecuteCell, { CSSStyles: { 'width': `${permissionsExecuteColumnWidth}px`, 'min-width': `${permissionsExecuteColumnWidth}px`, 'margin-right': '5px' } });
		// Default Permissions Group
		const defaultPermissionsHeadersContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		if (includeInherit) {
			const inheritCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.inheritDefaultsLabel, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
			defaultPermissionsHeadersContainer.addItem(inheritCell, { CSSStyles: { 'width': `${permissionsInheritColumnWidth}px`, 'min-width': `${permissionsInheritColumnWidth}px` } });
		}
		const defaultReadCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.readHeader, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
		defaultPermissionsHeadersContainer.addItem(defaultReadCell, { CSSStyles: { 'width': `${permissionsReadColumnWidth}px`, 'min-width': `${permissionsReadColumnWidth}px` } });
		const defaultWriteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.writeHeader, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
		defaultPermissionsHeadersContainer.addItem(defaultWriteCell, { CSSStyles: { 'width': `${permissionsWriteColumnWidth}px`, 'min-width': `${permissionsWriteColumnWidth}px` } });
		const defaultExecuteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.executeHeader, CSSStyles: { ...cssStyles.permissionsTableHeaderCss } }).component();
		defaultPermissionsHeadersContainer.addItem(defaultExecuteCell, { CSSStyles: { 'width': `${permissionsExecuteColumnWidth}px`, 'min-width': `${permissionsExecuteColumnWidth}px` } });
		headerRowContainer.addItem(defaultPermissionsHeadersContainer, { flex: '0 0 auto' });
		this.defaultSectionComponents.push(defaultPermissionsHeadersContainer);

		// Delete
		const deleteCell = modelBuilder.text().component();
		headerRowContainer.addItem(deleteCell, { CSSStyles: { 'width': `${permissionsDeleteColumnWidth}px`, 'min-width': `${permissionsDeleteColumnWidth}px` } });

		rowsContainer.addItem(headerRowContainer);

		return rowsContainer;
	}
}

function createCheckbox(builder: azdata.ModelBuilder, checked: boolean, enabled: boolean, containerWidth: number, containerHeight: number): { container: azdata.FlexContainer, checkbox: azdata.CheckBoxComponent } {
	const checkbox = builder.checkBox()
		.withProperties({ checked: checked, enabled: enabled, height: checkboxSize, width: checkboxSize }).component();
	const container = builder.flexContainer()
		.withLayout({ width: containerWidth, height: containerHeight })
		.component();
	container.addItem(checkbox, { CSSStyles: { ...cssStyles.permissionCheckboxCss } });
	return {
		container: container,
		checkbox: checkbox
	};

}
