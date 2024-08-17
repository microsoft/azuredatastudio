/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerViewModel, DesignerEdit, DesignerComponentInput, DesignerView, DesignerTab, DesignerDataPropertyInfo, DropDownProperties, DesignerTableProperties, DesignerEditProcessedEventArgs, DesignerAction, DesignerStateChangedEventArgs, DesignerPropertyPath, DesignerIssue, ScriptProperty, DesignerUIState } from 'sql/workbench/browser/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';
import { Emitter, Event } from 'vs/base/common/event';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { deepClone, equals } from 'vs/base/common/objects';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TableDesignerPublishDialogResult, TableDesignerPublishDialog } from 'sql/workbench/services/tableDesigner/browser/tableDesignerPublishDialog';
import { IAdsTelemetryService, ITelemetryEventProperties } from 'sql/platform/telemetry/common/telemetry';
import { TelemetryAction, TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { TableDesignerMetadata } from 'sql/workbench/services/tableDesigner/browser/tableDesignerMetadata';
import { Queue, timeout } from 'vs/base/common/async';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';

const ErrorDialogTitle: string = localize('tableDesigner.ErrorDialogTitle', "Table Designer Error");
export class TableDesignerComponentInput implements DesignerComponentInput {

	private _viewModel: DesignerViewModel;
	private _issues?: DesignerIssue[];
	private _view: DesignerView;
	private _valid: boolean = true;
	private _dirty: boolean = false;
	private _pendingAction?: DesignerAction = undefined;
	private _onStateChange = new Emitter<DesignerStateChangedEventArgs>();
	private _onInitialized = new Emitter<void>();
	private _onEditProcessed = new Emitter<DesignerEditProcessedEventArgs>();
	private _onRefreshRequested = new Emitter<void>();
	private _onSubmitPendingEditRequested = new Emitter<void>();
	private _originalViewModel: DesignerViewModel;
	private _tableDesignerView: azdata.designers.TableDesignerView;
	private _activeEditPromise: Promise<void>;
	private _isEditInProgress: boolean = false;
	private _recentEditAccepted: boolean = true;
	private _editQueue: Queue<void> = new Queue<void>();

	public readonly onInitialized: Event<void> = this._onInitialized.event;
	public readonly onEditProcessed: Event<DesignerEditProcessedEventArgs> = this._onEditProcessed.event;
	public readonly onStateChange: Event<DesignerStateChangedEventArgs> = this._onStateChange.event;
	public readonly onRefreshRequested: Event<void> = this._onRefreshRequested.event;
	public readonly onSubmitPendingEditRequested: Event<void> = this._onSubmitPendingEditRequested.event;


	private readonly designerEditTypeDisplayValue: { [key: number]: string } = {
		0: 'Add', 1: 'Remove', 2: 'Update'
	};

	constructor(private readonly _provider: TableDesignerProvider,
		public tableInfo: azdata.designers.TableInfo,
		private _telemetryInfo: ITelemetryEventProperties,
		private _objectExplorerContext: azdata.ObjectExplorerContext | undefined,
		@INotificationService private readonly _notificationService: INotificationService,
		@IAdsTelemetryService readonly _adsTelemetryService: IAdsTelemetryService,
		@IQueryEditorService private readonly _queryEditorService: IQueryEditorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IErrorMessageService private readonly _errorMessageService: IErrorMessageService,
		@IObjectExplorerService private readonly _objectExplorerService: IObjectExplorerService) {
	}

	public designerUIState?: DesignerUIState = undefined;

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

	get issues(): DesignerIssue[] | undefined {
		return this._issues;
	}

	get tableDesignerView(): azdata.designers.TableDesignerView {
		return this._tableDesignerView;
	}

	processEdit(edit: DesignerEdit): void {
		// If there is already an edit being processed, the new edit will be skipped if the previous edit is not accepted.
		const checkPreviousEditResult = this._editQueue.size !== 0;
		this._editQueue.queue(async () => {
			this.escapeAllApostrophes(edit);
			await this.doProcessEdit(edit, checkPreviousEditResult);
		});
	}

	async generateScript(): Promise<void> {
		const notificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.generatingScript', "Generating script..."),
			sticky: true
		});
		const telemetryInfo = this.createTelemetryInfo();
		const generateScriptEvent = this._adsTelemetryService.createActionEvent(TelemetryView.TableDesigner, TelemetryAction.GenerateScript).withAdditionalProperties(telemetryInfo);
		const startTime = new Date().getTime();
		try {
			this.updateState(this.valid, this.dirty, 'generateScript');
			const script = await this._provider.generateScript(this.tableInfo);
			this._queryEditorService.newSqlEditor({ initialContent: script });
			this.updateState(this.valid, this.dirty);
			notificationHandle.updateMessage(localize('tableDesigner.generatingScriptCompleted', "Script generated."));
			generateScriptEvent.withAdditionalMeasurements({
				'elapsedTimeMs': new Date().getTime() - startTime
			}).send();
		} catch (error) {
			this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.generateScriptError', "An error occured while generating the script: {0}", error?.message ?? error), error?.data);
			this.updateState(this.valid, this.dirty);
			this._adsTelemetryService.createErrorEvent(TelemetryView.TableDesigner, TelemetryAction.GenerateScript).withAdditionalProperties(telemetryInfo).send();
		} finally {
			// Close notification in 2 seconds to prevent user action after script generation is complete.
			// Users should not be required to close notification prompts.
			setTimeout(() => notificationHandle.close(), 2000);
		}
	}

	async publishChanges(): Promise<void> {
		const telemetryInfo = this.createTelemetryInfo();
		const publishEvent = this._adsTelemetryService.createActionEvent(TelemetryView.TableDesigner, TelemetryAction.PublishChanges).withAdditionalProperties(telemetryInfo);
		const saveNotificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.savingChanges', "Publishing table designer changes..."),
			sticky: true
		});
		const startTime = new Date().getTime();
		let isPublishSuccessful = false;
		const isNewTable = this.tableInfo.isNewTable;
		try {
			this.updateState(this.valid, this.dirty, 'publish');
			const result = await this._provider.publishChanges(this.tableInfo);
			this._viewModel = result.viewModel;
			this._originalViewModel = result.viewModel;
			this.setDesignerView(result.view);
			saveNotificationHandle.updateMessage(localize('tableDesigner.publishChangeSuccess', "The changes have been successfully published."));
			this.tableInfo = result.newTableInfo;
			this.updateState(true, false);
			this._onRefreshRequested.fire();
			const metadataTelemetryInfo = TableDesignerMetadata.getTelemetryInfo(this._provider.providerId, result.metadata);
			publishEvent.withAdditionalMeasurements({
				'elapsedTimeMs': new Date().getTime() - startTime
			}).withAdditionalProperties(metadataTelemetryInfo).send();
			isPublishSuccessful = true;
		} catch (error) {
			this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.publishChangeError', "An error occured while publishing changes: {0}", error?.message ?? error), error?.data);
			this.updateState(this.valid, this.dirty);
			this._adsTelemetryService.createErrorEvent(TelemetryView.TableDesigner, TelemetryAction.PublishChanges).withAdditionalProperties(telemetryInfo).send();
		} finally {
			// Close notification in 2 seconds to prevent user action after table publish is complete.
			// Users should not be required to close notification prompts.
			setTimeout(() => saveNotificationHandle.close(), 2000);
		}

		if (isPublishSuccessful) {
			await this.refreshNodeInOE(isNewTable);
		}
	}

	private async refreshNodeInOE(isNewTable: boolean) {
		if (!this._objectExplorerContext) {
			return;
		}

		try {
			const connectionId = this._objectExplorerContext.connectionProfile?.id;
			const nodeInfo = this._objectExplorerContext.nodeInfo;
			const node = await this._objectExplorerService.getTreeNode(connectionId, nodeInfo?.nodePath);
			let refreshNodePath: string;

			if (isNewTable) {
				refreshNodePath = nodeInfo?.nodePath;
			} else {
				// This handle the case where a user publishes a table then edit the same table within the same designer then publish again. In that case node path in OE context is already correct.
				if (node?.objectType === 'Tables') {
					refreshNodePath = nodeInfo?.nodePath
				} else {
					refreshNodePath = nodeInfo?.parentNodePath;
				}
			}

			await this._objectExplorerService.refreshNodeInView(connectionId, refreshNodePath);
		} catch (error) {
			const errorMessage = localize({
				key: 'tableDesigner.refreshOEError',
				comment: ['{0}: error message.']
			}, "An error occurred while refreshing the object explorer. {0}", error);
			this._notificationService.error(errorMessage);
		}
	}

	async save(): Promise<void> {
		this._onSubmitPendingEditRequested.fire();
		await timeout(10);
		if (this._isEditInProgress) {
			await this._activeEditPromise;
		}
		if (!this.valid || !this._recentEditAccepted) {
			return;
		}
		if (!this.isDirty()) {
			return;
		}
		if (this.tableDesignerView?.useAdvancedSaveMode) {
			await this.openPublishDialog();
		} else {
			await this.publishChanges();
		}
	}

	async openPublishDialog(): Promise<void> {
		const reportNotificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.generatingPreviewReport', "Generating preview report..."),
			sticky: true
		});
		const telemetryInfo = this.createTelemetryInfo();
		const generatePreviewEvent = this._adsTelemetryService.createActionEvent(TelemetryView.TableDesigner, TelemetryAction.GeneratePreviewReport).withAdditionalProperties(telemetryInfo);
		const startTime = new Date().getTime();
		let previewReportResult: azdata.designers.GeneratePreviewReportResult;
		try {
			this.updateState(this.valid, this.dirty, 'generateReport');
			previewReportResult = await this._provider.generatePreviewReport(this.tableInfo);
			const metadataTelemetryInfo = TableDesignerMetadata.getTelemetryInfo(this._provider.providerId, previewReportResult.metadata);
			generatePreviewEvent.withAdditionalMeasurements({
				'elapsedTimeMs': new Date().getTime() - startTime
			}).withAdditionalProperties(metadataTelemetryInfo).send();
			reportNotificationHandle.close();
			this.updateState(this.valid, this.dirty);
		} catch (error) {
			this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.generatePreviewReportError', "An error occurred while generating preview report: {0}", error?.message ?? error), error?.data);
			this.updateState(this.valid, this.dirty);
			this._adsTelemetryService.createErrorEvent(TelemetryView.TableDesigner, TelemetryAction.GeneratePreviewReport).withAdditionalProperties(telemetryInfo).send();
			return;
		}
		if (previewReportResult.schemaValidationError) {
			this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.TableSchemaValidationError', "Table schema validation failed with error: {0}", previewReportResult.schemaValidationError));
			return;
		}
		const dialog = this._instantiationService.createInstance(TableDesignerPublishDialog);
		const result = await dialog.open(previewReportResult);
		if (result === TableDesignerPublishDialogResult.GenerateScript) {
			await this.generateScript();
		} else if (result === TableDesignerPublishDialogResult.UpdateDatabase) {
			await this.publishChanges();
		}
	}

	async revert(): Promise<void> {
		this.updateState(true, false);
	}

	private async doProcessEdit(edit: DesignerEdit, checkPreviousEditResult: boolean): Promise<void> {
		if (checkPreviousEditResult && !this._recentEditAccepted) {
			return;
		}
		const telemetryInfo = this.createTelemetryInfo();
		telemetryInfo.tableObjectType = this.getObjectTypeFromPath(edit.path);
		const editAction = this._adsTelemetryService.createActionEvent(TelemetryView.TableDesigner,
			this.designerEditTypeDisplayValue[edit.type]).withAdditionalProperties(telemetryInfo);
		const startTime = new Date().getTime();
		this.updateState(this.valid, this.dirty, 'processEdit');
		this._activeEditPromise = new Promise(async (resolve) => {
			this._isEditInProgress = true;
			this._recentEditAccepted = true;
			try {
				const result = await this._provider.processTableEdit(this.tableInfo, edit);
				if (result.inputValidationError) {
					this._recentEditAccepted = false;
					this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.inputValidationError', "The input validation failed with error: {0}", result.inputValidationError));
				}
				this._viewModel = result.viewModel;
				if (result.view) {
					this.setDesignerView(result.view);
				}
				this._issues = result.issues;
				this.updateState(result.isValid, this.isDirty(), undefined);

				this._onEditProcessed.fire({
					edit: edit,
					result: {
						isValid: result.isValid,
						issues: result.issues,
						refreshView: !!result.view
					}
				});
				const metadataTelemetryInfo = TableDesignerMetadata.getTelemetryInfo(this._provider.providerId, result.metadata);
				editAction.withAdditionalMeasurements({
					'elapsedTimeMs': new Date().getTime() - startTime
				}).withAdditionalProperties(metadataTelemetryInfo).send();
			}
			catch (error) {
				this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.errorProcessingEdit', "An error occured while processing the change: {0}", error?.message ?? error), error?.data);
				this.updateState(this.valid, this.dirty);
				this._adsTelemetryService.createErrorEvent(TelemetryView.TableDesigner,
					this.designerEditTypeDisplayValue[edit.type]).withAdditionalProperties(telemetryInfo).send();
				this._recentEditAccepted = false;
			}
			finally {
				this._isEditInProgress = false;
				resolve();
			}
		});
		return this._activeEditPromise;
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

	async initialize(): Promise<void> {
		if (this._view !== undefined || this.pendingAction === 'initialize') {
			return;
		}

		this.updateState(this.valid, this.dirty, 'initialize');
		try {
			const result = await this._provider.initializeTableDesigner(this.tableInfo);
			this.doInitialization(result);
			this._onInitialized.fire();
		} catch (error) {
			this._errorMessageService.showDialog(Severity.Error, ErrorDialogTitle, localize('tableDesigner.errorInitializingTableDesigner', "An error occurred while initializing the table designer: {0}", error?.message ?? error), error?.data);
		}
	}

	private doInitialization(designerInfo: azdata.designers.TableDesignerInfo): void {
		this.tableInfo = designerInfo.tableInfo;
		this.updateState(true, this.tableInfo.isNewTable);
		this._viewModel = designerInfo.viewModel;
		this._originalViewModel = this.tableInfo.isNewTable ? undefined : deepClone(this._viewModel);
		this._tableDesignerView = designerInfo.view;
		this._issues = designerInfo.issues;
		this.setDesignerView(designerInfo.view);
	}

	private setDesignerView(tableDesignerView: azdata.designers.TableDesignerView) {
		const tabs = [];

		if (tableDesignerView.columnTableOptions?.showTable) {
			tabs.push(this.getColumnsTab(tableDesignerView.columnTableOptions, tableDesignerView.additionalComponents));
		}

		tabs.push(this.getPrimaryKeyTab(tableDesignerView, tableDesignerView.additionalComponents));

		if (tableDesignerView.foreignKeyTableOptions?.showTable) {
			tabs.push(this.getForeignKeysTab(tableDesignerView.foreignKeyTableOptions, tableDesignerView.foreignKeyColumnMappingTableOptions, tableDesignerView.additionalComponents));
		}

		if (tableDesignerView.checkConstraintTableOptions?.showTable) {
			tabs.push(this.getCheckConstraintsTab(tableDesignerView.checkConstraintTableOptions, tableDesignerView.additionalComponents));
		}

		if (tableDesignerView.indexTableOptions?.showTable) {
			tabs.push(this.getIndexesTab(tableDesignerView.indexTableOptions, tableDesignerView.indexColumnSpecificationTableOptions, tableDesignerView.additionalComponents));
		}

		if (tableDesignerView.additionalTabs) {
			tabs.push(...tableDesignerView.additionalTabs);
		}

		tabs.push(this.getGeneralTab(tableDesignerView));

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

	private getGeneralTab(tableDesignerView: azdata.designers.TableDesignerView): DesignerTab {
		const generalTabComponents: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.TableProperty.Schema,
				description: localize('designer.table.description.schema', "The schema that contains the table."),
				componentProperties: <DropDownProperties>{
					title: localize('tableDesigner.schemaTitle', "Schema"),
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

		if (tableDesignerView.additionalTableProperties) {
			generalTabComponents.push(...tableDesignerView.additionalTableProperties);
		}

		return <DesignerTab>{
			title: localize('tableDesigner.generalTab', "General"),
			components: generalTabComponents
		};
	}

	private getColumnsTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions, additionalComponents: azdata.designers.DesignerDataPropertyWithTabInfo[]): DesignerTab {

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
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Description,
				description: localize('designer.column.description.description', "Displays the description of the column"),
				componentProperties: {
					title: localize('tableDesigner.columnDescriptionTitle', "Description"),
				}
			}, {
				componentType: 'dropdown',
				propertyName: designers.TableColumnProperty.AdvancedType,
				showInPropertiesView: false,
				description: localize('designer.column.description.advancedType', "Displays the unified data type (including length, scale and precision) for the column"),
				componentProperties: {
					title: localize('tableDesigner.columnAdvancedTypeTitle', "Type"),
					width: 120,
					isEditable: true
				}
			}, {
				componentType: 'dropdown',
				propertyName: designers.TableColumnProperty.Type,
				description: localize('designer.column.description.dataType', "Displays the data type name for the column"),
				componentProperties: {
					title: localize('tableDesigner.columnTypeTitle', "Type"),
					width: 100
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
					width: 60,
					inputType: 'number'
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Scale,
				description: localize('designer.column.description.scale', "For numeric data, the maximum number of decimal digits that can be stored in this database object to the right of decimal point."),
				componentProperties: {
					title: localize('tableDesigner.columnScaleTitle', "Scale"),
					width: 60,
					inputType: 'number'
				}
			}
		];

		const displayProperties = this.getTableDisplayProperties(options, [
			designers.TableColumnProperty.Name,
			designers.TableColumnProperty.AdvancedType,
			designers.TableColumnProperty.IsPrimaryKey,
			designers.TableColumnProperty.AllowNulls,
			designers.TableColumnProperty.DefaultValue,
		]);

		const tab = <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.Columns,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.columnsTabTitle', "Columns"),
						columns: displayProperties,
						itemProperties: this.addAdditionalTableProperties(options, columnProperties),
						objectTypeDisplayName: localize('tableDesigner.columnTypeName', "Column"),
						canAddRows: options.canAddRows,
						canInsertRows: options.canInsertRows,
						canMoveRows: options.canMoveRows,
						canRemoveRows: options.canRemoveRows,
						removeRowConfirmationMessage: options.removeRowConfirmationMessage,
						showRemoveRowConfirmation: options.showRemoveRowConfirmation,
						labelForAddNewButton: options.labelForAddNewButton ?? localize('tableDesigner.addNewColumn', "New Column")
					}
				}
			]
		};
		this.appendAdditionalComponents(tab, additionalComponents, designers.TableProperty.Columns);
		return tab;
	}

	private getForeignKeysTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions, columnMappingTableOptions: azdata.designers.TableDesignerBuiltInTableViewOptions, additionalComponents: azdata.designers.DesignerDataPropertyWithTabInfo[]): DesignerTab {

		const foreignKeyColumnMappingProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.ForeignKeyColumnMappingProperty.ForeignColumn,
				componentProperties: {
					title: localize('tableDesigner.foreignKey.foreignColumn', "Foreign Column"),
					width: 150
				}
			},
			{
				componentType: 'dropdown',
				propertyName: designers.ForeignKeyColumnMappingProperty.Column,
				componentProperties: {
					title: localize('tableDesigner.foreignKey.column', "Column"),
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
				componentType: 'input',
				propertyName: designers.TableForeignKeyProperty.Description,
				description: localize('designer.foreignkey.description.description', "The description of the foreign key."),
				componentProperties: {
					title: localize('tableDesigner.foreignKeyDescriptionTitle', "Description"),
				}
			},
			{
				componentType: 'dropdown',
				propertyName: designers.TableForeignKeyProperty.ForeignTable,
				description: localize('designer.foreignkey.description.primaryKeyTable', "The table which contains the primary or unique key column."),
				componentProperties: {
					title: localize('tableDesigner.ForeignTableName', "Foreign Table"),
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
				group: localize('tableDesigner.foreignKeyColumns', "Columns"),
				componentProperties: <DesignerTableProperties>{
					ariaLabel: localize('tableDesigner.foreignKeyColumns', "Columns"),
					columns: this.getTableDisplayProperties(columnMappingTableOptions, [designers.ForeignKeyColumnMappingProperty.Column, designers.ForeignKeyColumnMappingProperty.ForeignColumn]),
					itemProperties: this.addAdditionalTableProperties(columnMappingTableOptions, foreignKeyColumnMappingProperties),
					canAddRows: columnMappingTableOptions.canAddRows,
					canRemoveRows: columnMappingTableOptions.canRemoveRows,
					removeRowConfirmationMessage: columnMappingTableOptions.removeRowConfirmationMessage,
					labelForAddNewButton: columnMappingTableOptions.labelForAddNewButton ?? localize('tableDesigner.addNewColumnMapping', "New Column Mapping")
				}
			}
		];

		const tab = <DesignerTab>{
			title: localize('tableDesigner.foreignKeysTabTitle', "Foreign Keys"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.ForeignKeys,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.foreignKeysTabTitle', "Foreign Keys"),
						columns: this.getTableDisplayProperties(options, [designers.TableForeignKeyProperty.Name, designers.TableForeignKeyProperty.ForeignTable]),
						itemProperties: this.addAdditionalTableProperties(options, foreignKeyProperties),
						objectTypeDisplayName: localize('tableDesigner.ForeignKeyTypeName', "Foreign Key"),
						canAddRows: options.canAddRows,
						canRemoveRows: options.canRemoveRows,
						removeRowConfirmationMessage: options.removeRowConfirmationMessage,
						showRemoveRowConfirmation: options.showRemoveRowConfirmation,
						labelForAddNewButton: options.labelForAddNewButton ?? localize('tableDesigner.addForeignKey', "New Foreign Key")
					}
				}
			]
		};
		this.appendAdditionalComponents(tab, additionalComponents, designers.TableProperty.ForeignKeys);
		return tab;
	}

	private getPrimaryKeyTab(view: azdata.designers.TableDesignerView, additionalComponents: azdata.designers.DesignerDataPropertyWithTabInfo[]): DesignerTab {
		const options = view.primaryKeyColumnSpecificationTableOptions;
		const columnSpecProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.TableIndexColumnSpecificationProperty.Column,
				description: localize('designer.index.column.description.name', "The name of the column."),
				componentProperties: {
					title: localize('tableDesigner.index.column.name', "Column"),
					width: 100
				}
			}];

		const tabComponents = [];
		tabComponents.push(
			{
				componentType: 'input',
				propertyName: designers.TableProperty.PrimaryKeyName,
				showInPropertiesView: false,
				description: localize('designer.table.primaryKeyName.description', "Name of the primary key."),
				componentProperties: {
					title: localize('tableDesigner.primaryKeyNameTitle', "Name")
				}
			},
			{
				componentType: 'input',
				propertyName: designers.TableProperty.PrimaryKeyDescription,
				showInPropertiesView: false,
				description: localize('designer.table.primaryKeyDescription.description', "The description of the primary key."),
				componentProperties: {
					title: localize('tableDesigner.primaryKeyDescriptionTitle', "Description"),
				}
			});
		if (view.additionalPrimaryKeyProperties) {
			view.additionalPrimaryKeyProperties.forEach(component => {
				component.showInPropertiesView = false;
				tabComponents.push(component);
			});
		}
		tabComponents.push({
			componentType: 'table',
			propertyName: designers.TableProperty.PrimaryKeyColumns,
			showInPropertiesView: false,
			description: localize('designer.table.primaryKeyColumns.description', "Columns in the primary key."),
			componentProperties: <DesignerTableProperties>{
				title: localize('tableDesigner.primaryKeyColumnsTitle', "Primary Key Columns"),
				ariaLabel: localize('tableDesigner.primaryKeyColumnsTitle', "Primary Key Columns"),
				columns: this.getTableDisplayProperties(options, [designers.TableIndexColumnSpecificationProperty.Column]),
				itemProperties: this.addAdditionalTableProperties(options, columnSpecProperties),
				objectTypeDisplayName: '',
				canAddRows: options.canAddRows,
				canRemoveRows: options.canRemoveRows,
				removeRowConfirmationMessage: options.removeRowConfirmationMessage,
				showRemoveRowConfirmation: options.showRemoveRowConfirmation,
				showItemDetailInPropertiesView: false,
				labelForAddNewButton: options.labelForAddNewButton ?? localize('tableDesigner.addNewColumnToPrimaryKey', "Add Column"),
				canMoveRows: options.canMoveRows
			}
		});

		const tab = <DesignerTab>{
			title: localize('tableDesigner.PrimaryKeyTabTitle', "Primary Key"),
			components: tabComponents
		};
		this.appendAdditionalComponents(tab, additionalComponents, designers.TableProperty.PrimaryKey);
		return tab;
	}

	private getCheckConstraintsTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions, additionalComponents: azdata.designers.DesignerDataPropertyWithTabInfo[]): DesignerTab {
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
				propertyName: designers.TableCheckConstraintProperty.Description,
				description: localize('designer.checkConstraint.description.description', "The description of the check constraint."),
				componentProperties: {
					title: localize('tableDesigner.checkConstraintDescriptionTitle', "Description"),
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

		const tab = <DesignerTab>{
			title: localize('tableDesigner.checkConstraintsTabTitle', "Check Constraints"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.CheckConstraints,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.checkConstraintsTabTitle', "Check Constraints"),
						columns: this.getTableDisplayProperties(options, [designers.TableCheckConstraintProperty.Name, designers.TableCheckConstraintProperty.Expression]),
						itemProperties: this.addAdditionalTableProperties(options, checkConstraintProperties),
						objectTypeDisplayName: localize('tableDesigner.checkConstraintTypeName', "Check Constraint"),
						canAddRows: options.canAddRows,
						canRemoveRows: options.canRemoveRows,
						removeRowConfirmationMessage: options.removeRowConfirmationMessage,
						showRemoveRowConfirmation: options.showRemoveRowConfirmation,
						labelForAddNewButton: options.labelForAddNewButton ?? localize('tableDesigner.addNewCheckConstraint', "New Check Constraint")
					}
				}
			]
		};
		this.appendAdditionalComponents(tab, additionalComponents, designers.TableProperty.CheckConstraints);
		return tab;
	}

	private getIndexesTab(options: azdata.designers.TableDesignerBuiltInTableViewOptions, columnSpecTableOptions: azdata.designers.TableDesignerBuiltInTableViewOptions, additionalComponents: azdata.designers.DesignerDataPropertyWithTabInfo[]): DesignerTab {
		const columnSpecProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.TableIndexColumnSpecificationProperty.Column,
				description: localize('designer.index.column.description.name', "The name of the column."),
				componentProperties: {
					title: localize('tableDesigner.index.column.name', "Column"),
					width: 100
				}
			}];
		const indexProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'input',
				propertyName: designers.TableIndexProperty.Name,
				description: localize('designer.index.description.name', "The name of the index."),
				componentProperties: {
					title: localize('tableDesigner.indexName', "Name"),
					width: 200
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableIndexProperty.Description,
				description: localize('designer.index.description.description', "The description of the index."),
				componentProperties: {
					title: localize('tableDesigner.indexDescription', "Description"),
					width: 200
				}
			}, {
				componentType: 'table',
				propertyName: designers.TableIndexProperty.Columns,
				description: localize('designer.index.description.columns', "The columns of the index."),
				group: localize('tableDesigner.indexColumns', "Columns"),
				componentProperties: <DesignerTableProperties>{
					ariaLabel: localize('tableDesigner.indexColumns', "Columns"),
					columns: this.getTableDisplayProperties(columnSpecTableOptions, [designers.TableIndexColumnSpecificationProperty.Column]),
					itemProperties: this.addAdditionalTableProperties(columnSpecTableOptions, columnSpecProperties),
					objectTypeDisplayName: '',
					canAddRows: columnSpecTableOptions.canAddRows,
					canRemoveRows: columnSpecTableOptions.canRemoveRows,
					removeRowConfirmationMessage: columnSpecTableOptions.removeRowConfirmationMessage,
					showRemoveRowConfirmation: columnSpecTableOptions.showRemoveRowConfirmation,
					labelForAddNewButton: columnSpecTableOptions.labelForAddNewButton ?? localize('tableDesigner.addNewColumnToIndex', "Add Column")
				}
			}
		];

		const tab = <DesignerTab>{
			title: localize('tableDesigner.indexesTabTitle', "Indexes"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.Indexes,
					showInPropertiesView: false,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.indexesTabTitle', "Indexes"),
						columns: this.getTableDisplayProperties(options, [designers.TableIndexProperty.Name]),
						itemProperties: this.addAdditionalTableProperties(options, indexProperties),
						objectTypeDisplayName: localize('tableDesigner.IndexTypeName', "Index"),
						canAddRows: options.canAddRows,
						canRemoveRows: options.canRemoveRows,
						removeRowConfirmationMessage: options.removeRowConfirmationMessage,
						showRemoveRowConfirmation: options.showRemoveRowConfirmation,
						labelForAddNewButton: options.labelForAddNewButton ?? localize('tableDesigner.addNewIndex', "New Index")
					}
				}
			]
		};
		this.appendAdditionalComponents(tab, additionalComponents, designers.TableProperty.Indexes);
		return tab;
	}

	private appendAdditionalComponents(tab: DesignerTab, components: azdata.designers.DesignerDataPropertyWithTabInfo[], tabInfo: designers.TableProperty.Columns | designers.TableProperty.PrimaryKey | designers.TableProperty.ForeignKeys | designers.TableProperty.CheckConstraints | designers.TableProperty.Indexes) {
		const additionalTables = this.getAdditionalComponentsForTab(components, tabInfo);
		if (additionalTables) {
			tab.components.push(...additionalTables);
		}
	}

	private getAdditionalComponentsForTab(components: azdata.designers.DesignerDataPropertyWithTabInfo[], tab: designers.TableProperty.Columns | designers.TableProperty.PrimaryKey | designers.TableProperty.ForeignKeys | designers.TableProperty.CheckConstraints | designers.TableProperty.Indexes): azdata.designers.DesignerDataPropertyInfo[] {
		if (components) {
			return components.filter(c => c.tab === tab);
		}
		return [];
	}

	private getTableDisplayProperties(options: azdata.designers.TableDesignerBuiltInTableViewOptions, defaultProperties: string[]): string[] {
		return options.propertiesToDisplay?.length > 0 ? options.propertiesToDisplay : defaultProperties;
	}

	private addAdditionalTableProperties(options: azdata.designers.TableDesignerBuiltInTableViewOptions, properties: DesignerDataPropertyInfo[]): DesignerDataPropertyInfo[] {
		if (options.additionalProperties) {
			properties.push(...options.additionalProperties);
		}
		return properties;
	}

	private createTelemetryInfo(): ITelemetryEventProperties {
		let telemetryInfo = {
			provider: this._provider.providerId,
			isNewTable: this.tableInfo.isNewTable,
		};
		Object.assign(telemetryInfo, this._telemetryInfo);
		return telemetryInfo;
	}

	private isDirty(): boolean {
		const copyOfViewModel = deepClone(this._viewModel);
		const copyOfOriginalViewModel = deepClone(this._originalViewModel);
		// The generated script might be slightly different even though the models are the same
		// espeically the order of the description property statements.
		// we should take the script out for comparison.
		if (copyOfViewModel) {
			delete copyOfViewModel[ScriptProperty];
		}
		if (copyOfOriginalViewModel) {
			delete copyOfOriginalViewModel[ScriptProperty];
		}
		return !equals(copyOfViewModel, copyOfOriginalViewModel);
	}

	/**
	 * 	1. 'Add' scenario
			a. ['propertyName1']. Example: add a column to the columns property: ['columns'].
			b. ['propertyName1',index-1,'propertyName2']. Example: add a column mapping to the first foreign key: ['foreignKeys',0,'mappings'].
		2. 'Update' scenario
			a. ['propertyName1']. Example: update the name of the table: ['name'].
			b. ['propertyName1',index-1,'propertyName2']. Example: update the name of a column: ['columns',0,'name'].
			c. ['propertyName1',index-1,'propertyName2',index-2,'propertyName3']. Example: update the source column of an entry in a foreign key's column mapping table: ['foreignKeys',0,'mappings',0,'source'].
		3. 'Remove' scenario
			a. ['propertyName1',index-1]. Example: remove a column from the columns property: ['columns',0'].
			b. ['propertyName1',index-1,'proper
		The return values would be the propertyNames followed by slashes in level order. Eg.: propertyName1/propertyName2/...
	 */
	private getObjectTypeFromPath(path: DesignerPropertyPath): string {
		let typeArray = [];
		for (let i = 0; i < path.length; i++) {
			if (i % 2 === 0) {
				typeArray.push(path[i]);
			}
		}
		return typeArray.join('/');
	}

	private escapeAllApostrophes(edit: DesignerEdit): void {
		if (typeof edit.value === 'string' && edit.value.includes('\'')) {
			edit.value = edit.value.replace(/'/g, '\'\'');
		}
	}
}
