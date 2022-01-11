/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerViewModel, DesignerEdit, DesignerComponentInput, DesignerView, DesignerTab, DesignerDataPropertyInfo, DropDownProperties, DesignerTableProperties, DesignerEditProcessedEventArgs, DesignerAction, DesignerStateChangedEventArgs } from 'sql/workbench/browser/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';
import { Emitter, Event } from 'vs/base/common/event';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { deepClone, equals } from 'vs/base/common/objects';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TableDesignerPublishDialogResult, TableDesignerPublishDialog } from 'sql/workbench/services/tableDesigner/browser/tableDesignerPublishDialog';

export class TableDesignerComponentInput implements DesignerComponentInput {

	private _viewModel: DesignerViewModel;
	private _view: DesignerView;
	private _valid: boolean = true;
	private _dirty: boolean = false;
	private _pendingAction?: DesignerAction = undefined;
	private _onStateChange = new Emitter<DesignerStateChangedEventArgs>();
	private _onInitialized = new Emitter<void>();
	private _onEditProcessed = new Emitter<DesignerEditProcessedEventArgs>();
	private _originalViewModel: DesignerViewModel;

	public readonly onInitialized: Event<void> = this._onInitialized.event;
	public readonly onEditProcessed: Event<DesignerEditProcessedEventArgs> = this._onEditProcessed.event;
	public readonly onStateChange: Event<DesignerStateChangedEventArgs> = this._onStateChange.event;

	constructor(private readonly _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo,
		@INotificationService private readonly _notificationService: INotificationService,
		@IQueryEditorService private readonly _queryEditorService: IQueryEditorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService) {
	}

	get valid(): boolean {
		return this._valid;
	}

	get dirty(): boolean {
		return this._dirty;
	}

	get pendingAction(): DesignerAction | undefined {
		return this._pendingAction;
	}

	get objectTypeDisplayName(): string {
		return localize('tableDesigner.tableObjectType', "Table");
	}

	get view(): DesignerView {
		return this._view;
	}

	get viewModel(): DesignerViewModel {
		return this._viewModel;
	}

	processEdit(edit: DesignerEdit): void {
		this.updateState(this.valid, this.dirty, 'processEdit');
		this._provider.processTableEdit(this._tableInfo, edit).then(
			result => {
				this._viewModel = result.viewModel;
				this.updateState(result.isValid, !equals(this._viewModel, this._originalViewModel), undefined);

				this._onEditProcessed.fire({
					edit: edit,
					result: {
						isValid: result.isValid,
						errors: result.errors
					}
				});
			},
			error => {
				this._notificationService.error(localize('tableDesigner.errorProcessingEdit', "An error occured while processing the change: {0}", error?.message ?? error));
				this.updateState(this.valid, this.dirty);
			}
		);
	}

	async generateScript(): Promise<void> {
		const notificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.generatingScript', "Generating script..."),
			sticky: true
		});
		try {
			this.updateState(this.valid, this.dirty, 'generateScript');
			const script = await this._provider.generateScript(this._tableInfo);
			this._queryEditorService.newSqlEditor({ initalContent: script });
			this.updateState(this.valid, this.dirty);
			notificationHandle.updateMessage(localize('tableDesigner.generatingScriptCompleted', "Script generated."));
		} catch (error) {
			notificationHandle.updateSeverity(Severity.Error);
			notificationHandle.updateMessage(localize('tableDesigner.generateScriptError', "An error occured while generating the script: {0}", error?.message ?? error));
			this.updateState(this.valid, this.dirty);
		}
	}

	async publishChanges(): Promise<void> {
		const saveNotificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.savingChanges', "Saving table designer changes..."),
			sticky: true
		});
		try {
			this.updateState(this.valid, this.dirty, 'save');
			await this._provider.publishChanges(this._tableInfo);
			this._originalViewModel = this._viewModel;
			this.updateState(true, false);
			saveNotificationHandle.updateMessage(localize('tableDesigner.publishChangeSuccess', "The changes have been successfully published."));
		} catch (error) {
			saveNotificationHandle.updateSeverity(Severity.Error);
			saveNotificationHandle.updateMessage(localize('tableDesigner.publishChangeError', "An error occured while publishing changes: {0}", error?.message ?? error));
			this.updateState(this.valid, this.dirty);
		}
	}

	async openPublishDialog(): Promise<void> {
		const reportNotificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.generatingPreviewReport', "Generating preview report..."),
			sticky: true
		});

		let report;
		try {
			this.updateState(this.valid, this.dirty, 'generateReport');
			report = await this._provider.generatePreviewReport(this._tableInfo);
			reportNotificationHandle.close();
			this.updateState(this.valid, this.dirty);
		} catch (error) {
			reportNotificationHandle.updateSeverity(Severity.Error);
			reportNotificationHandle.updateMessage(localize('tableDesigner.generatePreviewReportError', "An error occured while generating preview report: {0}", error?.message ?? error));
			this.updateState(this.valid, this.dirty);
			return;
		}
		const dialog = this._instantiationService.createInstance(TableDesignerPublishDialog);
		const result = await dialog.open(report);
		if (result === TableDesignerPublishDialogResult.GenerateScript) {
			await this.generateScript();
		} else if (result === TableDesignerPublishDialogResult.UpdateDatabase) {
			await this.publishChanges();
		}
	}

	async revert(): Promise<void> {
		this.updateState(true, false);
	}

	private updateState(valid: boolean, dirty: boolean, pendingAction?: DesignerAction): void {
		if (this._dirty !== dirty || this._valid !== valid || this._pendingAction !== pendingAction) {
			const previousState = {
				valid: this._valid,
				dirty: this._dirty,
				pendingAction: this._pendingAction
			};

			this._dirty = dirty;
			this._valid = valid;
			this._pendingAction = pendingAction;

			const currentState = {
				valid: this._valid,
				dirty: this._dirty,
				pendingAction: this._pendingAction
			};
			this._onStateChange.fire({
				currentState,
				previousState,
			});
		}
	}

	initialize(): void {
		if (this._view !== undefined || this.pendingAction === 'initialize') {
			return;
		}

		this.updateState(this.valid, this.dirty, 'initialize');
		this._provider.initializeTableDesigner(this._tableInfo).then(result => {
			this.doInitialization(result);
			this._onInitialized.fire();
		}, error => {
			this._notificationService.error(localize('tableDesigner.errorInitializingTableDesigner', "An error occured while initializing the table designer: {0}", error?.message ?? error));
		});
	}

	private doInitialization(designerInfo: azdata.designers.TableDesignerInfo): void {
		this.updateState(true, false);
		this._viewModel = designerInfo.viewModel;
		this._originalViewModel = deepClone(this._viewModel);
		this.setDefaultData();

		const tabs = [];

		if (designerInfo.view.columnTableOptions?.showTable) {
			tabs.push(this.getColumnsTab(designerInfo.view.columnTableOptions, designerInfo.columnTypes));
		}

		if (designerInfo.view.foreignKeyTableOptions?.showTable) {
			tabs.push(this.getForeignKeysTab(designerInfo.view.foreignKeyTableOptions));
		}

		if (designerInfo.view.checkConstraintTableOptions?.showTable) {
			tabs.push(this.getCheckConstraintsTab(designerInfo.view.checkConstraintTableOptions));
		}

		if (designerInfo.view.additionalTabs) {
			tabs.push(...designerInfo.view.additionalTabs);
		}

		tabs.push(this.getGeneralTab(designerInfo));

		this._view = {
			components: [{
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Name,
				description: localize('designer.table.description.name', "The name of the table object."),
				componentProperties: {
					title: localize('tableDesigner.nameTitle', "Table name"),
					width: 200
				}
			}],
			tabs: tabs
		};
	}

	private getGeneralTab(designerInfo: azdata.designers.TableDesignerInfo): DesignerTab {
		const generalTabComponents: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.TableProperty.Schema,
				description: localize('designer.table.description.schema', "The schema that contains the table."),
				componentProperties: <DropDownProperties>{
					title: localize('tableDesigner.schemaTitle', "Schema"),
					values: designerInfo.schemas
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableProperty.Description,
				description: localize('designer.table.description.description', "Description for the table."),
				componentProperties: {
					title: localize('tableDesigner.descriptionTitle', "Description")
				}
			}
		];

		if (designerInfo.view.additionalTableProperties) {
			generalTabComponents.push(...designerInfo.view.additionalTableProperties);
		}

		return <DesignerTab>{
			title: localize('tableDesigner.generalTab', "General"),
			components: generalTabComponents
		};
	}

	private getColumnsTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions, columnTypes: string[]): DesignerTab {

		const columnProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Name,
				description: localize('designer.column.description.name', "The name of the column object."),
				componentProperties: {
					title: localize('tableDesigner.columnNameTitle', "Name"),
					width: 150
				}
			}, {
				componentType: 'dropdown',
				propertyName: designers.TableColumnProperty.Type,
				description: localize('designer.column.description.dataType', "Displays the data type name for the column"),
				componentProperties: {
					title: localize('tableDesigner.columnTypeTitle', "Type"),
					width: 100,
					values: columnTypes
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Length,
				description: localize('designer.column.description.length', "The maximum length (in characters) that can be stored in this database object."),
				componentProperties: {
					title: localize('tableDesigner.columnLengthTitle', "Length"),
					width: 60
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.DefaultValue,
				description: localize('designer.column.description.defaultValueBinding', "A predefined global default value for the column or binding."),
				componentProperties: {
					title: localize('tableDesigner.columnDefaultValueTitle', "Default Value"),
					width: 150
				}
			}, {
				componentType: 'checkbox',
				propertyName: designers.TableColumnProperty.AllowNulls,
				description: localize('designer.column.description.allowNulls', "Specifies whether the column may have a NULL value."),
				componentProperties: {
					title: localize('tableDesigner.columnAllowNullTitle', "Allow Nulls"),
				}
			}, {
				componentType: 'checkbox',
				propertyName: designers.TableColumnProperty.IsPrimaryKey,
				description: localize('designer.column.description.primaryKey', "Specifies whether the column is included in the primary key for the table."),
				componentProperties: {
					title: localize('tableDesigner.columnIsPrimaryKeyTitle', "Primary Key"),
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Precision,
				description: localize('designer.column.description.precision', "For numeric data, the maximum number of decimal digits that can be stored in this database object."),
				componentProperties: {
					title: localize('tableDesigner.columnPrecisionTitle', "Precision"),
					width: 60
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Scale,
				description: localize('designer.column.description.scale', "For numeric data, the maximum number of decimal digits that can be stored in this database object to the right of decimal point."),
				componentProperties: {
					title: localize('tableDesigner.columnScaleTitle', "Scale"),
					width: 60
				}
			}
		];

		if (options.additionalProperties) {
			columnProperties.push(...options.additionalProperties);
		}

		const displayProperties = options.propertiesToDisplay?.length > 0 ? options.propertiesToDisplay : [
			designers.TableColumnProperty.Name,
			designers.TableColumnProperty.Type,
			designers.TableColumnProperty.Length,
			designers.TableColumnProperty.Precision,
			designers.TableColumnProperty.Scale,
			designers.TableColumnProperty.IsPrimaryKey,
			designers.TableColumnProperty.AllowNulls,
			designers.TableColumnProperty.DefaultValue,
		];

		return <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.Columns,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.columnsTabTitle', "Columns"),
						columns: displayProperties,
						itemProperties: columnProperties,
						objectTypeDisplayName: localize('tableDesigner.columnTypeName', "Column"),
						canAddRows: options.canAddRows,
						canRemoveRows: options.canRemoveRows
					}
				}
			]
		};
	}

	private getForeignKeysTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions): DesignerTab {

		const foreignKeyColumnMappingProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.ForeignKeyColumnMappingProperty.ForeignKeyColumn,
				componentProperties: {
					title: localize('tableDesigner.foreignKeyColumn', "Foreign Key Column"),
					width: 150
				}
			},
			{
				componentType: 'dropdown',
				propertyName: designers.ForeignKeyColumnMappingProperty.PrimaryKeyColumn,
				componentProperties: {
					title: localize('tableDesigner.primaryKeyColumn', "Primary Key Column"),
					width: 150
				}
			},
		];

		const foreignKeyProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'input',
				propertyName: designers.TableForeignKeyProperty.Name,
				description: localize('designer.foreignkey.description.name', "The name of the foreign key."),
				componentProperties: {
					title: localize('tableDesigner.foreignKeyNameTitle', "Name"),
					width: 300
				}
			},
			{
				componentType: 'dropdown',
				propertyName: designers.TableForeignKeyProperty.PrimaryKeyTable,
				description: localize('designer.foreignkey.description.primaryKeyTable', "The table which contains the primary or unique key column."),
				componentProperties: {
					title: localize('tableDesigner.PrimaryKeyTableName', "Primary Key Table"),
					width: 200
				}
			},
			{
				componentType: 'dropdown',
				propertyName: designers.TableForeignKeyProperty.OnUpdateAction,
				description: localize('designer.foreignkey.description.onUpdateAction', "The behavior when a user tries to update a row with data that is involved in a foreign key relationship."),
				componentProperties: {
					title: localize('tableDesigner.foreignKeyOnUpdateAction', "On Update Action"),
					width: 100
				}
			},
			{
				componentType: 'dropdown',
				propertyName: designers.TableForeignKeyProperty.OnDeleteAction,
				description: localize('designer.foreignkey.description.onDeleteAction', "The behavior when a user tries to delete a row with data that is involved in a foreign key relationship."),
				componentProperties: {
					title: localize('tableDesigner.foreignKeyOnDeleteAction', "On Delete Action"),
					width: 100
				}
			},
			{
				componentType: 'table',
				propertyName: designers.TableForeignKeyProperty.Columns,
				description: localize('designer.foreignkey.description.columnMapping', "The mapping between foreign key columns and primary key columns."),
				group: localize('tableDesigner.foreignKeyColumns', "Column Mapping"),
				componentProperties: <DesignerTableProperties>{
					ariaLabel: localize('tableDesigner.foreignKeyColumns', "Column Mapping"),
					columns: [designers.ForeignKeyColumnMappingProperty.ForeignKeyColumn, designers.ForeignKeyColumnMappingProperty.PrimaryKeyColumn],
					itemProperties: foreignKeyColumnMappingProperties,
					objectTypeDisplayName: '',
					canAddRows: options.canAddRows,
					canRemoveRows: options.canRemoveRows
				}
			},
		];

		if (options.additionalProperties) {
			foreignKeyProperties.push(...options.additionalProperties);
		}

		const displayProperties = options.propertiesToDisplay?.length > 0 ? options.propertiesToDisplay : [
			designers.TableForeignKeyProperty.Name,
			designers.TableForeignKeyProperty.PrimaryKeyTable
		];

		return <DesignerTab>{
			title: localize('tableDesigner.foreignKeysTabTitle', "Foreign Keys"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.ForeignKeys,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.foreignKeysTabTitle', "Foreign Keys"),
						columns: displayProperties,
						itemProperties: foreignKeyProperties,
						objectTypeDisplayName: localize('tableDesigner.ForeignKeyTypeName', "Foreign Key"),
						canAddRows: options.canAddRows,
						canRemoveRows: options.canRemoveRows
					}
				}
			]
		};
	}

	private getCheckConstraintsTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions): DesignerTab {
		const checkConstraintProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'input',
				propertyName: designers.TableCheckConstraintProperty.Name,
				description: localize('designer.checkConstraint.description.name', "The name of the check constraint."),
				componentProperties: {
					title: localize('tableDesigner.checkConstraintNameTitle', "Name"),
					width: 200
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableCheckConstraintProperty.Expression,
				description: localize('designer.checkConstraint.description.expression', "The expression defining the check constraint."),
				componentProperties: {
					title: localize('tableDesigner.checkConstraintExpressionTitle', "Expression"),
					width: 300
				}
			}
		];

		if (options.additionalProperties) {
			checkConstraintProperties.push(...options.additionalProperties);
		}

		const displayProperties = options.propertiesToDisplay?.length > 0 ? options.propertiesToDisplay : [designers.TableCheckConstraintProperty.Name, designers.TableCheckConstraintProperty.Expression];

		return <DesignerTab>{
			title: localize('tableDesigner.checkConstraintsTabTitle', "Check Constraints"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.CheckConstraints,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.checkConstraintsTabTitle', "Check Constraints"),
						columns: displayProperties,
						itemProperties: checkConstraintProperties,
						objectTypeDisplayName: localize('tableDesigner.checkConstraintTypeName', "Check Constraint"),
						canAddRows: options.canAddRows,
						canRemoveRows: options.canRemoveRows
					}
				}
			]
		};
	}
	private setDefaultData(): void {
		const properties = Object.keys(this._viewModel);
		this.setDefaultInputData(properties, designers.TableProperty.Name);
		this.setDefaultInputData(properties, designers.TableProperty.Schema);
		this.setDefaultInputData(properties, designers.TableProperty.Description);
	}

	private setDefaultInputData(allProperties: string[], property: string): void {
		if (allProperties.indexOf(property) === -1) {
			this._viewModel[property] = {};
		}
	}
}
