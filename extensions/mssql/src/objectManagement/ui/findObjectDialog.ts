/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import { DefaultTableListItemEnabledStateGetter, DefaultMaxTableRowCount, DialogBase, TableListItemComparer } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { getErrorMessage } from '../../utils';

export interface ObjectTypeInfo {
	name: string;
	displayName: string;
}

export interface FindObjectDialogOptions {
	objectTypes: ObjectTypeInfo[];
	selectAllObjectTypes: boolean;
	multiSelect: boolean;
	contextId: string;
	title: string;
	showSchemaColumn?: boolean;
}

export interface FindObjectDialogResult {
	selectedObjects: mssql.ObjectManagement.SearchResultItem[];
}

const ObjectComparer: TableListItemComparer<mssql.ObjectManagement.SearchResultItem> =
	(item1, item2) => {
		return item1.name === item2.name && item1.type === item2.type && item1.schema === item2.schema;
	};

const ObjectsTableMaxRowCount = 20;

export class FindObjectDialog extends DialogBase<FindObjectDialogResult> {
	private objectTypesTable: azdata.TableComponent;
	private searchTextInputBox: azdata.InputBoxComponent;
	private findButton: azdata.ButtonComponent;
	private objectsTable: azdata.TableComponent;
	private objectsLoadingComponent: azdata.LoadingComponent;
	private result: FindObjectDialogResult;
	private selectedObjectTypes: ObjectTypeInfo[] = [];
	private allObjects: mssql.ObjectManagement.SearchResultItem[] = [];

	constructor(private readonly objectManagementService: mssql.IObjectManagementService, private readonly options: FindObjectDialogOptions) {
		super(options.title, 'FindObjectDialog');
		this.dialogObject.okButton.label = localizedConstants.SelectText;
		this.dialogObject.okButton.enabled = false;

		// Relabel Cancel button to Back, since clicking cancel on an inner dialog makes it seem like it would close the whole dialog overall
		this.dialogObject.cancelButton.label = localizedConstants.BackButtonLabel;

		this.result = {
			selectedObjects: []
		};
		this.selectedObjectTypes = options.selectAllObjectTypes ? [...options.objectTypes] : [];
	}

	protected override async initialize(): Promise<void> {
		this.objectTypesTable = this.createTableList<ObjectTypeInfo>(localizedConstants.ObjectTypesText,
			[localizedConstants.ObjectTypeText],
			this.options.objectTypes,
			this.selectedObjectTypes,
			DefaultMaxTableRowCount,
			DefaultTableListItemEnabledStateGetter, (item) => {
				return [item.displayName];
			}, (item1, item2) => {
				return item1.name === item2.name;
			});
		this.searchTextInputBox = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.SearchTextLabel,
			inputType: 'text'
		});
		const searchTextRow = this.createLabelInputContainer(localizedConstants.SearchTextLabel, this.searchTextInputBox);
		this.findButton = this.createButton(localizedConstants.FindText, localizedConstants.FindText, async () => {
			await this.onFindObjectButtonClick();
		}, this.options.selectAllObjectTypes);
		const buttonContainer = this.createButtonContainer([this.findButton]);
		const filterSection = this.createGroup(localizedConstants.FilterSectionTitle, [
			searchTextRow,
			this.objectTypesTable,
			buttonContainer
		]);
		const columns = [localizedConstants.NameText, localizedConstants.ObjectTypeText];
		if (this.options.showSchemaColumn) {
			columns.splice(1, 0, localizedConstants.SchemaText);
		}

		if (this.options.multiSelect) {
			this.objectsTable = this.createTableList<mssql.ObjectManagement.SearchResultItem>(localizedConstants.ObjectsText,
				columns,
				this.allObjects,
				this.result.selectedObjects,
				ObjectsTableMaxRowCount,
				DefaultTableListItemEnabledStateGetter,
				(item) => {
					return this.getObjectRowValue(item);
				},
				ObjectComparer);
		} else {
			this.objectsTable = this.createTable(localizedConstants.ObjectsText, columns, [], ObjectsTableMaxRowCount);
			this.disposables.push(this.objectsTable.onRowSelected(async () => {
				if (this.objectsTable.selectedRows.length > 0) {
					this.result.selectedObjects = [this.allObjects[this.objectsTable.selectedRows[0]]];
				}
				await this.onFormFieldChange();
			}));
		}
		this.objectsLoadingComponent = this.modelView.modelBuilder.loadingComponent().withItem(this.objectsTable).withProps({
			loadingText: localizedConstants.LoadingObjectsText,
			showText: true,
			loading: false
		}).component();
		const objectsSection = this.createGroup(localizedConstants.ObjectsText, [this.objectsLoadingComponent]);

		this.formContainer.addItems([filterSection, objectsSection], this.getSectionItemLayout());
	}

	protected override get dialogResult(): FindObjectDialogResult | undefined {
		return this.result;
	}

	private async onFindObjectButtonClick(): Promise<void> {
		this.dialogObject.okButton.enabled = false;
		this.objectsLoadingComponent.loading = true;
		this.findButton.enabled = false;
		try {
			const results = await this.objectManagementService.search(this.options.contextId, this.selectedObjectTypes.map(item => item.name), this.searchTextInputBox.value);
			this.allObjects.splice(0, this.allObjects.length, ...results);
			let data;
			if (this.options.multiSelect) {
				data = this.getDataForTableList(this.allObjects, this.result.selectedObjects, DefaultTableListItemEnabledStateGetter, (item) => {
					return this.getObjectRowValue(item);
				}, ObjectComparer);
			}
			else {
				data = this.allObjects.map(item => { return this.getObjectRowValue(item); });
			}
			await this.setTableData(this.objectsTable, data, ObjectsTableMaxRowCount);
			this.objectsLoadingComponent.loadingCompletedText = localizedConstants.LoadingObjectsCompletedText(results.length);
		} catch (err) {
			this.dialogObject.message = {
				text: getErrorMessage(err),
				level: azdata.window.MessageLevel.Error
			};
		}
		this.findButton.enabled = true;
		this.objectsLoadingComponent.loading = false;
	}

	protected override async onFormFieldChange(): Promise<void> {
		this.findButton.enabled = this.selectedObjectTypes.length > 0;
		this.dialogObject.okButton.enabled = this.result.selectedObjects.length > 0;
	}

	private getObjectRowValue(item: mssql.ObjectManagement.SearchResultItem): string[] {
		const objectType = this.options.objectTypes.find(type => type.name === item.type);
		const row = [item.name, objectType?.displayName];
		if (this.options.showSchemaColumn) {
			row.splice(1, 0, item.schema);
		}
		return row;
	}
}
