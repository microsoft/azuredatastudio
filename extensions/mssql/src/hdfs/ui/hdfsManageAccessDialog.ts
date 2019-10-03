/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { HdfsModel } from '../hdfsModel';
import { IFileSource } from '../../objectExplorerNodeProvider/fileSources';
import { IAclStatus, AclEntry, AclEntryType } from '../../hdfs/aclEntry';
import { cssStyles } from './uiConstants';
import { ownersHeader, permissionsHeader, stickyHeader, readHeader, writeHeader, executeHeader, manageAccessTitle, allOthersHeader, addUserOrGroupHeader, enterNamePlaceholder, addLabel, accessHeader, defaultHeader, applyText, applyRecursivelyText, userLabel, groupLabel, errorApplyingAclChanges } from '../../localizedConstants';
import { HdfsError } from '../webhdfs';
import { ApiWrapper } from '../../apiWrapper';

const permissionsNameColumnWidth = 250;
const permissionsStickyColumnWidth = 50;
const permissionsReadColumnWidth = 50;
const permissionsWriteColumnWidth = 50;
const permissionsExecuteColumnWidth = 50;
const permissionsDeleteColumnWidth = 50;

const permissionsRowHeight = 75;

export class ManageAccessDialog {

	private hdfsModel: HdfsModel;
	private viewInitialized: boolean = false;

	private modelBuilder: azdata.ModelBuilder;
	private rootLoadingComponent: azdata.LoadingComponent;
	private ownersPermissionsContainer: azdata.FlexContainer;
	private othersPermissionsContainer: azdata.FlexContainer;
	private namedUsersAndGroupsPermissionsContainer: azdata.FlexContainer;
	private addUserOrGroupInput: azdata.InputBoxComponent;
	private dialog: azdata.window.Dialog;

	private addUserOrGroupSelectedType: AclEntryType;

	constructor(private hdfsPath: string, private fileSource: IFileSource, private readonly apiWrapper: ApiWrapper) {
		this.hdfsModel = new HdfsModel(this.fileSource, this.hdfsPath);
		this.hdfsModel.onAclStatusUpdated(aclStatus => this.handleAclStatusUpdated(aclStatus));
	}

	public openDialog(): void {
		if (!this.dialog) {
			this.dialog = this.apiWrapper.createDialog(manageAccessTitle, 'HdfsManageAccess', true);
			this.dialog.okButton.label = applyText;

			const applyRecursivelyButton = azdata.window.createButton(applyRecursivelyText);
			applyRecursivelyButton.onClick(async () => {
				try {
					await this.hdfsModel.apply(true);
				} catch (err) {
					this.apiWrapper.showErrorMessage(errorApplyingAclChanges(err instanceof HdfsError ? err.message : err));
				}
			});
			this.dialog.customButtons = [applyRecursivelyButton];
			this.dialog.registerCloseValidator(async (): Promise<boolean> => {
				try {
					await this.hdfsModel.apply();
					return true;
				} catch (err) {
					this.apiWrapper.showErrorMessage(errorApplyingAclChanges(err instanceof HdfsError ? err.message : err));
				}
				return false;
			});
			const tab = azdata.window.createTab(manageAccessTitle);
			tab.registerContent(async (modelView: azdata.ModelView) => {
				this.modelBuilder = modelView.modelBuilder;

				const rootContainer = modelView.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column', width: '100%', height: '100%' })
					.component();

				this.rootLoadingComponent = modelView.modelBuilder.loadingComponent().withItem(rootContainer).component();

				const pathLabel = modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.hdfsPath }).component();
				rootContainer.addItem(pathLabel, { flex: '0 0 auto' });

				// =====================
				// = Permissions Title =
				// =====================
				const permissionsTitle = modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({ value: permissionsHeader, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
					.component();
				rootContainer.addItem(permissionsTitle, { CSSStyles: { 'margin-top': '15px', 'padding-left': '10px', ...cssStyles.titleCss } });

				// ==============================
				// = Owners permissions section =
				// ==============================

				const ownersPermissionsHeaderRow = createPermissionsHeaderRow(modelView.modelBuilder, ownersHeader, true);
				rootContainer.addItem(ownersPermissionsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

				// Empty initially - this is going to eventually be populated with the owner/owning group permissions
				this.ownersPermissionsContainer = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
				rootContainer.addItem(this.ownersPermissionsContainer);

				// ==============================
				// = Others permissions section =
				// ==============================

				const othersPermissionsHeaderRow = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
				const ownersHeaderCell = modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: allOthersHeader }).component();
				othersPermissionsHeaderRow.addItem(ownersHeaderCell, { flex: '1 1 auto', CSSStyles: { 'width': `${permissionsNameColumnWidth}px`, 'min-width': `${permissionsNameColumnWidth}px`, ...cssStyles.tableHeaderCss } });

				rootContainer.addItem(othersPermissionsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

				// Empty initially - this is eventually going to be populated with the "Everyone" permissions
				this.othersPermissionsContainer = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
				rootContainer.addItem(this.othersPermissionsContainer);

				// ===========================
				// = Add User Or Group Input =
				// ===========================

				const addUserOrGroupTitle = modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({ value: addUserOrGroupHeader, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
					.component();
				rootContainer.addItem(addUserOrGroupTitle, { CSSStyles: { 'margin-top': '15px', 'padding-left': '10px', ...cssStyles.titleCss } });

				const typeContainer = modelView.modelBuilder.flexContainer().withProperties({ flexFlow: 'row' }).component();
				const aclEntryTypeGroup = 'aclEntryType';
				const userTypeButton = this.createRadioButton(modelView.modelBuilder, userLabel, aclEntryTypeGroup, AclEntryType.user);
				const groupTypeButton = this.createRadioButton(modelView.modelBuilder, groupLabel, aclEntryTypeGroup, AclEntryType.group);
				userTypeButton.checked = true;
				this.addUserOrGroupSelectedType = AclEntryType.user;

				typeContainer.addItems([userTypeButton, groupTypeButton], { flex: '0 0 auto' });
				rootContainer.addItem(typeContainer, { flex: '0 0 auto' });
				const addUserOrGroupInputRow = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();

				this.addUserOrGroupInput = modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ inputType: 'text', placeHolder: enterNamePlaceholder, width: 250 }).component();
				const addUserOrGroupButton = modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: addLabel, width: 75 }).component();
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

				rootContainer.addItem(addUserOrGroupInputRow);

				// =================================================
				// = Named Users and Groups permissions header row =
				// =================================================

				const namedUsersAndGroupsPermissionsHeaderRow = createPermissionsHeaderRow(modelView.modelBuilder, ownersHeader, false);
				rootContainer.addItem(namedUsersAndGroupsPermissionsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

				// Empty initially - this is eventually going to be populated with the ACL entries set for this path
				this.namedUsersAndGroupsPermissionsContainer = modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
				rootContainer.addItem(this.namedUsersAndGroupsPermissionsContainer);

				this.viewInitialized = true;
				this.handleAclStatusUpdated(this.hdfsModel.aclStatus);
				await modelView.initializeModel(this.rootLoadingComponent);
			});
			this.dialog.content = [tab];
		}

		azdata.window.openDialog(this.dialog);
	}

	private handleAclStatusUpdated(aclStatus: IAclStatus): void {
		if (!aclStatus || !this.viewInitialized) {
			return;
		}

		// Owners
		const ownerPermissionsRow = this.createOwnerPermissionsRow(this.modelBuilder, aclStatus.stickyBit, aclStatus.owner);
		const owningGroupPermissionsRow = this.createPermissionsRow(this.modelBuilder, aclStatus.group, false);
		this.ownersPermissionsContainer.clearItems();
		this.ownersPermissionsContainer.addItems([ownerPermissionsRow, owningGroupPermissionsRow], { CSSStyles: { 'border-bottom': cssStyles.tableBorder, 'border-top': cssStyles.tableBorder } });

		// Others
		const otherPermissionsRow = this.createPermissionsRow(this.modelBuilder, aclStatus.other, false);
		this.othersPermissionsContainer.clearItems();
		this.othersPermissionsContainer.addItem(otherPermissionsRow, { CSSStyles: { 'border-bottom': cssStyles.tableBorder, 'border-top': cssStyles.tableBorder } });

		this.namedUsersAndGroupsPermissionsContainer.clearItems();
		// Named users and groups
		aclStatus.entries.forEach(entry => {
			const namedEntryRow = this.createPermissionsRow(this.modelBuilder, entry, true);
			this.namedUsersAndGroupsPermissionsContainer.addItem(namedEntryRow, { CSSStyles: { 'border-bottom': cssStyles.tableBorder, 'border-top': cssStyles.tableBorder } });
		});

		this.rootLoadingComponent.loading = false;
	}

	private createRadioButton(modelBuilder: azdata.ModelBuilder, label: string, name: string, aclEntryType: AclEntryType): azdata.RadioButtonComponent {
		const button = modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({ label: label, name: name }).component();
		button.onDidClick(() => {
			this.addUserOrGroupSelectedType = aclEntryType;
		});
		return button;
	}

	private createOwnerPermissionsRow(builder: azdata.ModelBuilder, sticky: boolean, entry: AclEntry): azdata.FlexContainer {
		const row = this.createPermissionsRow(builder, entry, false);
		const stickyCheckbox = builder.checkBox().withProperties({ checked: sticky, height: 25, width: 25 }).component();
		const stickyContainer = builder.flexContainer().withLayout({ width: permissionsReadColumnWidth }).withItems([stickyCheckbox]).component();
		// Insert after name item but before other checkboxes
		row.insertItem(stickyContainer, 1, { flex: '0 0 auto' });
		return row;
	}

	private createPermissionsRow(builder: azdata.ModelBuilder, entry: AclEntry, includeDelete: boolean): azdata.FlexContainer {
		const rowContainer = builder.flexContainer().withLayout({ flexFlow: 'row', height: permissionsRowHeight }).component();
		const nameCell = builder.text().withProperties({ value: entry.displayName }).component();
		rowContainer.addItem(nameCell);

		// Access - Read
		const accessReadComponents = createCheckbox(builder, entry.permission.read, permissionsReadColumnWidth, permissionsRowHeight);
		rowContainer.addItem(accessReadComponents.container, { flex: '0 0 auto' });
		accessReadComponents.checkbox.onChanged(() => {
			entry.permission.read = accessReadComponents.checkbox.checked;
		});

		// Access - Write
		const accessWriteComponents = createCheckbox(builder, entry.permission.write, permissionsWriteColumnWidth, permissionsRowHeight);
		rowContainer.addItem(accessWriteComponents.container, { flex: '0 0 auto' });
		accessWriteComponents.checkbox.onChanged(() => {
			entry.permission.write = accessWriteComponents.checkbox.checked;
		});

		// Access - Execute
		const accessExecuteComponents = createCheckbox(builder, entry.permission.execute, permissionsExecuteColumnWidth, permissionsRowHeight);
		rowContainer.addItem(accessExecuteComponents.container, { flex: '0 0 auto', CSSStyles: { 'border-right': cssStyles.tableBorder } });
		accessExecuteComponents.checkbox.onChanged(() => {
			entry.permission.execute = accessExecuteComponents.checkbox.checked;
		});

		// Default - Read
		const defaultReadComponents = createCheckbox(builder, false, permissionsReadColumnWidth, permissionsRowHeight);
		rowContainer.addItem(defaultReadComponents.container, { flex: '0 0 auto' });
		defaultReadComponents.checkbox.onChanged(() => {
			// entry.permission.read = defaultReadComponents.checkbox.checked; TODO hook up default logic
		});

		// Default - Write
		const defaultWriteComponents = createCheckbox(builder, false, permissionsWriteColumnWidth, permissionsRowHeight);
		rowContainer.addItem(defaultWriteComponents.container, { flex: '0 0 auto' });
		accessReadComponents.checkbox.onChanged(() => {
			// entry.permission.write = accessReadComponents.checkbox.checked; TODO hook up default logic
		});

		// Default - Execute
		const defaultExecuteComponents = createCheckbox(builder, false, permissionsExecuteColumnWidth, permissionsRowHeight);
		rowContainer.addItem(defaultExecuteComponents.container, { flex: '0 0 auto' });
		accessReadComponents.checkbox.onChanged(() => {
			// entry.permission.execute = accessReadComponents.checkbox.checked; TODO hook up default logic
		});

		const deleteContainer = builder.flexContainer().withLayout({ width: permissionsDeleteColumnWidth }).component();

		if (includeDelete) {
			const deleteButton = builder.button().withProperties<azdata.ButtonProperties>({ label: 'Delete' }).component();
			deleteButton.onDidClick(() => { this.hdfsModel.deleteAclEntry(entry); });
			deleteContainer.addItem(deleteButton, { flex: '0 0 auto' });
		}
		rowContainer.addItem(deleteContainer, { flex: '0 0 auto' });

		return rowContainer;
	}
}

/**
 * Creates the header row for the permissions tables. This contains headers for the name, optional sticky and then read/write/execute for both
 * access and default sections.
 * @param modelBuilder The builder used to create the model components
 * @param nameColumnText The text to display for the name column
 * @param includeSticky Whether to include the sticky header
 */
function createPermissionsHeaderRow(modelBuilder: azdata.ModelBuilder, nameColumnText: string, includeSticky: boolean): azdata.FlexContainer {
	const rowsContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();

	// Section Headers
	const sectionHeaderContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', justifyContent: 'flex-end' }).component();
	const accessSectionHeader = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: accessHeader }).component();
	sectionHeaderContainer.addItem(accessSectionHeader, { CSSStyles: { 'width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`, 'min-width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	const defaultSectionHeader = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: defaultHeader }).component();
	sectionHeaderContainer.addItem(defaultSectionHeader, { CSSStyles: { 'width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`, 'min-width': `${permissionsReadColumnWidth + permissionsWriteColumnWidth + permissionsExecuteColumnWidth}px`, ...cssStyles.tableHeaderCss } });

	rowsContainer.addItem(sectionHeaderContainer);

	// Table headers
	const headerRowContainer = modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
	const ownersCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: nameColumnText }).component();
	headerRowContainer.addItem(ownersCell, { flex: '1 1 auto', CSSStyles: { 'width': `${permissionsNameColumnWidth}px`, 'min-width': `${permissionsNameColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	if (includeSticky) {
		const stickyCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: stickyHeader }).component();
		headerRowContainer.addItem(stickyCell, { CSSStyles: { 'width': `${permissionsStickyColumnWidth}px`, 'min-width': `${permissionsStickyColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	}

	// Access Permissions Group
	const accessReadCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: readHeader }).component();
	headerRowContainer.addItem(accessReadCell, { CSSStyles: { 'width': `${permissionsReadColumnWidth}px`, 'min-width': `${permissionsReadColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	const accessWriteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: writeHeader }).component();
	headerRowContainer.addItem(accessWriteCell, { CSSStyles: { 'width': `${permissionsWriteColumnWidth}px`, 'min-width': `${permissionsWriteColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	const accessExecuteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: executeHeader }).component();
	headerRowContainer.addItem(accessExecuteCell, { CSSStyles: { 'width': `${permissionsExecuteColumnWidth}px`, 'min-width': `${permissionsExecuteColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	// Default Permissions Group
	const defaultReadCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: readHeader }).component();
	headerRowContainer.addItem(defaultReadCell, { CSSStyles: { 'width': `${permissionsReadColumnWidth}px`, 'min-width': `${permissionsReadColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	const defaultWriteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: writeHeader }).component();
	headerRowContainer.addItem(defaultWriteCell, { CSSStyles: { 'width': `${permissionsWriteColumnWidth}px`, 'min-width': `${permissionsWriteColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	const defaultExecuteCell = modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: executeHeader }).component();
	headerRowContainer.addItem(defaultExecuteCell, { CSSStyles: { 'width': `${permissionsExecuteColumnWidth}px`, 'min-width': `${permissionsExecuteColumnWidth}px`, ...cssStyles.tableHeaderCss } });
	// Delete
	const deleteCell = modelBuilder.text().component();
	headerRowContainer.addItem(deleteCell, { CSSStyles: { 'width': `${permissionsDeleteColumnWidth}px`, 'min-width': `${permissionsDeleteColumnWidth}px` } });

	rowsContainer.addItem(headerRowContainer);

	return rowsContainer;
}

function createCheckbox(builder: azdata.ModelBuilder, checked: boolean, containerWidth: number, containerHeight: number): { container: azdata.FlexContainer, checkbox: azdata.CheckBoxComponent } {
	const checkbox = builder.checkBox().withProperties({ checked: checked, height: 25, width: 25 }).component();
	return {
		container: builder.flexContainer()
			.withLayout({ width: containerWidth, height: containerHeight })
			.withItems([checkbox])
			.component(),
		checkbox: checkbox
	};

}
