/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as url from 'url';

import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { TableFromFileWizard } from '../tableFromFileWizard';
import { DataSourceWizardService, DatabaseInfo } from '../../../services/contracts';
import { getDropdownValue, getErrorMessage, stripUrlPathSlashes } from '../../../utils';
import { ctp24Version, sql2019MajorVersion, ctp25Version, ctp3Version } from '../../../constants';

const localize = nls.loadMessageBundle();

export class FileConfigPageUiElements {
	public fileTextBox: azdata.TextComponent;
	public serverTextBox: azdata.TextComponent;
	public databaseDropdown: azdata.DropDownComponent;
	public dataSourceDropdown: azdata.DropDownComponent;
	public tableNameTextBox: azdata.InputBoxComponent;
	public schemaDropdown: azdata.DropDownComponent;
	public databaseLoader: azdata.LoadingComponent;
	public dataSourceLoader: azdata.LoadingComponent;
	public schemaLoader: azdata.LoadingComponent;
	public fileFormatNameTextBox: azdata.InputBoxComponent;
	public refreshButton: azdata.ButtonComponent;
}

export class FileConfigPage extends ImportPage {
	private ui: FileConfigPageUiElements;
	public form: azdata.FormContainer;

	private readonly noDataSourcesError = localize('tableFromFileImport.noDataSources', 'No valid external data sources were found in the specified database.');
	private readonly noSchemasError = localize('tableFromFileImport.noSchemas', 'No user schemas were found in the specified database.');
	private readonly tableExistsError = localize('tableFromFileImport.tableExists', 'The specified table name already exists under the specified schema.');
	private readonly fileFormatExistsError = localize('tableFromFileImport.fileFormatExists', 'The specified external file format name already exists.');

	private pageSetupComplete: boolean = false;

	private existingTableSet: Set<string>;
	private existingFileFormatSet: Set<string>;
	private existingSchemaSet: Set<string>;

	public constructor(instance: TableFromFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: DataSourceWizardService) {
		super(instance, wizardPage, model, view, provider);
	}

	public setUi(ui: FileConfigPageUiElements) {
		this.ui = ui;
	}

	async start(): Promise<boolean> {
		this.ui = new FileConfigPageUiElements();
		let fileNameComponent = this.createFileTextBox();
		let serverNameComponent = this.createServerTextBox();
		let databaseComponent = this.createDatabaseDropdown();
		let dataSourceComponent = this.createDataSourceDropdown();
		let tableNameComponent = this.createTableNameBox();
		let schemaComponent = this.createSchemaDropdown();
		let fileFormatNameComponent = this.createFileFormatNameBox();
		let refreshButton = this.createRefreshButton();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems([
				fileNameComponent,
				serverNameComponent,
				databaseComponent,
				dataSourceComponent,
				tableNameComponent,
				schemaComponent,
				fileFormatNameComponent,
				refreshButton
			]).component();

		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<void> {
		if (!this.pageSetupComplete) {
			this.instance.clearStatusMessage();
			this.toggleInputsEnabled(false, true);
			try {
				this.parseFileInfo();

				await this.createSession();

				await this.populateDatabaseDropdown();
				await this.populateDatabaseInfo();
			} finally {
				this.toggleInputsEnabled(true, true);
			}
			this.pageSetupComplete = true;
		}
	}

	async onPageLeave(clickedNext: boolean): Promise<boolean> {
		if (this.ui.schemaLoader.loading ||
			this.ui.databaseLoader.loading ||
			this.ui.dataSourceLoader.loading ||
			!this.ui.refreshButton.enabled) {
			return false;
		}

		if (clickedNext) {
			if ((this.model.newSchema === undefined || this.model.newSchema === '') &&
				(this.model.existingSchema === undefined || this.model.existingSchema === '')) {
				return false;
			}

			if (!this.model.newDataSource &&
				(this.model.existingDataSource === undefined || this.model.existingDataSource === '')) {
				return false;
			}

			if (this.model.existingSchema && this.model.existingSchema !== '' &&
				this.existingTableSet && this.existingTableSet.has(this.model.existingSchema + '.' + this.model.table)) {
				this.instance.showErrorMessage(this.tableExistsError);
				return false;
			}

			if (this.existingFileFormatSet && this.existingFileFormatSet.has(this.model.fileFormat)) {
				this.instance.showErrorMessage(this.fileFormatExistsError);
				return false;
			}
		}

		return true;
	}

	private async createSession(): Promise<void> {
		try {
			this.ui.serverTextBox.value = this.model.serverConn.serverName;

			if (this.model.sessionId) {
				await this.provider.disposeWizardSession(this.model.sessionId);
				delete this.model.sessionId;
				delete this.model.allDatabases;
				delete this.model.versionInfo;
			}

			let sessionResponse = await this.provider.createDataSourceWizardSession(this.model.serverConn);

			this.model.sessionId = sessionResponse.sessionId;
			this.model.allDatabases = sessionResponse.databaseList.map(db => db.name);
			this.model.versionInfo = {
				serverMajorVersion: sessionResponse.serverMajorVersion,
				productLevel: sessionResponse.productLevel
			};
		} catch (err) {
			this.instance.showErrorMessage(getErrorMessage(err));
		}
	}

	private createDatabaseDropdown(): azdata.FormComponent {
		this.ui.databaseDropdown = this.view.modelBuilder.dropDown().withProps({
			values: [''],
			value: undefined
		}).component();

		// Handle database changes
		this.ui.databaseDropdown.onValueChanged(async (db) => {
			this.model.database = getDropdownValue(this.ui.databaseDropdown.value);

			this.instance.clearStatusMessage();
			this.toggleInputsEnabled(false, false);
			try {
				await this.populateDatabaseInfo();
			} finally {
				this.toggleInputsEnabled(true, false);
			}
		});

		this.ui.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.ui.databaseDropdown).component();

		return {
			component: this.ui.databaseLoader,
			title: localize('tableFromFileImport.databaseDropdownTitle', 'Database the external table will be created in')
		};
	}

	private async populateDatabaseDropdown(): Promise<boolean> {
		let idx = -1;
		let count = -1;
		let dbNames = this.model.allDatabases.map(dbName => {
			count++;
			if (this.model.database && dbName === this.model.database) {
				idx = count;
			}

			return dbName;
		});

		if (idx >= 0) {
			let tmp = dbNames[0];
			dbNames[0] = dbNames[idx];
			dbNames[idx] = tmp;
		}

		this.model.database = dbNames[0];

		this.ui.databaseDropdown.updateProperties({
			values: dbNames,
			value: dbNames[0]
		});
		return true;
	}

	private createDataSourceDropdown(): azdata.FormComponent {
		this.ui.dataSourceDropdown = this.view.modelBuilder.dropDown().withProps({
			values: [''],
			value: undefined
		}).component();

		this.ui.dataSourceDropdown.onValueChanged(async (db) => {
			if (!this.model.newDataSource) {
				this.model.existingDataSource = getDropdownValue(this.ui.dataSourceDropdown.value);
			}
		});

		this.ui.dataSourceLoader = this.view.modelBuilder.loadingComponent().withItem(this.ui.dataSourceDropdown).component();

		return {
			component: this.ui.dataSourceLoader,
			title: localize('tableFromFileImport.dataSourceDropdown', 'External data source for new external table')
		};
	}

	private populateDataSourceDropdown(dbInfo: DatabaseInfo): boolean {
		let errorCleanup = (errorMsg: string = this.noDataSourcesError) => {
			this.ui.dataSourceDropdown.updateProperties({ values: [''], value: undefined });
			this.instance.showErrorMessage(errorMsg);
			this.model.existingDataSource = undefined;
			this.model.newDataSource = undefined;
		};
		if (!dbInfo || !dbInfo.externalDataSources) {
			errorCleanup();
			return false;
		}

		let expectedDataSourceHost: string;
		let expectedDataSourcePort: string;
		let expectedDataSourcePath = '';
		let majorVersion = this.model.versionInfo.serverMajorVersion;
		let productLevel = this.model.versionInfo.productLevel;

		if (majorVersion === sql2019MajorVersion && productLevel === ctp24Version) {
			expectedDataSourceHost = 'service-master-pool';
			expectedDataSourcePort = '50070';
		} else if (majorVersion === sql2019MajorVersion && productLevel === ctp25Version) {
			expectedDataSourceHost = 'nmnode-0-svc';
			expectedDataSourcePort = '50070';
		} else if (majorVersion === sql2019MajorVersion && productLevel === ctp3Version) {
			expectedDataSourceHost = 'controller-svc';
			expectedDataSourcePort = '8080';
			expectedDataSourcePath = 'default';
		} else { // Default: SQL 2019 CTP 3.1 syntax
			expectedDataSourceHost = 'controller-svc';
			expectedDataSourcePort = null;
			expectedDataSourcePath = 'default';
		}

		let filteredSources = dbInfo.externalDataSources.filter(dataSource => {
			if (!dataSource.location) {
				return false;
			}

			let locationUrl = url.parse(dataSource.location);
			let pathName = stripUrlPathSlashes(locationUrl.pathname);
			return locationUrl.protocol === 'sqlhdfs:'
				&& locationUrl.hostname === expectedDataSourceHost
				&& locationUrl.port === expectedDataSourcePort
				&& pathName === expectedDataSourcePath;
		});
		if (filteredSources.length === 0) {
			let sourceName = 'SqlStoragePool';
			let nameSuffix = 0;
			let existingNames = new Set<string>(dbInfo.externalDataSources.map(dataSource => dataSource.name));
			while (existingNames.has(sourceName)) {
				sourceName = `SqlStoragePool${++nameSuffix}`;
			}

			let storageLocation: string;
			if (expectedDataSourcePort !== null) {
				storageLocation = `sqlhdfs://${expectedDataSourceHost}:${expectedDataSourcePort}/${expectedDataSourcePath}`;
			} else {
				storageLocation = `sqlhdfs://${expectedDataSourceHost}/${expectedDataSourcePath}`;
			}
			this.model.newDataSource = {
				name: sourceName,
				location: storageLocation,
				authenticationType: undefined,
				username: undefined,
				credentialName: undefined
			};
			filteredSources.unshift(this.model.newDataSource);
		} else {
			this.model.newDataSource = undefined;
		}

		let idx = -1;
		let count = -1;
		let dataSourceNames = filteredSources.map(dataSource => {
			let sourceName = dataSource.name;
			count++;
			if ((this.model.existingDataSource && sourceName === this.model.existingDataSource) ||
				(this.model.newDataSource && sourceName === this.model.newDataSource.name)) {
				idx = count;
			}

			return sourceName;
		});

		if (idx >= 0) {
			let tmp = dataSourceNames[0];
			dataSourceNames[0] = dataSourceNames[idx];
			dataSourceNames[idx] = tmp;
		}

		if (this.model.newDataSource) {
			this.model.existingDataSource = undefined;
		} else {
			this.model.existingDataSource = dataSourceNames[0];
		}

		this.ui.dataSourceDropdown.updateProperties({
			values: dataSourceNames,
			value: dataSourceNames[0]
		});

		return true;
	}

	private createFileTextBox(): azdata.FormComponent {
		this.ui.fileTextBox = this.view.modelBuilder.text().component();
		let title = this.model.parentFile.isFolder
			? localize('tableFromFileImport.folderTextboxTitle', 'Source Folder')
			: localize('tableFromFileImport.fileTextboxTitle', 'Source File');
		return {
			component: this.ui.fileTextBox,
			title: title
		};
	}

	private createServerTextBox(): azdata.FormComponent {
		this.ui.serverTextBox = this.view.modelBuilder.text().component();
		return {
			component: this.ui.serverTextBox,
			title: localize('tableFromFileImport.destConnTitle', 'Destination Server')
		};
	}

	private parseFileInfo(): void {
		let parentFilePath = this.model.parentFile.filePath;
		this.ui.fileTextBox.value = parentFilePath;

		let parsingFileExtension = path.extname(this.model.proseParsingFile.hdfsPath);
		if (parsingFileExtension.toLowerCase() === '.json') {
			this.model.fileType = 'JSON';
		} else {
			this.model.fileType = 'TXT';
		}

		let parentBaseName = path.basename(parentFilePath, parsingFileExtension);

		this.ui.tableNameTextBox.value = parentBaseName;
		this.model.table = this.ui.tableNameTextBox.value;
		this.ui.tableNameTextBox.validate();

		this.ui.fileFormatNameTextBox.value = `FileFormat_${parentBaseName}`;
		this.model.fileFormat = this.ui.fileFormatNameTextBox.value;
		this.ui.fileFormatNameTextBox.validate();
	}

	private createTableNameBox(): azdata.FormComponent {
		this.ui.tableNameTextBox = this.view.modelBuilder.inputBox()
			.withValidation((name) => {
				let tableName = name.value;
				if (!tableName || tableName.length === 0) {
					return false;
				}
				return true;
			}).withProperties({
				required: true,
			}).component();

		this.ui.tableNameTextBox.onTextChanged((tableName) => {
			this.model.table = tableName;
		});

		return {
			component: this.ui.tableNameTextBox,
			title: localize('tableFromFileImport.tableTextboxTitle', 'Name for new external table '),
		};
	}

	private createFileFormatNameBox(): azdata.FormComponent {
		this.ui.fileFormatNameTextBox = this.view.modelBuilder.inputBox()
			.withValidation((name) => {
				let fileFormat = name.value;
				if (!fileFormat || fileFormat.length === 0) {
					return false;
				}
				return true;
			}).withProperties({
				required: true,
			}).component();

		this.ui.fileFormatNameTextBox.onTextChanged((fileFormat) => {
			this.model.fileFormat = fileFormat;
		});

		return {
			component: this.ui.fileFormatNameTextBox,
			title: localize('tableFromFileImport.fileFormatTextboxTitle', 'Name for new table\'s external file format'),
		};
	}

	private createSchemaDropdown(): azdata.FormComponent {
		this.ui.schemaDropdown = this.view.modelBuilder.dropDown().withProps({
			values: [''],
			value: undefined,
			editable: true,
			fireOnTextChange: true
		}).component();
		this.ui.schemaLoader = this.view.modelBuilder.loadingComponent().withItem(this.ui.schemaDropdown).component();

		this.ui.schemaDropdown.onValueChanged(() => {
			let schema = getDropdownValue(this.ui.schemaDropdown.value);
			if (this.existingSchemaSet.has(schema)) {
				this.model.newSchema = undefined;
				this.model.existingSchema = schema;
			} else {
				this.model.newSchema = schema;
				this.model.existingSchema = undefined;
			}
		});

		return {
			component: this.ui.schemaLoader,
			title: localize('tableFromFileImport.schemaTextboxTitle', 'Schema for new external table'),
		};
	}

	private populateSchemaDropdown(dbInfo: DatabaseInfo): boolean {
		if (!dbInfo || !dbInfo.schemaList || dbInfo.schemaList.length === 0) {
			this.ui.schemaDropdown.updateProperties({ values: [''], value: undefined });

			this.instance.showErrorMessage(this.noSchemasError);
			this.model.newSchema = undefined;
			this.model.existingSchema = undefined;
			return false;
		}

		this.model.newSchema = undefined;
		if (!this.model.existingSchema) {
			this.model.existingSchema = dbInfo.defaultSchema;
		}

		let idx = -1;
		let count = -1;

		let values = dbInfo.schemaList.map(schema => {
			count++;
			if (this.model.existingSchema && schema === this.model.existingSchema) {
				idx = count;
			}
			return schema;
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		} else {
			// Default schema wasn't in the list, so take the first one instead
			this.model.existingSchema = values[0];
		}

		this.ui.schemaDropdown.updateProperties({
			values: values,
			value: values[0]
		});

		return true;
	}

	private async refreshPage(): Promise<void> {
		this.pageSetupComplete = false;
		await this.onPageEnter();
	}

	private createRefreshButton(): azdata.FormComponent {
		this.ui.refreshButton = this.view.modelBuilder.button().withProps({
			label: localize('tableFromFileImport.refreshButtonTitle', 'Refresh')
		}).component();

		this.ui.refreshButton.onDidClick(async () => await this.refreshPage());

		return {
			component: this.ui.refreshButton,
			title: undefined
		};
	}

	private async populateDatabaseInfo(): Promise<boolean> {
		try {
			let dbInfo: DatabaseInfo = undefined;
			let dbInfoResponse = await this.provider.getDatabaseInfo({ sessionId: this.model.sessionId, databaseName: this.model.database });
			if (!dbInfoResponse.isSuccess) {
				this.instance.showErrorMessage(dbInfoResponse.errorMessages.join('\n'));
				this.existingTableSet = undefined;
				this.existingFileFormatSet = undefined;
				this.existingSchemaSet = undefined;
			} else {
				dbInfo = dbInfoResponse.databaseInfo;
				this.existingTableSet = new Set<string>(dbInfo.externalTables.map(table => table.schemaName + '.' + table.tableName));
				this.existingFileFormatSet = new Set<string>(dbInfo.externalFileFormats);
				this.existingSchemaSet = new Set<string>(dbInfo.schemaList);
			}

			let r1 = this.populateDataSourceDropdown(dbInfo);
			let r2 = this.populateSchemaDropdown(dbInfo);
			return r1 && r2;
		} catch (err) {
			this.instance.showErrorMessage(getErrorMessage(err));
		}
	}

	private toggleInputsEnabled(enable: boolean, includeDbLoader: boolean) {
		if (includeDbLoader) {
			this.ui.databaseLoader.loading = !enable;
		}

		this.ui.databaseDropdown.enabled = enable;
		this.ui.refreshButton.enabled = enable;
		this.ui.dataSourceDropdown.enabled = enable;
		this.ui.schemaDropdown.enabled = enable;

		this.ui.dataSourceLoader.loading = !enable;
		this.ui.schemaLoader.loading = !enable;
	}
}
