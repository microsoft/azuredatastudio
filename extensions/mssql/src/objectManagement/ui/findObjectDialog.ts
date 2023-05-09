/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import { DefaultTableListItemEnabledStateGetter, DefaultMaxTableHeight, DialogBase, TableListItemComparer } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { getErrorMessage } from '../../utils';

type ObjectType = string | { name: string, displayName: string };

export interface FindObjectDialogOptions {
	objectTypes: ObjectType[];
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

const ObjectsTableMaxHeight = 700;

export class FindObjectDialog extends DialogBase<FindObjectDialogResult> {
	private objectTypesTable: azdata.TableComponent;
	private findButton: azdata.ButtonComponent;
	private objectsTable: azdata.TableComponent;
	private objectsLoadingComponent: azdata.LoadingComponent;
	private result: FindObjectDialogResult;
	private selectedObjectTypes: ObjectType[] = [];
	private allObjects: mssql.ObjectManagement.SearchResultItem[] = [];

	constructor(private readonly objectManagementService: mssql.IObjectManagementService, private readonly options: FindObjectDialogOptions) {
		super(options.title, 'FindObjectDialog');
		this.dialogObject.okButton.label = localizedConstants.SelectText;
		this.result = {
			selectedObjects: []
		};
		this.selectedObjectTypes = [...options.objectTypes];
	}

	private getObjectTypeName(objectType: ObjectType): string {
		return typeof objectType === 'string' ? objectType : objectType.name;
	}

	private getObjectTypeDisplayName(objectType: ObjectType): string {
		return typeof objectType === 'string' ? localizedConstants.getNodeTypeDisplayName(objectType, true) : objectType.displayName;
	}

	protected override async initialize(): Promise<void> {
		this.dialogObject.okButton.enabled = false;
		this.objectTypesTable = this.createTableList<ObjectType>(localizedConstants.ObjectTypeText,
			[localizedConstants.ObjectTypeText],
			this.options.objectTypes,
			this.selectedObjectTypes,
			DefaultMaxTableHeight,
			DefaultTableListItemEnabledStateGetter, (item) => {
				return [this.getObjectTypeDisplayName(item)];
			}, (item1, item2) => {
				return this.getObjectTypeName(item1) === this.getObjectTypeName(item2);
			});
		this.findButton = this.createButton(localizedConstants.FindText, localizedConstants.FindText, async () => {
			await this.onFindObjectButtonClick();
		});
		const buttonContainer = this.createButtonContainer([this.findButton]);
		const objectTypeSection = this.createGroup(localizedConstants.ObjectTypeText, [this.objectTypesTable, buttonContainer]);
		const columns = [localizedConstants.NameText, localizedConstants.ObjectTypeText];
		if (this.options.showSchemaColumn) {
			columns.splice(1, 0, localizedConstants.SchemaText);
		}

		if (this.options.multiSelect) {
			this.objectsTable = this.createTableList<mssql.ObjectManagement.SearchResultItem>(localizedConstants.ObjectsText,
				columns,
				this.allObjects,
				this.result.selectedObjects,
				ObjectsTableMaxHeight,
				DefaultTableListItemEnabledStateGetter,
				(item) => {
					return this.getObjectRowValue(item);
				},
				ObjectComparer);
		} else {
			this.objectsTable = this.createTable(localizedConstants.ObjectsText, columns, []);
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

		this.formContainer.addItems([objectTypeSection, objectsSection], this.getSectionItemLayout());
	}

	protected override get dialogResult(): FindObjectDialogResult | undefined {
		return this.result;
	}

	private async onFindObjectButtonClick(): Promise<void> {
		this.dialogObject.okButton.enabled = false;
		this.objectsLoadingComponent.loading = true;
		this.findButton.enabled = false;
		try {
			const results = await this.objectManagementService.search(this.options.contextId, this.selectedObjectTypes.map(item => this.getObjectTypeName(item)));
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
			await this.setTableData(this.objectsTable, data, ObjectsTableMaxHeight);
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
		const row = [item.name, this.getObjectTypeName(item.type)];
		if (this.options.showSchemaColumn) {
			row.splice(1, 0, item.schema);
		}
		return row;
	}
}
