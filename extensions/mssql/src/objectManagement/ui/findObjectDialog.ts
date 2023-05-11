/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import { DefaultTableListItemEnabledStateGetter, DefaultMaxTableHeight, DialogBase, TableListItemComparer, TableListItemValueGetter } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { getErrorMessage } from '../../utils';

export interface FindObjectDialogOptions {
	objectTypes: mssql.ObjectManagement.NodeType[];
	multiSelect: boolean;
	contextId: string;
	title: string;
}

export interface FindObjectDialogResult {
	selectedObjects: mssql.ObjectManagement.SearchResultItem[];
}

const ObjectComparer: TableListItemComparer<mssql.ObjectManagement.SearchResultItem> =
	(item1, item2) => {
		return item1.name === item2.name && item1.type === item2.type;
	};

const ObjectRowValueGetter: TableListItemValueGetter<mssql.ObjectManagement.SearchResultItem> =
	(item) => {
		return [item.name, localizedConstants.getNodeTypeDisplayName(item.type, true)];
	};

const ObjectsTableMaxHeight = 700;

export class FindObjectDialog extends DialogBase<FindObjectDialogResult> {
	private objectTypesTable: azdata.TableComponent;
	private findButton: azdata.ButtonComponent;
	private objectsTable: azdata.TableComponent;
	private objectsLoadingComponent: azdata.LoadingComponent;
	private result: FindObjectDialogResult;
	private selectedObjectTypes: string[] = [];
	private allObjects: mssql.ObjectManagement.SearchResultItem[] = [];

	constructor(private readonly objectManagementService: mssql.IObjectManagementService, private readonly options: FindObjectDialogOptions) {
		super(options.title, 'FindObjectDialog');
		this.dialogObject.okButton.label = localizedConstants.SelectText;
		this.result = {
			selectedObjects: []
		};
		this.selectedObjectTypes = [...options.objectTypes];
	}

	protected override async initialize(): Promise<void> {
		this.dialogObject.okButton.enabled = false;
		this.objectTypesTable = this.createTableList<string>(localizedConstants.ObjectTypeText,
			[localizedConstants.ObjectTypeText],
			this.options.objectTypes,
			this.selectedObjectTypes,
			DefaultMaxTableHeight,
			DefaultTableListItemEnabledStateGetter, (item) => {
				return [localizedConstants.getNodeTypeDisplayName(item, true)];
			});
		this.findButton = this.createButton(localizedConstants.FindText, localizedConstants.FindText, async () => {
			await this.onFindObjectButtonClick();
		});
		const buttonContainer = this.createButtonContainer([this.findButton]);
		const objectTypeSection = this.createGroup(localizedConstants.ObjectTypeText, [this.objectTypesTable, buttonContainer]);

		if (this.options.multiSelect) {
			this.objectsTable = this.createTableList<mssql.ObjectManagement.SearchResultItem>(localizedConstants.ObjectsText,
				[localizedConstants.NameText, localizedConstants.ObjectTypeText],
				this.allObjects,
				this.result.selectedObjects,
				ObjectsTableMaxHeight,
				DefaultTableListItemEnabledStateGetter,
				ObjectRowValueGetter,
				ObjectComparer);
		} else {
			this.objectsTable = this.createTable(localizedConstants.ObjectsText, [{
				value: localizedConstants.NameText,
			}, {
				value: localizedConstants.ObjectTypeText
			}], []);
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

		this.formContainer.addItems([objectTypeSection, objectsSection]);
	}

	protected override get dialogResult(): FindObjectDialogResult | undefined {
		return this.result;
	}

	private async onFindObjectButtonClick(): Promise<void> {
		this.dialogObject.okButton.enabled = false;
		this.objectsLoadingComponent.loading = true;
		this.findButton.enabled = false;
		try {
			const results = await this.objectManagementService.search(this.options.contextId, <mssql.ObjectManagement.NodeType[]>this.selectedObjectTypes);
			this.allObjects.splice(0, this.allObjects.length, ...results);
			let data;
			if (this.options.multiSelect) {
				data = this.getDataForTableList(this.allObjects, this.result.selectedObjects, DefaultTableListItemEnabledStateGetter, ObjectRowValueGetter, ObjectComparer);
			}
			else {
				data = this.allObjects.map(item => ObjectRowValueGetter(item));
			}
			this.setTableData(this.objectsTable, data, ObjectsTableMaxHeight);
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
}
