/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { HdfsModel } from '../hdfsModel';
import { IFileSource } from '../../objectExplorerNodeProvider/fileSources';
import { PermissionStatus, AclEntry, AclType, getImageForType, AclEntryScope, AclEntryPermission, PermissionType } from '../../hdfs/aclEntry';
import { cssStyles } from './uiConstants';
import * as loc from '../../localizedConstants';
import { HdfsError } from '../webhdfs';
import { IconPathHelper } from '../../iconHelper';
import { HdfsFileType } from '../fileStatus';

const permissionsTypeIconColumnWidth = 35;
const permissionsDeleteColumnWidth = 50;

const permissionsCheckboxColumnWidth = 50;

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
	private modelInitialized: boolean = false;
	private modelBuilder: azdata.ModelBuilder;
	private rootContainer: azdata.FlexContainer;
	private rootLoadingComponent: azdata.LoadingComponent;
	private stickyCheckbox: azdata.CheckBoxComponent;
	private inheritDefaultsCheckbox: azdata.CheckBoxComponent;
	private posixPermissionsContainer: azdata.FlexContainer;
	private namedUsersAndGroupsPermissionsContainer: azdata.FlexContainer;
	private addUserOrGroupInput: azdata.InputBoxComponent;
	private dialog: azdata.window.Dialog;
	private applyRecursivelyButton: azdata.window.Button;
	private posixPermissionCheckboxesMapping: PermissionCheckboxesMapping[] = [];
	private namedSectionInheritCheckboxes: azdata.CheckBoxComponent[] = [];
	private addUserOrGroupSelectedType: AclType;
	private onViewInitializedEvent: vscode.EventEmitter<void> = new vscode.EventEmitter();

	constructor(private hdfsPath: string, private fileSource: IFileSource) {
		this.hdfsModel = new HdfsModel(this.fileSource, this.hdfsPath);
		this.hdfsModel.onPermissionStatusUpdated(permissionStatus => this.handlePermissionStatusUpdated(permissionStatus));
	}

	public openDialog(): void {
		if (!this.dialog) {
			this.dialog = azdata.window.createModelViewDialog(loc.manageAccessTitle, 'HdfsManageAccess', true);
			this.dialog.okButton.label = loc.applyText;

			this.applyRecursivelyButton = azdata.window.createButton(loc.applyRecursivelyText);
			this.applyRecursivelyButton.onClick(async () => {
				try {
					azdata.window.closeDialog(this.dialog);
					await this.hdfsModel.apply(true);
				} catch (err) {
					vscode.window.showErrorMessage(loc.errorApplyingAclChanges(err instanceof HdfsError ? err.message : err));
				}
			});
			this.dialog.customButtons = [this.applyRecursivelyButton];
			this.dialog.registerCloseValidator(async (): Promise<boolean> => {
				try {
					await this.hdfsModel.apply();
					return true;
				} catch (err) {
					vscode.window.showErrorMessage(loc.errorApplyingAclChanges(err instanceof HdfsError ? err.message : err));
				}
				return false;
			});
			const tab = azdata.window.createTab(loc.manageAccessTitle);
			tab.registerContent(async (modelView: azdata.ModelView) => {
				this.modelBuilder = modelView.modelBuilder;

				this.rootContainer = modelView.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column', width: '100%', height: '100%' })
					.component();

				this.rootLoadingComponent = modelView.modelBuilder.loadingComponent().withItem(this.rootContainer).component();

				await modelView.initializeModel(this.rootLoadingComponent);
				this.modelInitialized = true;
				this.handlePermissionStatusUpdated(this.hdfsModel.permissionStatus);
			});
			this.dialog.content = [tab];
		}

		this.applyRecursivelyButton.hidden = true; // Always hide the button until we get the status back saying whether this is a directory or not
		azdata.window.openDialog(this.dialog);
	}

	private initializeView(permissionStatus: PermissionStatus): void {
		// We nest the content inside another container for the margins - getting them on the root container isn't supported
		const contentContainer = this.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column', width: '100%', height: '100%' })
			.component();
		this.rootContainer.addItem(contentContainer, { CSSStyles: { 'margin-left': '20px', 'margin-right': '20px' } });

		const locationContainer = this.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		const locationLabel = this.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: loc.locationTitle,
				CSSStyles: { ...cssStyles.titleCss }
			}).component();

		const pathLabel = this.modelBuilder.text()
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
		const permissionsTitle = this.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.permissionsHeader })
			.component();
		contentContainer.addItem(permissionsTitle, { CSSStyles: { 'margin-top': '15px', ...cssStyles.titleCss } });

		// ====================
		// = Inherit Defaults =
		// ====================

		// Defaults are only settable for directories
		if (this.hdfsModel.fileStatus.type === HdfsFileType.Directory) {
			contentContainer.addItem(this.createInheritDefaultsCheckbox());
		}

		// ==========
		// = Sticky =
		// ==========
		this.stickyCheckbox = this.modelBuilder.checkBox()
			.withProperties<azdata.CheckBoxProperties>({
				width: checkboxSize,
				height: checkboxSize,
				checked: permissionStatus.stickyBit,
				label: loc.stickyLabel
			}).component();
		this.stickyCheckbox.onChanged(() => {
			this.hdfsModel.permissionStatus.stickyBit = this.stickyCheckbox.checked;
		});
		contentContainer.addItem(this.stickyCheckbox);

		// =============================
		// = POSIX permissions section =
		// =============================

		const posixPermissionsSectionHeaderRow = this.createPermissionsSectionHeaderRow(0, 0);
		contentContainer.addItem(posixPermissionsSectionHeaderRow, { CSSStyles: { ...cssStyles.tableHeaderLayoutCss } });

		this.posixPermissionsContainer = this.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		contentContainer.addItem(this.posixPermissionsContainer, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '20px' } });

		// ===========================
		// = Add User Or Group Input =
		// ===========================

		const addUserOrGroupTitle = this.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.addUserOrGroupHeader, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
			.component();
		contentContainer.addItem(addUserOrGroupTitle, { CSSStyles: { 'margin-top': '15px', ...cssStyles.titleCss } });

		const typeContainer = this.modelBuilder.flexContainer().withProperties({ flexFlow: 'row' }).component();
		const aclEntryTypeGroup = 'aclEntryType';
		const userTypeButton = this.createRadioButton(this.modelBuilder, loc.userLabel, aclEntryTypeGroup, AclType.user);
		const groupTypeButton = this.createRadioButton(this.modelBuilder, loc.groupLabel, aclEntryTypeGroup, AclType.group);
		userTypeButton.checked = true;
		this.addUserOrGroupSelectedType = AclType.user;

		typeContainer.addItems([userTypeButton, groupTypeButton], { flex: '0 0 auto' });
		contentContainer.addItem(typeContainer, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '5px' } });
		const addUserOrGroupInputRow = this.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();

		this.addUserOrGroupInput = this.modelBuilder.inputBox()
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
		const addUserOrGroupButton = this.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: loc.addLabel, width: 75 }).component();
		addUserOrGroupButton.onDidClick(() => {
			this.hdfsModel.createAndAddAclEntry(this.addUserOrGroupInput.value, this.addUserOrGroupSelectedType);
			this.addUserOrGroupInput.value = '';
		});
		addUserOrGroupButton.enabled = false; // Init to disabled since we don't have any name entered in yet
		this.addUserOrGroupInput.onTextChanged(() => {
			addUserOrGroupButton.enabled = this.addUserOrGroupInput.value !== '';
		});

		addUserOrGroupInputRow.addItem(this.addUserOrGroupInput, { flex: '0 0 auto' });
		addUserOrGroupInputRow.addItem(addUserOrGroupButton, { flex: '0 0 auto', CSSStyles: { 'margin-left': '20px' } });

		contentContainer.addItem(addUserOrGroupInputRow, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '20px' } });

		// =================================================
		// = Named Users and Groups permissions header row =
		// =================================================

		const namedUsersAndGroupsSectionsHeaderRow = this.createPermissionsSectionHeaderRow(permissionsDeleteColumnWidth, permissionsCheckboxColumnWidth);
		contentContainer.addItem(namedUsersAndGroupsSectionsHeaderRow, { CSSStyles: { ...cssStyles.tableHeaderLayoutCss } });

		this.namedUsersAndGroupsPermissionsContainer = this.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();
		contentContainer.addItem(this.namedUsersAndGroupsPermissionsContainer, { flex: '1', CSSStyles: { 'overflow': 'scroll', 'min-height': '200px' } });
		this.viewInitialized = true;
		this.onViewInitializedEvent.fire();
	}

	private handlePermissionStatusUpdated(permissionStatus: PermissionStatus): void {
		if (!permissionStatus || !this.modelInitialized) {
			return;
		}

		// If this is the first time go through and create the UI components now that we have a model to use
		if (!this.viewInitialized) {
			this.initializeView(permissionStatus);
		}

		this.eventuallyRunOnInitialized(() => {
			this.stickyCheckbox.checked = permissionStatus.stickyBit;
			if (this.hdfsModel.fileStatus.type === HdfsFileType.Directory) {
				this.inheritDefaultsCheckbox.checked =
					!permissionStatus.owner.getPermission(AclEntryScope.default) &&
					!permissionStatus.group.getPermission(AclEntryScope.default) &&
					!permissionStatus.other.getPermission(AclEntryScope.default);
			}

			this.applyRecursivelyButton.hidden = this.hdfsModel.fileStatus.type !== HdfsFileType.Directory;

			this.posixPermissionsContainer.clearItems();

			const posixPermissionData = [permissionStatus.owner, permissionStatus.group, permissionStatus.other].map(aclEntry => {
				return this.createPermissionsTableRow(aclEntry, false/*includeDelete*/, false/*includeInherit*/);
			});

			const posixPermissionsNamesColumnWidth = 800 + (this.hdfsModel.fileStatus.type === HdfsFileType.Directory ? 0 : permissionsCheckboxColumnWidth * 3);
			const namedUsersAndGroupsPermissionsNamesColumnWidth = 700 + (this.hdfsModel.fileStatus.type === HdfsFileType.Directory ? 0 : permissionsCheckboxColumnWidth * 3);

			// Default set of columns that are always shown
			let posixPermissionsColumns = [
				this.createTableColumn('', loc.userOrGroupIcon, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
				this.createTableColumn('', loc.defaultUserAndGroups, posixPermissionsNamesColumnWidth, azdata.DeclarativeDataType.string),
				this.createTableColumn(loc.readHeader, `${loc.accessHeader} ${loc.readHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
				this.createTableColumn(loc.writeHeader, `${loc.accessHeader} ${loc.writeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
				this.createTableColumn(loc.executeHeader, `${loc.accessHeader} ${loc.executeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component)];
			let namedUsersAndGroupsColumns = [
				this.createTableColumn('', loc.userOrGroupIcon, 50, azdata.DeclarativeDataType.component),
				this.createTableColumn(loc.namedUsersAndGroupsHeader, loc.namedUsersAndGroupsHeader, namedUsersAndGroupsPermissionsNamesColumnWidth, azdata.DeclarativeDataType.string),
				this.createTableColumn(loc.readHeader, `${loc.accessHeader} ${loc.readHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
				this.createTableColumn(loc.writeHeader, `${loc.accessHeader} ${loc.writeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
				this.createTableColumn(loc.executeHeader, `${loc.accessHeader} ${loc.executeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component)];

			// Additional columns that are only shown for directories
			if (this.hdfsModel.fileStatus.type === HdfsFileType.Directory) {
				posixPermissionsColumns = posixPermissionsColumns.concat([
					this.createTableColumn(loc.readHeader, `${loc.defaultHeader} ${loc.readHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
					this.createTableColumn(loc.writeHeader, `${loc.defaultHeader} ${loc.writeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
					this.createTableColumn(loc.executeHeader, `${loc.defaultHeader} ${loc.executeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component)
				]);
				namedUsersAndGroupsColumns = namedUsersAndGroupsColumns.concat([
					this.createTableColumn(loc.inheritDefaultsLabel, loc.inheritDefaultsLabel, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
					this.createTableColumn(loc.readHeader, `${loc.defaultHeader} ${loc.readHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
					this.createTableColumn(loc.writeHeader, `${loc.defaultHeader} ${loc.writeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
					this.createTableColumn(loc.executeHeader, `${loc.defaultHeader} ${loc.executeHeader}`, permissionsCheckboxColumnWidth, azdata.DeclarativeDataType.component),
				]);
			}
			namedUsersAndGroupsColumns.push(this.createTableColumn('', loc.deleteTitle, permissionsDeleteColumnWidth, azdata.DeclarativeDataType.component));

			const posixPermissionsTable = this.modelBuilder.declarativeTable()
				.withProperties<azdata.DeclarativeTableProperties>(
					{
						columns: posixPermissionsColumns,
						data: posixPermissionData
					}).component();

			this.posixPermissionsContainer.addItem(posixPermissionsTable, { CSSStyles: { 'margin-right': '12px' } });

			this.namedUsersAndGroupsPermissionsContainer.clearItems();

			const namedUsersAndGroupsData = permissionStatus.aclEntries.map(aclEntry => {
				return this.createPermissionsTableRow(aclEntry, true/*includeDelete*/, this.hdfsModel.fileStatus.type === HdfsFileType.Directory/*includeInherit*/);
			});

			const namedUsersAndGroupsTable = this.modelBuilder.declarativeTable()
				.withProperties<azdata.DeclarativeTableProperties>(
					{
						columns: namedUsersAndGroupsColumns,
						data: namedUsersAndGroupsData
					}).component();

			this.namedUsersAndGroupsPermissionsContainer.addItem(namedUsersAndGroupsTable);

			this.rootLoadingComponent.loading = false;

			this.addUserOrGroupInput.focus();
		});
	}

	private createRadioButton(modelBuilder: azdata.ModelBuilder, label: string, name: string, aclEntryType: AclType): azdata.RadioButtonComponent {
		const button = modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({ label: label, name: name }).component();
		button.onDidClick(() => {
			this.addUserOrGroupSelectedType = aclEntryType;
		});
		return button;
	}

	private createTableColumn(header: string, ariaLabel: string, width: number, type: azdata.DeclarativeDataType): azdata.DeclarativeTableColumn {
		return {
			displayName: header,
			ariaLabel: ariaLabel,
			valueType: type,
			isReadOnly: true,
			width: width,
			headerCssStyles: {
				'border': 'none',
				'background-color': '#FFFFFF',
				'padding': '0px',
				...cssStyles.permissionsTableHeaderCss
			},
			rowCssStyles: {
				'border-top': 'solid 1px #ccc',
				'border-bottom': 'solid 1px #ccc',
				'border-left': 'none',
				'border-right': 'none',
				'padding': '0px'
			},
		};
	}

	private createImageComponent(type: AclType | PermissionType): azdata.ImageComponent {
		const imageProperties = getImageForType(type);
		return this.modelBuilder.image()
			.withProperties<azdata.ImageComponentProperties>({
				iconPath: imageProperties.iconPath,
				width: permissionsTypeIconColumnWidth,
				height: permissionsRowHeight,
				iconWidth: 20,
				iconHeight: 20,
				title: imageProperties.title
			}).component();
	}

	private createPermissionsTableRow(aclEntry: AclEntry, includeDelete: boolean, includeInherit: boolean): any[] {
		// Access Read
		const accessReadComponents = createCheckbox(this.modelBuilder, aclEntry.getPermission(AclEntryScope.access).read, true, permissionsCheckboxColumnWidth, permissionsRowHeight, `${loc.accessHeader} ${loc.readHeader}`);
		accessReadComponents.checkbox.onChanged(() => {
			aclEntry.getPermission(AclEntryScope.access).read = accessReadComponents.checkbox.checked;
		});

		// Access Write
		const accessWriteComponents = createCheckbox(this.modelBuilder, aclEntry.getPermission(AclEntryScope.access).write, true, permissionsCheckboxColumnWidth, permissionsRowHeight, `${loc.accessHeader} ${loc.writeHeader}`);
		accessWriteComponents.checkbox.onChanged(() => {
			aclEntry.getPermission(AclEntryScope.access).write = accessWriteComponents.checkbox.checked;
		});

		// Access Execute
		const accessExecuteComponents = createCheckbox(this.modelBuilder, aclEntry.getPermission(AclEntryScope.access).execute, true, permissionsCheckboxColumnWidth, permissionsRowHeight, `${loc.accessHeader} ${loc.executeHeader}`);
		accessExecuteComponents.checkbox.onChanged(() => {
			aclEntry.getPermission(AclEntryScope.access).execute = accessExecuteComponents.checkbox.checked;
		});

		const permissionsCheckboxesMapping: PermissionCheckboxesMapping = {
			model: aclEntry,
			access: { read: accessReadComponents.checkbox, write: accessWriteComponents.checkbox, execute: accessExecuteComponents.checkbox },
			default: { read: undefined, write: undefined, execute: undefined }
		};

		let row = [
			this.createImageComponent(aclEntry.type),
			aclEntry.displayName,
			accessReadComponents.container,
			accessWriteComponents.container,
			accessExecuteComponents.container
		];

		// Default permissions can only be set on directories
		if (this.hdfsModel.fileStatus.type === HdfsFileType.Directory) {
			const defaultPermission = aclEntry.getPermission(AclEntryScope.default);

			// Default Read
			const defaultReadCheckboxComponents = createCheckbox(this.modelBuilder, defaultPermission && defaultPermission.read, !!defaultPermission, permissionsCheckboxColumnWidth, permissionsRowHeight, `${loc.defaultHeader} ${loc.readHeader}`);
			defaultReadCheckboxComponents.checkbox.onChanged(() => {
				aclEntry.getPermission(AclEntryScope.default).read = defaultReadCheckboxComponents.checkbox.checked;
			});

			// Default Write
			const defaultWriteCheckboxComponents = createCheckbox(this.modelBuilder, defaultPermission && defaultPermission.write, !!defaultPermission, permissionsCheckboxColumnWidth, permissionsRowHeight, `${loc.defaultHeader} ${loc.writeHeader}`);
			defaultWriteCheckboxComponents.checkbox.onChanged(() => {
				aclEntry.getPermission(AclEntryScope.default).write = defaultWriteCheckboxComponents.checkbox.checked;
			});

			// Default Execute
			const defaultExecuteCheckboxComponents = createCheckbox(this.modelBuilder, defaultPermission && defaultPermission.execute, !!defaultPermission, permissionsCheckboxColumnWidth, permissionsRowHeight, `${loc.defaultHeader} ${loc.executeHeader}`);
			defaultExecuteCheckboxComponents.checkbox.onChanged(() => {
				aclEntry.getPermission(AclEntryScope.default).execute = defaultExecuteCheckboxComponents.checkbox.checked;
			});

			permissionsCheckboxesMapping.default = { read: defaultReadCheckboxComponents.checkbox, write: defaultWriteCheckboxComponents.checkbox, execute: defaultExecuteCheckboxComponents.checkbox };

			if (includeInherit) {
				const inheritCheckboxComponents = createCheckbox(this.modelBuilder, !defaultPermission, !this.inheritDefaultsCheckbox.checked, permissionsCheckboxColumnWidth, permissionsRowHeight, loc.inheritDefaultsLabel);
				inheritCheckboxComponents.checkbox.onChanged(() => {
					defaultReadCheckboxComponents.checkbox.enabled = !inheritCheckboxComponents.checkbox.checked;
					defaultWriteCheckboxComponents.checkbox.enabled = !inheritCheckboxComponents.checkbox.checked;
					defaultExecuteCheckboxComponents.checkbox.enabled = !inheritCheckboxComponents.checkbox.checked;
					if (inheritCheckboxComponents.checkbox.checked) {
						aclEntry.removePermission(AclEntryScope.default);
						defaultReadCheckboxComponents.checkbox.checked = false;
						defaultWriteCheckboxComponents.checkbox.checked = false;
						defaultExecuteCheckboxComponents.checkbox.checked = false;
					} else {
						// Default to the access settings - this is what HDFS does if you don't
						// specify the complete set of default ACLs for owner, owning group and other
						const accessRead = accessReadComponents.checkbox.checked;
						const accessWrite = accessWriteComponents.checkbox.checked;
						const accessExecute = accessExecuteComponents.checkbox.checked;
						defaultReadCheckboxComponents.checkbox.checked = accessRead;
						defaultWriteCheckboxComponents.checkbox.checked = accessWrite;
						defaultExecuteCheckboxComponents.checkbox.checked = accessExecute;
						aclEntry.addPermission(AclEntryScope.default,
							new AclEntryPermission(accessRead, accessWrite, accessExecute));
					}
				});
				this.namedSectionInheritCheckboxes.push(inheritCheckboxComponents.checkbox);
				row.push(inheritCheckboxComponents.container);
			}

			this.posixPermissionCheckboxesMapping.push(permissionsCheckboxesMapping);

			row = row.concat([
				defaultReadCheckboxComponents.container,
				defaultWriteCheckboxComponents.container,
				defaultExecuteCheckboxComponents.container
			]);
		}

		if (includeDelete) {
			const deleteButton = this.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>(
					{
						label: '',
						title: loc.deleteTitle,
						iconPath: IconPathHelper.delete,
						width: 20,
						height: 20
					})
				.component();
			deleteButton.onDidClick(() => { this.hdfsModel.deleteAclEntry(aclEntry); });
			row.push(deleteButton);
		}

		return row;
	}

	private createInheritDefaultsCheckbox(): azdata.CheckBoxComponent {
		this.inheritDefaultsCheckbox = this.modelBuilder.checkBox()
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
		return this.inheritDefaultsCheckbox;
	}
	/**
	 * Creates the header row for the permissions tables. This contains headers for the name and read/write/execute for the
	 * access section. If the path is for a directory then a default section is included for specifying default permissions.
	 * @param rightSpacerWidth The amount of space to include on the right to correctly align the headers with the
	 * @param middleSpacerWidth The amount of space to include between the text to correctly align the headers with the table sections
	 */
	private createPermissionsSectionHeaderRow(rightSpacerWidth: number, middleSpacerWidth: number): azdata.FlexContainer {
		// Section Headers
		const sectionHeaderContainer = this.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', justifyContent: 'flex-end' }).component();

		// Access
		const accessSectionHeader = this.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: loc.accessHeader,
				ariaHidden: true,
				CSSStyles: {
					// This covers 3 checkbox columns
					'width': `${permissionsCheckboxColumnWidth * 3}px`,
					'min-width': `${permissionsCheckboxColumnWidth * 3}px`,
					...cssStyles.permissionsTableHeaderCss
				}
			})
			.component();
		sectionHeaderContainer.addItem(accessSectionHeader, { flex: '0 0 auto' });

		// Only show default section for directories
		if (this.hdfsModel.fileStatus.type === HdfsFileType.Directory) {
			// Middle spacer
			const middleSpacer = this.modelBuilder.text().withProperties({ CSSStyles: { 'width': `${middleSpacerWidth}px`, 'min-width': `${middleSpacerWidth}px` } }).component();
			sectionHeaderContainer.addItem(middleSpacer, { flex: '0 0 auto' });

			// Default
			const defaultSectionHeader = this.modelBuilder.text()
				.withProperties<azdata.TextComponentProperties>({
					value: loc.defaultHeader,
					ariaHidden: true,
					CSSStyles: {
						// This covers 3 checkbox columns
						'width': `${permissionsCheckboxColumnWidth * 3}px`,
						'min-width': `${permissionsCheckboxColumnWidth * 3}px`,
						...cssStyles.permissionsTableHeaderCss
					}
				})
				.component();
			sectionHeaderContainer.addItem(defaultSectionHeader, { flex: '0 0 auto' });
		}

		// Right spacer
		const rightSpacer = this.modelBuilder.text().withProperties({ CSSStyles: { 'width': `${rightSpacerWidth}px`, 'min-width': `${rightSpacerWidth}px` } }).component();
		sectionHeaderContainer.addItem(rightSpacer, { flex: '0 0 auto' });

		return sectionHeaderContainer;
	}

	/**
	 * Runs the specified action when the component is initialized. If already initialized just runs
	 * the action immediately.
	 * @param action The action to be ran when the page is initialized
	 */
	protected eventuallyRunOnInitialized(action: () => void): void {
		if (!this.viewInitialized) {
			this.onViewInitializedEvent.event(() => {
				try {
					action();
				} catch (error) {
					console.error(`Unexpected error running onInitialized action for Manage Access dialog : ${error}`);
				}
			});
		} else {
			action();
		}
	}
}

/**
 * Creates a checkbox to be hosted inside of a table cell
 * @param builder The ModelBuilder used to create the components
 * @param checked Whether the checkbox is initially checked or not
 * @param enabled Whether the checkbox is initially enabled or not
 * @param containerWidth The width of the container holding the checkbox
 * @param containerHeight The height of the container holding the checkbox
 * @param ariaLabel The aria label to apply to the checkbox
 */
function createCheckbox(builder: azdata.ModelBuilder, checked: boolean, enabled: boolean, containerWidth: number, containerHeight: number, ariaLabel: string): { container: azdata.FlexContainer, checkbox: azdata.CheckBoxComponent } {
	const checkbox = builder.checkBox()
		.withProperties<azdata.CheckBoxProperties>({
			checked: checked,
			enabled: enabled,
			height: checkboxSize,
			width: checkboxSize,
			ariaLabel: ariaLabel
		}).component();
	const container = builder.flexContainer()
		.withLayout({ width: containerWidth, height: containerHeight })
		.component();
	container.addItem(checkbox, { CSSStyles: { ...cssStyles.permissionCheckboxCss } });
	return {
		container: container,
		checkbox: checkbox
	};
}
