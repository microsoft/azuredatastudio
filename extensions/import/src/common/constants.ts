/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const extensionConfigSectionName = 'flatFileImport';
export const serviceName = 'Flat File Import Service';
export const providerId = 'FlatFileImport';
export const configLogDebugInfo = 'logDebugInfo';
export const sqlConfigSectionName = 'sql';
export const mssqlProvider = 'MSSQL';

export const summaryErrorSymbol = '✗ ';

export const supportedProviders = [mssqlProvider];

// Links
export const serviceCrashLink = 'https://github.com/Microsoft/azuredatastudio/issues/2090';

// Tasks
export const flatFileImportStartCommand = 'flatFileImport.start';

// Localized texts
export const crashButtonText = localize('import.serviceCrashButton', "Give Feedback");
export const serviceCrashMessageText = localize('serviceCrashMessage', "service component could not start");
export const serverDropDownTitleText = localize('flatFileImport.serverDropdownTitle', "Server the database is in");
export const databaseDropdownTitleText = localize('flatFileImport.databaseDropdownTitle', "Database the table is created in");
export const browseFilesText = localize('flatFileImport.browseFiles', "Browse");
export const openFileText = localize('flatFileImport.openFile', "Open");
export const fileTextboxTitleText = localize('flatFileImport.fileTextboxTitle', "Location of the file to be imported");
export const tableTextboxTitleText = localize('flatFileImport.tableTextboxTitle', "New table name");
export const schemaTextboxTitleText = localize('flatFileImport.schemaTextboxTitle', "Table schema");
export const importDataText = localize('flatFileImport.importData', "Import Data");
export const nextText = localize('flatFileImport.next', "Next");
export const columnNameText = localize('flatFileImport.columnName', "Column Name");
export const dataTypeText = localize('flatFileImport.dataType', "Data Type");
export const primaryKeyText = localize('flatFileImport.primaryKey', "Primary Key");
export const allowNullsText = localize('flatFileImport.allowNulls', "Allow Nulls");
export const successTitleText = localize('flatFileImport.prosePreviewMessage', "This operation analyzed the input file structure to generate the preview below for up to the first 50 rows.");
export const failureTitleText = localize('flatFileImport.prosePreviewMessageFail', "This operation was unsuccessful. Please try a different input file.");
export const refreshText = localize('flatFileImport.refresh', "Refresh");
export const importInformationText = localize('flatFileImport.importInformation', "Import information");
export const importStatusText = localize('flatFileImport.importStatus', "Import status");
export const serverNameText = localize('flatFileImport.serverName', "Server name");
export const databaseText = localize('flatFileImport.databaseName', "Database name");
export const tableNameText = localize('flatFileImport.tableName', "Table name");
export const tableSchemaText = localize('flatFileImport.tableSchema', "Table schema");
export const fileImportText = localize('flatFileImport.fileImport', "File to be imported");
export const updateText = localize('flatFileImport.success.norows', "✔ You have successfully inserted the data into a table.");
export const needConnectionText = localize('import.needConnection', "Please connect to a server before using this wizard.");
export const needSqlConnectionText = localize('import.needSQLConnection', "SQL Server Import extension does not support this type of connection");
export const wizardNameText = localize('flatFileImport.wizardName', "Import flat file wizard");
export const page1NameText = localize('flatFileImport.page1Name', "Specify Input File");
export const page2NameText = localize('flatFileImport.page2Name', "Preview Data");
export const page3NameText = localize('flatFileImport.page3Name', "Modify Columns");
export const page4NameText = localize('flatFileImport.page4Name', "Summary");
export const importNewFileText = localize('flatFileImport.importNewFile', "Import new file");

// SQL Queries
export const selectSchemaQuery = `SELECT name FROM sys.schemas`;
