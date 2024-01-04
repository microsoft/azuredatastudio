/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as path from 'path';
const localize = nls.loadMessageBundle();

import { IWizardPageWrapper } from '../wizardPageWrapper';
import { VirtualizeDataModel } from './virtualizeDataModel';
import { ColumnDefinition, ExternalTableInfo, SchemaTables, FileFormat, ExecutionResult, SchemaViews } from '../../services/contracts';
import { CheckboxTreeNode, CheckboxTreeDataProvider } from './virtualizeDataTree';
import { VirtualizeDataInput } from '../../services/contracts';
import { AppContext } from '../../appContext';
import { VDIManager } from './virtualizeDataInputManager';
import * as loc from '../../localizedConstants';

export class ObjectMappingPage implements IWizardPageWrapper {
	private _page: azdata.window.WizardPage;
	private _modelBuilder: azdata.ModelBuilder;

	// data source tree
	private _dataSourceTreeContainer: azdata.FlexContainer;
	private _dataSourceTableTreeSpinner: azdata.LoadingComponent;
	private _dataSourceTableTree: azdata.TreeComponent<CheckboxTreeNode>;
	private _treeRootNode: CheckboxTreeNode;

	// object mapping wrapper
	private _objectMappingWrapperSpinner: azdata.LoadingComponent;
	private _objectMappingWrapper: azdata.FlexContainer;
	private _objectMappingContainer: azdata.FlexContainer;
	private _tableHelpTextContainer: azdata.FlexContainer;

	// table name mapping container
	private _tableNameMappingContainer: azdata.FlexContainer;
	private _sourceTableNameContainer: azdata.FlexContainer;
	private _sourceSchemaInputBox: azdata.InputBoxComponent;
	private _sourceTableNameInputBox: azdata.InputBoxComponent;
	private _destTableNameInputContainer: azdata.FlexContainer;
	private _destTableSchemaDropdown: azdata.DropDownComponent;
	private _destTableNameInputBox: azdata.InputBoxComponent;

	// column mapping table container
	private _columnMappingTableSpinner: azdata.LoadingComponent;
	private _columnMappingTableContainer: azdata.FormContainer;
	private _columnMappingTable: azdata.DeclarativeTableComponent;
	private _columnMappingTableHeader: azdata.DeclarativeTableColumn[];

	// current status
	private _selectedLocation: string[];

	// dependencies
	private _dataSourceBrowser: DataSourceBrowser;
	private _mappingInfoCache: MappingInfoCache;
	private _mappingInfoRetriever: MappingInfoRetriever;
	private _dataModel: VirtualizeDataModel;
	private _vdiManager: VDIManager;
	private _appContext: AppContext;

	private _existingSchemaNames: string[] = [];

	constructor(dataModel: VirtualizeDataModel, vdiManager: VDIManager, appContext: AppContext) {
		if (dataModel && vdiManager && appContext) {
			CheckboxTreeNode.clearNodeRegistry();
			TableTreeNode.clearTableNodeCache();

			this._dataModel = dataModel;
			this._vdiManager = vdiManager;
			this._appContext = appContext;
			PathResolver.initialize(this._appContext);
			this._dataSourceBrowser = new DataSourceBrowser(this._dataModel, this._vdiManager);
			this._mappingInfoCache = new MappingInfoCache(this._vdiManager);
			this._mappingInfoRetriever = new MappingInfoRetriever(this._dataSourceBrowser, this._mappingInfoCache, this._dataModel);
			this._treeRootNode = undefined;
			this.buildPage();
		}
	}

	private async buildPage(): Promise<void> {
		this._page = this._appContext.apiWrapper.createWizardPage(localize('objectMappingTitle', 'Map your data source objects to your external table'));

		this._page.registerContent(async (modelView) => {
			this._modelBuilder = modelView.modelBuilder;

			this.buildSourceTreeContainer();
			await this.buildObjectMappingWrapper();

			let mainContainer = this._modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				alignItems: 'stretch',
				width: '100%',
				height: '100%'
			}).component();
			mainContainer.addItem(this._dataSourceTableTreeSpinner, {
				flex: '1, 0, 0%',
				CSSStyles: {
					'width': '38%',
					'height': '100%',
					'resize': 'horizontal',
					'overflow': 'scroll',
					'border-right': '1px solid rgb(185, 185, 185)',
				}
			});
			mainContainer.addItem(this._objectMappingWrapperSpinner, {
				flex: '1, 0, 0%',
				CSSStyles: {
					'border-left': '1px solid rgb(185, 185, 185)',
					'margin-left': '-1px',
					'width': '100%',
					'height': '100%',
					'overflow': 'scroll'
				}
			});

			let wrapperContainer = this._modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				alignItems: 'stretch',
				width: '100%',
				height: '100%',
			}).component();
			wrapperContainer.addItem(mainContainer, {
				flex: '1, 0, 0%',
				CSSStyles: {
					'border-top': '2px solid rgba(0, 0, 0, 0.22)',
					'width': '100%',
					'overflow': 'auto'
				}
			});

			await modelView.initializeModel(wrapperContainer);
		});
	}

	private buildSourceTreeContainer(): void {
		this._dataSourceTreeContainer = this._modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			alignItems: 'stretch',
			width: '100%',
			height: '100%'
		}).component();

		this._dataSourceTableTreeSpinner = this._modelBuilder.loadingComponent()
			.withItem(this._dataSourceTreeContainer)
			.withProps({ loading: false })
			.component();
	}

	private async buildObjectMappingWrapper(): Promise<void> {
		await this.buildObjectMappingContainer();
		this.buildTableHelpTextContainer();

		this._objectMappingWrapper = this._modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			alignItems: 'stretch',
			width: '100%'
		}).component();

		this._objectMappingWrapperSpinner =
			this._modelBuilder.loadingComponent()
				.withItem(this._objectMappingWrapper)
				.withProps({ loading: false })
				.component();
	}

	private async buildObjectMappingContainer(): Promise<void> {
		this.buildTableNameMappingContainer();
		await this.buildColumnMappingTableContainer();

		this._objectMappingContainer = this._modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			alignItems: 'stretch',
			width: '100%',
			height: '100%'
		}).component();
		this._objectMappingContainer.addItem(this._tableNameMappingContainer, {
			flex: '0',
			CSSStyles: {
				'width': '100%',
				'height': '90px'
			}
		});
		this._objectMappingContainer.addItem(this._columnMappingTableSpinner, {
			flex: '1',
			CSSStyles: {
				'width': '100%'
			}
		});
	}

	private buildTableNameMappingContainer(): void {
		this.buildSourceTableNameInputContainer();
		this.buildDestTableNameInputContainer();
		let arrowText: azdata.TextComponent = this._modelBuilder.text()
			.withProps({ value: '\u279F' })
			.component();

		this._tableNameMappingContainer = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				alignItems: 'stretch',
				width: '100%',
				height: '100%'
			})
			.component();

		this._tableNameMappingContainer.addItem(this._sourceTableNameContainer, {
			flex: '1, 1, 0%',
			CSSStyles: { 'width': '40%' }
		});
		this._tableNameMappingContainer.addItem(arrowText, {
			flex: '0',
			CSSStyles: {
				'font-size': '30px',
				'align': 'center',
				'padding': '16px 7px 0px'
			}
		});
		this._tableNameMappingContainer.addItem(this._destTableNameInputContainer, {
			flex: '1, 1, 0%',
			CSSStyles: {
				'width': '60%'
			}
		});
	}

	private buildSourceTableNameInputContainer(): void {
		this._sourceSchemaInputBox = this._modelBuilder.inputBox()
			.withProps({ width: '100%', ariaLabel: loc.sourceSchemaTitle })
			.component();
		let dotText = this._modelBuilder.text()
			.withProps({ value: '.' })
			.component();
		this._sourceTableNameInputBox = this._modelBuilder.inputBox()
			.withProps({ width: '100%', ariaLabel: loc.sourceTableTitle })
			.component();

		let bindingContainer: azdata.FlexContainer = this._modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'center', width: '100%' })
			.component();
		bindingContainer.addItem(this._sourceSchemaInputBox, {
			CSSStyles: { 'width': '30%', 'pointer-events': 'none', 'padding': '8px 0px 8px 8px' }
		});
		bindingContainer.addItem(dotText, {
			flex: '0, 1, 0%',
			CSSStyles: { 'font-wight': '900', 'padding': '0px 3px 0px 3px' }
		});
		bindingContainer.addItem(this._sourceTableNameInputBox, {
			CSSStyles: { 'width': '70%', 'pointer-events': 'none', 'padding': '8px 8px 8px 0px' }
		});

		let wrapperContainer: azdata.FlexContainer = this._modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'center', width: '100%' })
			.component();
		wrapperContainer.addItem(bindingContainer, {
			CSSStyles: { 'width': '100%' }
		});

		let titledContainer = new TitledContainer(this._modelBuilder);
		titledContainer.title = loc.sourceTableTitle;
		titledContainer.setTitleMargin(0, 0, 7, 0);
		titledContainer.setPadding(15, 30, 0, 30);
		titledContainer.addContentContainer(wrapperContainer);
		this._sourceTableNameContainer = titledContainer.flexContainer;
	}

	private buildDestTableNameInputContainer(): void {
		this._destTableSchemaDropdown = this._modelBuilder.dropDown()
			.withProps({
				ariaLabel: loc.externalSchemaTitle,
				editable: true,
				width: '100%',
				fireOnTextChange: true
			}).component();
		this._destTableSchemaDropdown.onValueChanged(async () => {
			await this.storeUserModification();
		});

		let dotText = this._modelBuilder.text()
			.withProps({ value: '.' })
			.component();

		this._destTableNameInputBox = this._modelBuilder.inputBox()
			.withProps({ width: '100%', ariaLabel: loc.externalTableTitle })
			.component();
		this._destTableNameInputBox.onTextChanged(async () => {
			await this.storeUserModification();
		});

		let destTableNameInputContainer: azdata.FlexContainer = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				alignItems: 'center',
				width: '100%'
			})
			.component();
		destTableNameInputContainer.addItem(this._destTableSchemaDropdown, {
			flex: '1, 1, 0%',
			CSSStyles: {
				'width': '30%',
				'padding': '8px 0px 8px 8px'
			}
		});
		destTableNameInputContainer.addItem(dotText, {
			flex: '0, 1, 0%',
			CSSStyles: {
				'font-wight': '900',
				'padding': '0px 3px 0px 3px'
			}
		});
		destTableNameInputContainer.addItem(this._destTableNameInputBox, {
			flex: '1, 1, 0%',
			CSSStyles: {
				'width': '70%',
				'padding': '8px 8px 8px 0px'
			}
		});

		let wrapperContainer: azdata.FlexContainer = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				alignItems: 'center',
				width: '100%'
			})
			.component();
		wrapperContainer.addItem(destTableNameInputContainer, {
			flex: '1, 1, 0%',
			CSSStyles: {
				'width': '100%'
			}
		});

		let titledContainer = new TitledContainer(this._modelBuilder);
		titledContainer.title = loc.externalTableTitle;
		titledContainer.setTitleMargin(0, 0, 7, 0);
		titledContainer.setPadding(15, 30, 0, 30);
		titledContainer.addContentContainer(wrapperContainer);
		this._destTableNameInputContainer = titledContainer.flexContainer;
	}

	private async buildColumnMappingTableContainer(): Promise<void> {
		this.buildColumnMappingTableHeader();

		this._columnMappingTable = this._modelBuilder.declarativeTable().withProperties({
			columns: this._columnMappingTableHeader,
			data: [['', '', '', false, '']],
			width: '100%'
		}).component();

		this._columnMappingTableContainer = this._modelBuilder.formContainer()
			.withFormItems([{
				component: this._columnMappingTable,
				title: localize('externalTableMappingLabel', 'Column Mapping')
			}], {
				horizontal: false,
				componentWidth: '100%'
			})
			.withLayout({
				width: '100%'
			})
			.component();

		this._columnMappingTable.onDataChanged(async () => {
			await this.storeUserModification();
		});

		this._columnMappingTableSpinner = this._modelBuilder.loadingComponent()
			.withItem(this._columnMappingTableContainer)
			.withProps({ loading: false })
			.component();
	}

	private buildColumnMappingTableHeader(): void {
		let columns: azdata.DeclarativeTableColumn[] = [{
			displayName: localize('mapping.SourceName', 'Source'),
			valueType: azdata.DeclarativeDataType.string,
			width: '28%',
			isReadOnly: true,
			categoryValues: undefined
		}, {
			displayName: localize('mapping.externalName', 'External'),
			valueType: azdata.DeclarativeDataType.string,
			width: '28%',
			isReadOnly: true,
			categoryValues: undefined
		}, {
			displayName: localize('mapping.sqlDataType', 'SQL Data Type'),
			valueType: azdata.DeclarativeDataType.string,
			width: '15%',
			isReadOnly: true,
			categoryValues: undefined
		}, {
			displayName: localize('mapping.nullable', 'Nullable'),
			valueType: azdata.DeclarativeDataType.boolean,
			width: '5%',
			isReadOnly: true,
			categoryValues: undefined
		}, {
			displayName: localize('mapping.collations', 'Collations'),
			valueType: azdata.DeclarativeDataType.string,
			width: '20%',
			isReadOnly: true,
			categoryValues: undefined
		}];

		this._columnMappingTableHeader = columns;
	}

	private buildTableHelpTextContainer(): void {
		let tableHelpText = localize('mappingTableHelpText', 'Clicking on the table name will show you the column mapping information for that table.');
		let tableHelpTextComponent = this._modelBuilder.text().withProperties({ value: tableHelpText }).component();

		let checkboxHelpText = localize('mappingTableCheckboxHelpText', 'Clicking on the checkbox will select that table to be mapped.');
		let checkboxHelpTextComponent = this._modelBuilder.text().withProperties({ value: checkboxHelpText }).component();

		this._tableHelpTextContainer =
			this._modelBuilder.flexContainer()
				.withItems([tableHelpTextComponent, checkboxHelpTextComponent], {
					CSSStyles: {
						'flex': '1, 0, 0%',
						'padding': '0 30px 0 30px'
					}
				})
				.withLayout(<azdata.FlexLayout>{
					flexFlow: 'column',
					height: '100%',
					width: '100%'
				})
				.component();
	}

	private toggleObjectMappingWrapper(): void {
		this._objectMappingWrapper.clearItems();
		if (this._selectedLocation) {
			this._objectMappingWrapper.addItem(this._objectMappingContainer, {
				flex: '1',
				CSSStyles: {
					'width': '100%'
				}
			});
		} else {
			this._objectMappingWrapper.addItem(this._tableHelpTextContainer, {
				flex: '1',
				CSSStyles: {
					'width': '100%'
				}
			});
		}
	}

	private async storeUserModification(): Promise<void> {
		if (!this._destTableNameInputBox || !this._destTableSchemaDropdown || !this._selectedLocation) {
			return;
		}

		if (!this._columnMappingTable || !this._columnMappingTable.data || this._columnMappingTable.data.length === 0) {
			return;
		}

		let colDefResult = await this._dataSourceBrowser.getColumnDefinitions(this._selectedLocation);
		if (!colDefResult || !colDefResult.isSuccess) {
			return;
		}

		if (colDefResult.returnValue.find(e => e.isSupported === false)) {
			return;
		}

		let colDefs: ColumnDefinition[] = [];
		this._columnMappingTable.data.forEach(row => {
			colDefs.push({
				columnName: row[MappingProperty.ColumnName],
				dataType: row[MappingProperty.DataType],
				isNullable: row[MappingProperty.IsNullable],
				collationName: row[MappingProperty.CollationName]
			});
		});

		let tableNameWithoutSchema: string = this._destTableNameInputBox.value
			|| LocationHandler.getTableName(this._selectedLocation);
		let desiredTableName = [`${this._destTableSchemaDropdown.value}`, tableNameWithoutSchema];
		this._mappingInfoCache.putMappingInfo(desiredTableName, this._selectedLocation, colDefs, true);
	}

	public async updatePage(): Promise<void> {
		let destinationDB = this._vdiManager.destinationDatabaseName;
		let dbInfo = await this._dataModel.loadDatabaseInfo(destinationDB);
		this._existingSchemaNames = dbInfo ? dbInfo.schemaList : [];

		CheckboxTreeNode.clearNodeRegistry();
		TableTreeNode.clearNodeRegistry();
		this._dataSourceBrowser.clearCache();

		this._selectedLocation = undefined;

		this.updateSourceTreeContainer();
		this.toggleObjectMappingWrapper();
	}

	private updateSourceTreeContainer(): void {
		if (!this._modelBuilder || !this._dataSourceTreeContainer) { return; }

		let treeHeight: string = '800px';
		this._dataSourceTableTree = this._modelBuilder.tree<CheckboxTreeNode>().withProperties({
			withCheckbox: true,
			height: treeHeight
		}).component();

		this._dataSourceTreeContainer.clearItems();
		this._dataSourceTreeContainer.addItem(this._dataSourceTableTree, {
			CSSStyles: {
				'padding': '10px 0px 0px 10px',
				'height': treeHeight
			}
		});

		this._treeRootNode = RootTreeNode.getInstance(this._dataSourceBrowser, this._dataSourceTableTreeSpinner);
		let treeDataProvider = new CheckboxTreeDataProvider(this._treeRootNode);
		let treeView = this._dataSourceTableTree.registerDataProvider(treeDataProvider);
		treeView.onNodeCheckedChanged(async item => {
			if (item && item.element) {
				await this.actionOnNodeCheckStatusChanged(item.element, item.checked);
			}
		});
		treeView.onDidChangeSelection(async selectedNodes => {
			if (selectedNodes && selectedNodes.selection && selectedNodes.selection.length === 1 && selectedNodes.selection[0]) {
				await this.actionOnNodeIsSelected(selectedNodes.selection[0]);
			}
		});
	}

	private async actionOnNodeCheckStatusChanged(node: CheckboxTreeNode, checked: boolean): Promise<void> {
		if (node && checked !== undefined) {
			await this.checkAndExpand(node, checked);
		}
	}

	private async checkAndExpand(treeNode: CheckboxTreeNode, checked: boolean): Promise<void> {
		treeNode.setCheckedState(checked);
		let nodes: CheckboxTreeNode[] = [treeNode];
		let tableNodes: CheckboxTreeNode[] = [];
		while (nodes && nodes.length > 0) {
			let node = nodes.shift();
			node.setCheckedState(checked);
			if (node instanceof TableTreeNode) {
				tableNodes.push(node);
			} else {
				let newChildren = await node.getChildren();
				if (newChildren && newChildren.length > 0) {
					nodes = newChildren.concat(nodes);
				}
			}
		}
		for (let tn of tableNodes) {
			await this.loadColumnDefinitions(tn as TableTreeNode);
		}
		treeNode.notifyStateChanged();
	}

	private async actionOnNodeIsSelected(node: CheckboxTreeNode): Promise<void> {
		if (node) {
			if (node instanceof TableTreeNode) {
				let tableNode: TableTreeNode = node as TableTreeNode;
				if (!this._selectedLocation) {
					this._selectedLocation = tableNode.location;
					this._objectMappingWrapperSpinner.loading = true;
					await this.loadColumnDefinitions(tableNode);
					this.toggleObjectMappingWrapper();
					this._objectMappingWrapperSpinner.loading = false;
					await this.updateObjectMappingContainer(tableNode);
				} else {
					this._selectedLocation = tableNode.location;
					this._columnMappingTableSpinner.loading = true;
					await this.updateObjectMappingContainer(tableNode);
					this._columnMappingTableSpinner.loading = false;

				}
			}
		}
	}

	private async loadColumnDefinitions(tableNode: TableTreeNode): Promise<ExecutionResult<TableMappingInfo>> {
		if (!tableNode) {
			return;
		}
		let location: string[] = tableNode.location;
		if (!location) {
			return;
		}
		let mappingInfoResult = await this._mappingInfoRetriever.getMappingInfo(location);
		if (mappingInfoResult && mappingInfoResult.isSuccess && tableNode.enabled) {
			let mappingInfo = mappingInfoResult.returnValue;
			let unsupportedColumn = mappingInfo && mappingInfo.columnDefinitionList &&
				mappingInfo.columnDefinitionList.find(colDef => colDef.isSupported === false);
			if (unsupportedColumn) {
				await tableNode.setCheckedState(false);
				await tableNode.setEnable(false);
			}
		}
		return mappingInfoResult;
	}

	private async updateObjectMappingContainer(tableNode: TableTreeNode): Promise<void> {
		let location: string[] = tableNode.location || this._selectedLocation;
		if (location && location.length >= 2) {
			let mappingInfoResult = await this.loadColumnDefinitions(tableNode);
			let sourceSchemaName: string = LocationHandler.getSchemaName(location);
			let sourceTableName: string = LocationHandler.getTableName(location);
			let destSchemaName: string = undefined;
			let destTableName: string = undefined;
			let enableTableNameMapping: boolean = undefined;
			let colDefList: ColumnDefinition[] = undefined;

			if (mappingInfoResult && mappingInfoResult.isSuccess && mappingInfoResult.returnValue) {
				let mappingInfo: TableMappingInfo = mappingInfoResult.returnValue;
				destSchemaName = mappingInfo.externalTableName[0];
				destTableName = mappingInfo.externalTableName[1];
				enableTableNameMapping = true;
				colDefList = mappingInfo && mappingInfo.columnDefinitionList;

				let unsupportedColumns = mappingInfo &&
					mappingInfo.columnDefinitionList.filter(colDef => colDef.isSupported === false).map(e => [e.columnName, e.dataType]);
				if (unsupportedColumns && unsupportedColumns.length > 0) {
					enableTableNameMapping = false;
					this._dataModel.showWizardWarning(
						localize('warning.unsupported_column_type_title', 'Unsupported Column Types found'),
						localize('warning.unsupported_column_type_description', 'These column types are not supported for external tables:{0}{1}',
							os.EOL, unsupportedColumns.map(e => `  * ${e[0]} (${e[1]})`).join(os.EOL))
					);
				}
			} else {
				destSchemaName = this._dataModel.defaultSchema;
				destTableName = sourceTableName;
				enableTableNameMapping = false;
				colDefList = undefined;

				let errorMessages: string[] = mappingInfoResult.errorMessages;
				if (!errorMessages) {
					let errorMsg: string = localize('noTableError', `No table information present for '{0}'`, LocationHandler.getLocationString(location));
					errorMessages = [errorMsg];
				}
				this._dataModel.showWizardError(errorMessages.join(" "));
			}

			await this.updateTableNameMappingContainer(sourceSchemaName, sourceTableName, destSchemaName, destTableName, enableTableNameMapping);
			await this.updateColumnMappingContainer(colDefList);
		}
	}

	private async updateTableNameMappingContainer(sourceSchemaName: string, sourceTableName: string,
		destSchemaName: string, destTableName: string, enabled?: boolean
	): Promise<void> {
		if (enabled === undefined) { enabled = true; }
		await this._sourceSchemaInputBox.updateProperties({
			value: sourceSchemaName
		});
		await this._sourceTableNameInputBox.updateProperties({
			value: sourceTableName
		});
		await this._destTableSchemaDropdown.updateProperties({
			values: this._dataModel.schemaList,
			// Default to the source schema if we have it (which will create it if it doesn't exist)
			value: destSchemaName ? destSchemaName : this._dataModel.defaultSchema,
			enabled: enabled
		});
		await this._destTableNameInputBox.updateProperties({
			value: destTableName,
			enabled: enabled
		});
	}

	private async updateColumnMappingContainer(columnDefinitions: ColumnDefinition[]): Promise<void> {
		let colDefTableData = [['', '', '', false, '']];
		if (columnDefinitions && columnDefinitions.length > 0) {
			colDefTableData = [];
			columnDefinitions.forEach(def => {
				colDefTableData.push([def.columnName, def.columnName, def.dataType, def.isNullable, def.collationName]);
			});
		}
		await this._columnMappingTable.updateProperties({
			data: colDefTableData,
			width: '100%'
		});
	}

	public async validate(): Promise<boolean> {
		await this.storeUserModification();
		await this.loadCheckedTableColDefs();
		if (!this.anythingToCreateExists()) {
			this._dataModel.showWizardError(localize('noObjectSelectedMessage', 'No objects were selected.'));
			return false;
		}
		return true;
	}

	private anythingToCreateExists(): boolean {
		return this._vdiManager.destDbMasterKeyPwd !== undefined ||
			this._vdiManager.newDataSourceName !== undefined ||
			(this._vdiManager.externalTableInfoList !== undefined &&
				this._vdiManager.externalTableInfoList.length > 0);
	}

	public async loadCheckedTableColDefs(): Promise<void> {
		let checkedTableNodes: TableTreeNode[] = this.getCheckedTableNodes();
		if (!checkedTableNodes || checkedTableNodes.length === 0) { return; }

		for (let i = checkedTableNodes.length - 1; i >= 0; --i) {
			await this.loadColumnDefinitions(checkedTableNodes[i]);
		}
	}

	public getCheckedTableNodes(): TableTreeNode[] {
		if (!this._vdiManager) { return undefined; }

		let dataSourceName = this._vdiManager.dataSourceName;
		if (!dataSourceName) { return undefined; }

		let sourceServerName = this._vdiManager.sourceServerName;
		if (!sourceServerName) { return undefined; }

		let sourceDatabaseName = this._vdiManager.sourceDatabaseName;

		let tableNodes: TableTreeNode[] = TableTreeNode.getAllNodes(dataSourceName, sourceServerName, sourceDatabaseName);
		if (!tableNodes || tableNodes.length === 0) { return undefined; }

		tableNodes = tableNodes.filter(e => e.checked);
		if (!tableNodes || tableNodes.length === 0) { return undefined; }

		return tableNodes;
	}

	public getPage(): azdata.window.WizardPage {
		return this._page;
	}

	public getInputValues(existingInput: VirtualizeDataInput): void {
		existingInput.externalTableInfoList = undefined;
		existingInput.newSchemas = undefined;

		let checkedTableNodes: TableTreeNode[] = this.getCheckedTableNodes();
		if (!checkedTableNodes || checkedTableNodes.length === 0) { return; }

		let checkedLocations: string[][] = checkedTableNodes.map(e => e.location);
		if (!checkedLocations || checkedLocations.length === 0) { return; }

		let externalTableInfoList = [];
		let newSchemaSet = new Set<string>();
		let existingSchemaSet = new Set(this._existingSchemaNames);
		checkedLocations.forEach(location => {
			let externalTableInfo: TableMappingInfo = this._mappingInfoCache.getMappingInfo(location);
			if (externalTableInfo) {
				externalTableInfoList.push(externalTableInfo);

				if (externalTableInfo.externalTableName.length === 2) {
					let schemaName = externalTableInfo.externalTableName[0];
					if (!existingSchemaSet.has(schemaName)) {
						newSchemaSet.add(schemaName);
					}
				}
			}
		});

		existingInput.newSchemas = Array.from(newSchemaSet);
		existingInput.externalTableInfoList = externalTableInfoList;
	}
}

enum MappingProperty {
	ColumnName = 1,
	DataType = 2,
	IsNullable = 3,
	CollationName = 4
}

class RootTreeNode extends CheckboxTreeNode {
	private _dataSourceBrowser: DataSourceBrowser;
	private _treeSpinner: azdata.LoadingComponent;

	constructor(dataSourceBrowser: DataSourceBrowser, treeSpinner?: azdata.LoadingComponent) {
		super({ isRoot: true });
		this.setDataSourceBrowser(dataSourceBrowser);
		this._treeSpinner = treeSpinner || this._treeSpinner;
	}

	public setDataSourceBrowser(dataSourceBrowser: DataSourceBrowser): void {
		if (dataSourceBrowser) {
			this._dataSourceBrowser = dataSourceBrowser || this._dataSourceBrowser;
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(this._dataSourceBrowser);
			super.setArgs({ treeId: treeId });
		}
	}

	public async getChildren(): Promise<CheckboxTreeNode[]> {
		if (!this.hasChildren) {
			await this.setTreeLoadingState(true);
			let dbNames: string[] = await this._dataSourceBrowser.getDatabaseNames();
			if (dbNames && dbNames.length > 0) {
				dbNames.forEach(dbName => {
					let childNode = DatabaseTreeNode.getInstance(dbName, this._dataSourceBrowser);
					this.addChildNode(childNode);
				});
				this.notifyStateChanged();
			}
			await this.setTreeLoadingState(false);
		}
		this.children = this.children.sort((a, b) => a.label.localeCompare(b.label));
		return this.children;
	}

	private async setTreeLoadingState(isLoading: boolean): Promise<void> {
		if (this._treeSpinner) {
			await this._treeSpinner.updateProperties({ loading: isLoading });
		}
	}

	public get iconPath(): string {
		return '';
	}

	public static getInstance(dataSourceBrowser: DataSourceBrowser, treeSpinner: azdata.LoadingComponent): RootTreeNode {
		let rootNode: RootTreeNode = undefined;
		if (dataSourceBrowser) {
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(dataSourceBrowser);
			if (treeId) {
				rootNode = CheckboxTreeNode.findNode(treeId, 'root') as RootTreeNode;
				if (!rootNode) {
					rootNode = new RootTreeNode(dataSourceBrowser, treeSpinner);
				}
			}
		}
		return rootNode;
	}
}

class DataSourceId {
	public static getId(dataSourceName: string, sourceServerName: string, sourceDatabaseName: string): string {
		let dataSourceKey = dataSourceName ? LocationHandler.peelOffBrackets(dataSourceName) : '_';
		let databaseKey = sourceDatabaseName ? LocationHandler.peelOffBrackets(sourceDatabaseName) : '_';
		let serverKey = sourceServerName ? LocationHandler.peelOffBrackets(sourceServerName) : '_';
		return `[${dataSourceKey}@${serverKey}@${databaseKey}]`;
	}

	public static getIdFromDataSourceBrowser(dataSourceBrowser: DataSourceBrowser): string {
		let dataSourceId: string = undefined;
		if (dataSourceBrowser && dataSourceBrowser.vdiManager) {
			let vdiManager = dataSourceBrowser.vdiManager;
			let dataSourceName: string = vdiManager.dataSourceName;
			let sourceDatabaseName: string = vdiManager.sourceDatabaseName;
			let sourceServerName: string = vdiManager.sourceServerName;
			dataSourceId = DataSourceId.getId(dataSourceName, sourceServerName, sourceDatabaseName);
		}
		return dataSourceId;
	}
}

class DatabaseTreeNode extends CheckboxTreeNode {
	private _dataSourceBrowser: DataSourceBrowser;
	private _databaseName: string;

	constructor(databaseName: string, dataSourceBrowser: DataSourceBrowser) {
		super();
		this._databaseName = databaseName || this._databaseName;
		if (this._databaseName) {
			let nodeId = LocationHandler.encloseWithBrackets(this._databaseName);
			super.setArgs({ nodeId: nodeId, label: this._databaseName });
		}
		this.setDataSourceBrowser(dataSourceBrowser);
	}

	public setDataSourceBrowser(dataSourceBrowser: DataSourceBrowser): void {
		if (dataSourceBrowser) {
			this._dataSourceBrowser = dataSourceBrowser || this._dataSourceBrowser;
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(this._dataSourceBrowser);
			super.setArgs({ treeId: treeId });
		}
	}

	public async getChildren(): Promise<CheckboxTreeNode[]> {
		if (!this.hasChildren && this._dataSourceBrowser && this._databaseName) {
			let tableFolderNode = TableFolderNode.getInstance(this._databaseName, this._dataSourceBrowser);
			let viewFolderNode = ViewFolderNode.getInstance(this._databaseName, this._dataSourceBrowser);
			if (this.checked) {
				await tableFolderNode.setCheckedState(true);
				await viewFolderNode.setCheckedState(true);
			}
			this.addChildNode(tableFolderNode);
			this.addChildNode(viewFolderNode);
			this.notifyStateChanged();
		}
		return this.children;
	}

	public get iconPath(): string {
		return PathResolver.databaseIconPath;
	}

	public static getInstance(databaseName: string, dataSourceBrowser: DataSourceBrowser): DatabaseTreeNode {
		let dbNode: DatabaseTreeNode = undefined;
		if (databaseName && dataSourceBrowser) {
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(dataSourceBrowser);
			if (treeId) {
				let nodeId = LocationHandler.encloseWithBrackets(databaseName);
				dbNode = CheckboxTreeNode.findNode(treeId, nodeId) as DatabaseTreeNode;
				if (!dbNode) {
					dbNode = new DatabaseTreeNode(databaseName, dataSourceBrowser);
				}
			}
		}
		return dbNode;
	}
}

class TableFolderNode extends CheckboxTreeNode {
	private _dataSourceBrowser: DataSourceBrowser;
	private _databaseName: string;

	constructor(databaseName: string, dataSourceBrowser: DataSourceBrowser) {
		super();
		this._databaseName = databaseName || this._databaseName;
		let nodeId: string = TableFolderNode.getNodeId(this._databaseName);
		let tableFolderLabel = localize('tableFolderLabel', 'Tables');
		super.setArgs({ nodeId: nodeId, label: tableFolderLabel });
		this.setDataSourceBrowser(dataSourceBrowser);
	}

	public setDataSourceBrowser(dataSourceBrowser: DataSourceBrowser): void {
		if (dataSourceBrowser) {
			this._dataSourceBrowser = dataSourceBrowser || this._dataSourceBrowser;
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(this._dataSourceBrowser);
			super.setArgs({ treeId: treeId });
		}
	}

	public async getChildren(): Promise<CheckboxTreeNode[]> {
		if (!this.hasChildren && this._dataSourceBrowser) {
			let result = await this._dataSourceBrowser.getTableNames(this._databaseName);
			let tableNames: string[] = result.returnValue;
			if (result.isSuccess && tableNames && tableNames.length > 0 && this._dataSourceBrowser.vdiManager) {
				let vdiManager = this._dataSourceBrowser.vdiManager;
				let dataSourceName: string = vdiManager.dataSourceName;
				let sourceDatabaseName: string = this._dataSourceBrowser.vdiManager.sourceDatabaseName;
				let sourceServerName: string = this._dataSourceBrowser.vdiManager.sourceServerName;
				for (let tableNameWithSchema of tableNames) {
					let location: string[] = LocationHandler.getLocation(`[${this._databaseName}].${tableNameWithSchema}`);
					let childNode = TableTreeNode.getInstance(dataSourceName, sourceServerName, sourceDatabaseName, location);
					if (childNode) {
						if (this.checked) {
							await childNode.setCheckedState(true);
						}
						this.addChildNode(childNode);
					}
				}
			}

			if (!this.hasChildren) {
				this.isLeaf = true;
				await this.setCheckedState(false);
				await this.setEnable(false);
			}

			this.notifyStateChanged();
		}

		this.children = this.children.sort((a, b) => a.label.localeCompare(b.label));
		return this.children;
	}

	public get iconPath(): { light: string; dark: string } {
		return {
			light: PathResolver.folderIconPath,
			dark: PathResolver.folderIconDarkPath
		};
	}

	private static getNodeId(databaseName: string): string {
		let nodeId: string = undefined;
		if (databaseName) {
			let databaseId: string = LocationHandler.encloseWithBrackets(databaseName);
			nodeId = `${databaseId}.[Tables]`;
		}
		return nodeId;
	}

	public static getInstance(databaseName: string, dataSourceBrowser: DataSourceBrowser): TableFolderNode {
		let tableFolderNode: TableFolderNode = undefined;
		if (databaseName && dataSourceBrowser) {
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(dataSourceBrowser);
			let nodeId = TableFolderNode.getNodeId(databaseName);
			tableFolderNode = CheckboxTreeNode.findNode(treeId, nodeId) as TableFolderNode;
			if (!tableFolderNode) {
				tableFolderNode = new TableFolderNode(databaseName, dataSourceBrowser);
			}
		}
		return tableFolderNode;
	}
}

class ViewFolderNode extends CheckboxTreeNode {
	private _dataSourceBrowser: DataSourceBrowser;
	private _databaseName: string;

	constructor(databaseName: string, dataSourceBrowser: DataSourceBrowser) {
		super();
		this._databaseName = databaseName || this._databaseName;
		let nodeId: string = ViewFolderNode.getNodeId(databaseName);
		let viewFolderLabel = localize('viewFolderLabel', 'Views');
		super.setArgs({ nodeId: nodeId, label: viewFolderLabel });
		this.setDataSourceBrowser(dataSourceBrowser);
	}

	public setDataSourceBrowser(dataSourceBrowser: DataSourceBrowser): void {
		if (dataSourceBrowser) {
			this._dataSourceBrowser = dataSourceBrowser || this._dataSourceBrowser;
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(this._dataSourceBrowser);
			super.setArgs({ treeId: treeId });
		}
	}

	public async getChildren(): Promise<CheckboxTreeNode[]> {
		if (!this.hasChildren && this._dataSourceBrowser) {
			let result = await this._dataSourceBrowser.getViewNameList(this._databaseName);
			let viewNames: string[] = result.returnValue;
			if (result.isSuccess && viewNames && viewNames.length > 0 && this._dataSourceBrowser.vdiManager) {
				let vdiManager = this._dataSourceBrowser.vdiManager;
				let dataSourceName: string = vdiManager.dataSourceName;
				let sourceDatabaseName: string = this._dataSourceBrowser.vdiManager.sourceDatabaseName;
				let sourceServerName: string = this._dataSourceBrowser.vdiManager.sourceServerName;

				for (let viewNameWithSchema of viewNames) {
					let location: string[] = LocationHandler.getLocation(`[${this._databaseName}].${viewNameWithSchema}`);
					let childNode = ViewTreeNode.getInstance(dataSourceName, sourceServerName, sourceDatabaseName, location);
					if (childNode) {
						if (this.checked) {
							childNode.setCheckedState(true);
						}
						this.addChildNode(childNode);
					}
				}
			}

			if (!this.hasChildren) {
				this.isLeaf = true;
				await this.setCheckedState(false);
				await this.setEnable(false);
			}

			this.notifyStateChanged();
		}

		this.children = this.children.sort((a, b) => a.label.localeCompare(b.label));
		return this.children;
	}

	public get iconPath(): { light: string; dark: string } {
		return {
			light: PathResolver.folderIconPath,
			dark: PathResolver.folderIconDarkPath
		};
	}

	private static getNodeId(databaseName: string): string {
		let nodeId: string = undefined;
		if (databaseName) {
			let databaseId: string = LocationHandler.encloseWithBrackets(databaseName);
			nodeId = `${databaseId}.[Views]`;
		}
		return nodeId;
	}

	public static getInstance(databaseName: string, dataSourceBrowser: DataSourceBrowser): ViewFolderNode {
		let viewFolderNode: ViewFolderNode = undefined;
		if (databaseName && dataSourceBrowser) {
			let treeId: string = DataSourceId.getIdFromDataSourceBrowser(dataSourceBrowser);
			let nodeId = ViewFolderNode.getNodeId(databaseName);
			viewFolderNode = CheckboxTreeNode.findNode(treeId, nodeId) as ViewFolderNode;
			if (!viewFolderNode) {
				viewFolderNode = new ViewFolderNode(databaseName, dataSourceBrowser);
			}
		}
		return viewFolderNode;
	}
}

class TableTreeNode extends CheckboxTreeNode {
	private static _tableNodeCache: { [treeId: string]: TableTreeNode[] } = {};
	private _location: string[];

	constructor(dataSourceName: string, sourceServerName: string, sourceDatabaseName: string, location: string[]) {
		super();
		this._location = location || this._location;
		const treeId: string = DataSourceId.getId(dataSourceName, sourceServerName, sourceDatabaseName);
		const nodeId: string = LocationHandler.getLocationString(this._location);
		const schema = LocationHandler.getSchemaName(this._location);
		const label: string = schema ?
			`${schema}.${LocationHandler.getTableName(this._location)}` :
			`${LocationHandler.getTableName(this._location)}`
			;
		super.setArgs({ treeId: treeId, nodeId: nodeId, label: label, maxLabelLength: 38, isLeaf: true });
		TableTreeNode.AddToCache(this);
	}

	public get location(): string[] {
		return this._location;
	}

	public getChildren(): Promise<CheckboxTreeNode[]> {
		return Promise.resolve([]);
	}

	public get iconPath(): string {
		return PathResolver.tableIconPath;
	}

	public static getInstance(dataSourceName: string, sourceServerName: string, sourceDatabaseName: string, location: string[]): TableTreeNode {
		let tableNode: TableTreeNode = undefined;
		if (dataSourceName && sourceServerName && location && location.length > 0) {
			let nodeId: string = LocationHandler.getLocationString(location);
			let treeId: string = DataSourceId.getId(dataSourceName, sourceServerName, sourceDatabaseName);
			tableNode = CheckboxTreeNode.findNode(treeId, nodeId) as TableTreeNode;
			if (!tableNode) {
				tableNode = new TableTreeNode(dataSourceName, sourceServerName, sourceDatabaseName, location);
			}
		}
		return tableNode;
	}

	public static clearTableNodeCache() {
		TableTreeNode._tableNodeCache = {};
	}

	private static AddToCache(node: TableTreeNode): void {
		if (node.treeId) {
			if (!TableTreeNode._tableNodeCache[node.treeId]) {
				TableTreeNode._tableNodeCache[node.treeId] = [];
			}
			TableTreeNode._tableNodeCache[node.treeId].push(node);
		}
	}

	public static getAllNodes(dataSourceName: string, sourceServerName: string, sourceDatabaseName: string): TableTreeNode[] {
		let allNodes: TableTreeNode[] = undefined;
		let treeId: string = DataSourceId.getId(dataSourceName, sourceServerName, sourceDatabaseName);
		if (treeId) {
			allNodes = TableTreeNode._tableNodeCache[treeId];
		}
		return allNodes;
	}
}

class ViewTreeNode extends TableTreeNode { }

class DataSourceBrowser {
	private _dbNameCache: { [dataSourceId: string]: string[] };
	private _tableNameCache: { [dbOrSchemaId: string]: string[] };
	private _viewNameCache: { [dbOrSchemaId: string]: string[] };
	private _columnDefCache: { [tableOrViewId: string]: ColumnDefinition[] };
	private _currentDataSourceId: string;

	constructor(private _dataModel: VirtualizeDataModel, private _vdiManager: VDIManager) {
		this.clearCache();
	}

	public clearCache(): void {
		this._dbNameCache = {};
		this._tableNameCache = {};
		this._viewNameCache = {};
		this._columnDefCache = {};
	}

	public get vdiManager(): VDIManager {
		return this._vdiManager;
	}

	private getDataSourceId(): string {
		this._currentDataSourceId = DataSourceId.getId(this._vdiManager.dataSourceName, this._vdiManager.sourceServerName, this._vdiManager.sourceDatabaseName);
		return this._currentDataSourceId;
	}

	private getDatabaseId(databaseName: string): string {
		if (!databaseName) {
			return undefined;
		}

		this._currentDataSourceId = this.getDataSourceId();
		if (!this._currentDataSourceId) {
			return undefined;
		}

		let databaseId: string = `${this._currentDataSourceId}.${LocationHandler.encloseWithBrackets(databaseName)}`;
		return databaseId;
	}

	private getSchemaId(databaseName: string, schemaName: string): string {
		if (!databaseName || !schemaName) {
			return undefined;
		}

		let databaseId: string = this.getDatabaseId(databaseName);
		if (!databaseId) {
			return undefined;
		}

		let schemaId: string = `${databaseId}.${LocationHandler.encloseWithBrackets(schemaName)}`;
		return schemaId;
	}

	private getTableId(location: string[]): string {
		if (!location || location.length === 0) {
			return undefined;
		}
		let dataSourceId = this.getDataSourceId();
		if (!dataSourceId) {
			return undefined;
		}

		let tableNameId: string = `${dataSourceId}.${LocationHandler.getLocationString(location)}`;
		return tableNameId;
	}

	public async getDatabaseNames(): Promise<string[]> {
		let dataSourceId: string = this.getDataSourceId();
		if (!dataSourceId) {
			return undefined;
		}

		if (!this._dbNameCache[dataSourceId] && this._vdiManager) {
			let inputValues: VirtualizeDataInput = this._vdiManager.inputUptoConnectionDetailsPage;
			let databasesResponse = await this._dataModel.getSourceDatabases(inputValues);
			this._dbNameCache[dataSourceId] = databasesResponse.databaseNames;
		}
		return this._dbNameCache[dataSourceId];
	}

	private async loadTableList(databaseName: string): Promise<ExecutionResult<void>> {
		if (!databaseName) {
			return;
		}

		let databaseId: string = this.getDatabaseId(databaseName);
		if (!databaseId) {
			return;
		}

		let result: ExecutionResult<void> = undefined;
		if (!this._tableNameCache[databaseId]) {
			let inputValues: VirtualizeDataInput = this._vdiManager.inputUptoConnectionDetailsPage;
			let tablesResponse = await this._dataModel.getSourceTables({
				sessionId: inputValues.sessionId,
				virtualizeDataInput: inputValues,
				sourceDatabaseName: databaseName
			});

			if (tablesResponse && tablesResponse.isSuccess) {
				let schemaTablesList: SchemaTables[] = tablesResponse.schemaTablesList;
				if (schemaTablesList && schemaTablesList.length > 0) {
					schemaTablesList.forEach(schemaTables => {
						let schemaName: string = schemaTables.schemaName;
						let tableNamesWithoutSchema: string[] = schemaTables.tableNames;
						if (tableNamesWithoutSchema && tableNamesWithoutSchema.length > 0) {
							let schemaId: string = `${databaseId}.[${schemaName}]`;
							let tableNameWithSchemaSet: Set<string> = new Set<string>(this._tableNameCache[databaseId] || []);
							let tableNameWithoutSchemaSet: Set<string> = new Set<string>(this._tableNameCache[schemaId] || []);
							tableNamesWithoutSchema.forEach(tableName => {
								const schemaPrefix = schemaName ? `[${schemaName}].` : '';
								tableNameWithSchemaSet.add(`${schemaPrefix}[${tableName}]`);
								tableNameWithoutSchemaSet.add(`[${tableName}]`);
							});
							this._tableNameCache[databaseId] = [...tableNameWithSchemaSet];
							this._tableNameCache[schemaId] = [...tableNameWithoutSchemaSet];
						}
					});
				}
				result = { isSuccess: true, errorMessages: undefined, returnValue: undefined };
			} else {
				result = { isSuccess: false, errorMessages: tablesResponse.errorMessages, returnValue: undefined };
			}
		} else {
			result = { isSuccess: true, errorMessages: undefined, returnValue: undefined };
		}

		return result;
	}

	private async loadViewList(databaseName: string): Promise<ExecutionResult<void>> {
		if (!databaseName) {
			return;
		}

		let databaseId: string = this.getDatabaseId(databaseName);
		if (!databaseId) {
			return;
		}

		let result: ExecutionResult<void> = undefined;
		if (!this._viewNameCache[databaseId]) {
			let inputValues: VirtualizeDataInput = this._vdiManager.inputUptoConnectionDetailsPage;
			let viewsResponse = await this._dataModel.getSourceViewList({
				virtualizeDataInput: inputValues,
				querySubject: databaseName
			});

			if (viewsResponse && viewsResponse.isSuccess) {
				let schemaViewsList: SchemaViews[] = viewsResponse.returnValue;
				if (schemaViewsList && schemaViewsList.length > 0) {
					schemaViewsList.forEach(schemaViews => {
						let schemaName: string = schemaViews.schemaName;
						let viewNamesWithoutSchema: string[] = schemaViews.viewNames;
						if (viewNamesWithoutSchema && viewNamesWithoutSchema.length > 0) {
							let schemaId: string = `${databaseId}.[${schemaName}]`;
							let viewNameWithSchemaSet: Set<string> = new Set<string>(this._viewNameCache[databaseId] || []);
							let viewNameWithoutSchemaSet: Set<string> = new Set<string>(this._viewNameCache[schemaId] || []);
							viewNamesWithoutSchema.forEach(viewName => {
								const schemaPrefix = schemaName ? `[${schemaName}].` : '';
								viewNameWithSchemaSet.add(`${schemaPrefix}[${viewName}]`);
								viewNameWithoutSchemaSet.add(`[${viewName}]`);
							});
							this._viewNameCache[databaseId] = [...viewNameWithSchemaSet];
							this._viewNameCache[schemaId] = [...viewNameWithoutSchemaSet];
						}
					});
				}
				result = { isSuccess: true, errorMessages: undefined, returnValue: undefined };
			} else {
				result = { isSuccess: false, errorMessages: viewsResponse.errorMessages, returnValue: undefined };
			}
		} else {
			result = { isSuccess: true, errorMessages: undefined, returnValue: undefined };
		}

		return result;
	}

	public async getTableNames(databaseNameWithoutSchema: string, schemaName?: string): Promise<ExecutionResult<string[]>> {
		if (!databaseNameWithoutSchema) {
			return undefined;
		}

		let databaseIdOrSchemaId: string = schemaName ?
			this.getSchemaId(databaseNameWithoutSchema, schemaName) :
			this.getDatabaseId(databaseNameWithoutSchema);
		if (!databaseIdOrSchemaId) {
			return undefined;
		}

		let result: ExecutionResult<string[]> = undefined;
		if (!this._tableNameCache[databaseIdOrSchemaId]) {
			let loadResult = await this.loadTableList(databaseNameWithoutSchema);
			if (loadResult.isSuccess) {
				let tableOrViewNames: string[] = this._tableNameCache[databaseIdOrSchemaId];
				result = { isSuccess: true, errorMessages: undefined, returnValue: tableOrViewNames };
			} else {
				result = { isSuccess: false, errorMessages: loadResult.errorMessages, returnValue: undefined };
			}
		} else {
			let tableOrViewNames: string[] = this._tableNameCache[databaseIdOrSchemaId];
			result = { isSuccess: true, errorMessages: undefined, returnValue: tableOrViewNames };
		}
		return result;
	}

	public async getViewNameList(databaseNameWithoutSchema: string, schemaName?: string): Promise<ExecutionResult<string[]>> {
		if (!databaseNameWithoutSchema) {
			return undefined;
		}

		let databaseIdOrSchemaId: string = schemaName ?
			this.getSchemaId(databaseNameWithoutSchema, schemaName) :
			this.getDatabaseId(databaseNameWithoutSchema);
		if (!databaseIdOrSchemaId) {
			return undefined;
		}

		let result: ExecutionResult<string[]> = undefined;
		if (!this._viewNameCache[databaseIdOrSchemaId]) {
			let loadResult = await this.loadViewList(databaseNameWithoutSchema);
			if (loadResult.isSuccess) {
				let tableOrViewNames: string[] = this._viewNameCache[databaseIdOrSchemaId];
				result = { isSuccess: true, errorMessages: undefined, returnValue: tableOrViewNames };
			} else {
				result = { isSuccess: false, errorMessages: loadResult.errorMessages, returnValue: undefined };
			}
		} else {
			let tableOrViewNames: string[] = this._viewNameCache[databaseIdOrSchemaId];
			result = { isSuccess: true, errorMessages: undefined, returnValue: tableOrViewNames };
		}
		return result;
	}

	public async getColumnDefinitions(location: string[]): Promise<ExecutionResult<ColumnDefinition[]>> {
		if (!location || location.length === 0) {
			return undefined;
		}

		let tableNameId: string = this.getTableId(location);
		if (!tableNameId) {
			return undefined;
		}

		let result: ExecutionResult<ColumnDefinition[]> = undefined;
		if (this._columnDefCache[tableNameId]) {
			result = { isSuccess: true, errorMessages: undefined, returnValue: this._columnDefCache[tableNameId] };
		} else if (this._vdiManager) {
			let inputValues: VirtualizeDataInput = this._vdiManager.inputUptoConnectionDetailsPage;
			result = await this._dataModel.getSourceColumnDefinitions({
				sessionId: inputValues.sessionId,
				virtualizeDataInput: inputValues,
				location: location
			});
			if (result.isSuccess) {
				this._columnDefCache[tableNameId] = result.returnValue;
			}
		} else {
			result = { isSuccess: false, errorMessages: undefined, returnValue: undefined };
		}
		return result;
	}
}

export class LocationHandler {
	public static isEnclosedWithBrackets(str: string): boolean {
		let isEnclosed: boolean = undefined;
		if (str) {
			isEnclosed = (/^\[(.+)\]$/g).test(str);
		}
		return isEnclosed;
	}

	public static encloseWithBrackets(str: string): string {
		let result: string = undefined;
		if (str) {
			result = LocationHandler.isEnclosedWithBrackets(str) ? str : `[${str}]`;
		}
		return result;
	}

	public static peelOffBrackets(locationString: string): string {
		let result: string;
		if (locationString) {
			let location: string[] = LocationHandler.getLocation(locationString);
			if (location && location.length > 0) {
				result = location.join('.');
			}
		}
		return result;
	}

	public static getLocationString(location: string[]): string {
		let locationString: string = undefined;
		if (location && location.length > 0) {
			locationString = location.map(e => LocationHandler.encloseWithBrackets(e)).join('.');
		}
		return locationString;
	}

	public static isLocationStrFormat(locationString: string): boolean {
		let isCorrect: boolean = undefined;
		if (locationString) {
			isCorrect = (/^\[.+\](\.\[.+\])*$/g).test(locationString);
		}
		return isCorrect;
	}

	public static getLocation(locationString: string): string[] {
		let location: string[] = undefined;
		if (locationString) {
			if (LocationHandler.isLocationStrFormat(locationString)) {
				if (!locationString.includes('].[')) {
					location = [locationString.substr(1, locationString.length - 2)];
				} else {
					location = locationString.substr(1, locationString.length - 2).split('].[');
				}
			} else {
				location = [locationString];
			}
		}
		return location;
	}

	public static getSchemaName(location: string[]): string {
		let schemaName: string = undefined;
		if (location && location.length >= 2) {
			schemaName = location[location.length - 2];
		}
		return schemaName;
	}

	public static getTableName(location: string[]): string {
		let tableName: string = undefined;
		if (location && location.length > 0) {
			tableName = location[location.length - 1];
		}
		return tableName;
	}
}

class MappingInfoCache {
	private _mappingInfoCache: { [dataSourceId: string]: Map<string, TableMappingInfo> };
	private _currentCache: Map<string, TableMappingInfo>;
	private _vdiManager: VDIManager;

	constructor(vdiManager: VDIManager) {
		this._mappingInfoCache = {};
		this._vdiManager = vdiManager;
	}

	private refreshCurrentCache(): void {
		if (this._vdiManager) {
			let dataSourceName: string = this._vdiManager.dataSourceName;
			let sourceDatabaseName: string = this._vdiManager.sourceDatabaseName;
			let sourceServerName: string = this._vdiManager.sourceServerName;
			let dataSourceId: string = DataSourceId.getId(dataSourceName, sourceServerName, sourceDatabaseName);
			if (dataSourceId) {
				if (!this._mappingInfoCache[dataSourceId]) {
					this._mappingInfoCache[dataSourceId] = new Map<string, TableMappingInfo>();
				}
				this._currentCache = this._mappingInfoCache[dataSourceId];
			}
		}
	}

	public putMappingInfo(desiredTableName: string[], location: string[], columnDefinitions: ColumnDefinition[], replaceExisting?: boolean): void {
		this.refreshCurrentCache();
		if (desiredTableName && desiredTableName.length >= 1 && desiredTableName.length <= 2 &&
			location && location.length > 0 && columnDefinitions && columnDefinitions.length > 0 && this._currentCache) {
			let cacheKey: string = this.getCacheKey(location);
			if (replaceExisting) {
				if (this._currentCache.has(cacheKey)) {
					this._currentCache.delete(cacheKey);
				}
				this._currentCache.set(cacheKey, new TableMappingInfo(desiredTableName, columnDefinitions, location));
			} else {
				if (!this._currentCache.has(cacheKey)) {
					this._currentCache.set(cacheKey, new TableMappingInfo(desiredTableName, columnDefinitions, location));
				}
			}
		}
	}

	private getCacheKey(location: string[]): string {
		return LocationHandler.getLocationString(location);
	}

	public hasMappingInfo(location: string[]): boolean {
		this.refreshCurrentCache();
		let key: string = this.getCacheKey(location);
		return location && this._currentCache && key ? this._currentCache.has(key) : undefined;
	}

	public getMappingInfo(location: string[]): TableMappingInfo {
		this.refreshCurrentCache();
		let modifiedInfo: TableMappingInfo = undefined;
		if (this.hasMappingInfo(location)) {
			modifiedInfo = this._currentCache.get(this.getCacheKey(location));
		}
		return modifiedInfo;
	}
}

class TableMappingInfo implements ExternalTableInfo {
	public externalTableName: string[];
	public columnDefinitionList: ColumnDefinition[];
	public sourceTableLocation: string[];
	public fileFormat?: FileFormat;

	constructor(externalTableName: string[], columnDefinitionList: ColumnDefinition[], sourceTableLocation: string[]) {
		this.externalTableName = externalTableName;
		this.columnDefinitionList = columnDefinitionList;
		this.sourceTableLocation = sourceTableLocation;
	}
}

class MappingInfoRetriever {
	private _dataSourceBrowser: DataSourceBrowser;
	private _mappingInfoCache: MappingInfoCache;
	private _virtualizeDataModel: VirtualizeDataModel;

	constructor(dataSourceBrowser: DataSourceBrowser, mappingInfoCache: MappingInfoCache, virtualizeDataModel: VirtualizeDataModel) {
		this._dataSourceBrowser = dataSourceBrowser;
		this._mappingInfoCache = mappingInfoCache;
		this._virtualizeDataModel = virtualizeDataModel;
	}

	public async getMappingInfo(location: string[]): Promise<ExecutionResult<TableMappingInfo>> {
		let result: ExecutionResult<TableMappingInfo> = null;
		if (location && this._mappingInfoCache) {
			if (this._mappingInfoCache.hasMappingInfo(location)) {
				let mappingInfo: TableMappingInfo = this._mappingInfoCache.getMappingInfo(location);
				result = { isSuccess: true, errorMessages: undefined, returnValue: mappingInfo };
			} else if (this._dataSourceBrowser) {
				let colDefResult: ExecutionResult<ColumnDefinition[]> = await this._dataSourceBrowser.getColumnDefinitions(location);
				if (colDefResult) {
					if (colDefResult.isSuccess && colDefResult.returnValue && colDefResult.returnValue.length > 0) {
						let tableNameWithoutSchema: string = LocationHandler.getTableName(location);
						const schemaName = LocationHandler.getSchemaName(location);
						let colDefs: ColumnDefinition[] = colDefResult.returnValue;
						this._mappingInfoCache.putMappingInfo([schemaName, tableNameWithoutSchema], location, colDefs);
						let mappingInfo: TableMappingInfo = this._mappingInfoCache.getMappingInfo(location);
						result = { isSuccess: true, errorMessages: undefined, returnValue: mappingInfo };
					} else {
						result = { isSuccess: false, errorMessages: colDefResult.errorMessages, returnValue: undefined };
					}
				} else {
					result = { isSuccess: false, errorMessages: undefined, returnValue: undefined };
				}
			}
		}
		return result;
	}
}

class PathResolver {
	private static _appContext: AppContext;
	private static _absolutePaths: { [target: string]: string } = {};

	public static initialize(appContext: AppContext): void {
		PathResolver.appContext = appContext;
	}

	public static set appContext(appContext: AppContext) {
		PathResolver._appContext = appContext;
		PathResolver.setAbsoluteIconPath('databaseIconPath', path.join('resources', 'light', 'database_OE.svg'));
		PathResolver.setAbsoluteIconPath('tableIconPath', path.join('resources', 'light', 'table.svg'));
		PathResolver.setAbsoluteIconPath('folderIconPath', path.join('resources', 'light', 'Folder.svg'));
		PathResolver.setAbsoluteIconPath('folderIconDarkPath', path.join('resources', 'dark', 'folder_inverse.svg'));
	}

	private static setAbsoluteIconPath(target: string, relativePath: string): void {
		PathResolver._absolutePaths[target] = this._appContext.extensionContext.asAbsolutePath(relativePath);
	}

	public static get databaseIconPath(): string { return PathResolver._absolutePaths['databaseIconPath']; }
	public static get tableIconPath(): string { return PathResolver._absolutePaths['tableIconPath']; }
	public static get folderIconPath(): string { return PathResolver._absolutePaths['folderIconPath']; }
	public static get folderIconDarkPath(): string { return PathResolver._absolutePaths['folderIconDarkPath']; }
}

class TitledContainer {
	private _modelBuilder: azdata.ModelBuilder;

	private _titleTopMargin: number;
	private _titleBottomMargin: number;
	public titleFontSize: number;
	public title: string;
	public titleRightMargin: number;
	public titleLeftMargin: number;

	private _contentContainers: azdata.FlexContainer[];
	private _fullContainer: azdata.FlexContainer;

	public topPaddingPx: number;
	public rightPaddingPx: number;
	public bottomPaddingPx: number;
	public leftPaddingPx: number;

	private static readonly _pBeforePx: number = 16;
	private static readonly _pAfterPx: number = 16;

	constructor(modelBuilder: azdata.ModelBuilder) {
		this._modelBuilder = modelBuilder;
		this._contentContainers = [];

		this.titleFontSize = 14;
		this.setTitleMargin(0, 0, 5, 0);
		this.setPadding(10, 30, 0, 30);
	}

	public set titleTopMargin(px: number) {
		this._titleTopMargin = px - TitledContainer._pBeforePx;
	}

	public set titleBottomMargin(px: number) {
		this._titleBottomMargin = px - TitledContainer._pAfterPx;
	}

	public setTitleMargin(topPx: number, rightPx: number, bottomPx: number, leftPx: number) {
		this.titleTopMargin = topPx;
		this.titleRightMargin = rightPx;
		this.titleBottomMargin = bottomPx;
		this.titleLeftMargin = leftPx;
	}

	public setPadding(topPx: number, rightPx: number, bottomPx: number, leftPx: number) {
		this.topPaddingPx = topPx;
		this.rightPaddingPx = rightPx;
		this.bottomPaddingPx = bottomPx;
		this.leftPaddingPx = leftPx;
	}

	public addContentContainer(content: azdata.FlexContainer) {
		this._contentContainers.push(content);
	}

	public get flexContainer(): azdata.FlexContainer {
		let titleContainer: azdata.FlexContainer = undefined;
		if (this.title) {
			let titleTextComponent = this._modelBuilder.text()
				.withProps({ value: this.title })
				.component();
			titleContainer = this._modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column',
					alignItems: 'start',
					width: '100%'
				})
				.component();
			titleContainer.addItem(titleTextComponent, {
				flex: '1, 1, 0%',
				CSSStyles: {
					'font-size': `${this.titleFontSize}px`,
					'width': '100%',
					'margin': `${this._titleTopMargin}px ${this.titleRightMargin}px ${this._titleBottomMargin}px ${this.titleLeftMargin}px`
				}
			});
		}

		let bindingContainer = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				alignItems: 'stretch',
				width: '100%'
			})
			.component();
		if (titleContainer) {
			bindingContainer.addItem(titleContainer, {
				flex: '1, 1, 0%',
				CSSStyles: {
					'width': '100%'
				}
			});
		}
		for (let content of this._contentContainers) {
			bindingContainer.addItem(content, {
				flex: '1, 1, 0%',
				CSSStyles: {
					'width': '100%'
				}
			});
		}

		if (!this._fullContainer) {
			this._fullContainer = this._modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column',
					alignItems: 'stretch',
					width: '100%'
				})
				.component();
		} else {
			this._fullContainer.clearItems();
		}

		this._fullContainer.addItem(bindingContainer, {
			flex: '1, 1, 0%',
			CSSStyles: {
				'padding': `${this.topPaddingPx}px ${this.rightPaddingPx}px ${this.bottomPaddingPx}px ${this.leftPaddingPx}px`
			}
		});

		return this._fullContainer;
	}
}
