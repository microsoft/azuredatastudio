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

// allow-any-unicode-next-line
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
export const invalidFileLocationError = localize('flatFile.InvalidFileLocation', "Invalid file location. Please try a different input file");
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
export const createDerivedColumn = localize('flatFileImport.createDerivedColumn', "Create derived column");
export const specifyDerivedColNameTitle = localize('flatFileImport.specifyDerivedColNameTitle', "Column Name");
export const specifyTransformation = localize('flatFileImport.specifyTransformation', "Specify Transformation");
export const previewTransformation = localize('flatFileImport.previewTransformation', "Preview Transformation");
export const columnTableTitle = localize('flatFileImport.columnTableTitle', "Column");
export const headerIntructionText = localize('flatFileImport.headerIntructionText', "Welcome to the Derived Column Tool! To get started, please follow the steps below:");
export const deriverColumnInstruction1 = localize('flatFileImport.deriverColumnInstruction1', "Select the columns of data on the left required to derive your new column");
export const deriverColumnInstruction2 = localize('flatFileImport.deriverColumnInstruction2', "Select a row and specify an example transformation that you would like applied to the rest of the column");
export const deriverColumnInstruction3 = localize('flatFileImport.deriverColumnInstruction3', "Click \"Preview Transformation\" to preview the transformation");
export const deriverColumnInstruction4 = localize('flatFileImport.deriverColumnInstruction4', "Refine your transformation until you have the desired column");
export const deriverColumnInstruction5 = localize('flatFileImport.deriverColumnInstruction5', "Specify the new derived column\'s name and click \"Done\"");
export const selectAllColumns = localize('flatFileImport.selectAllColumns', "Select all columns");
export function specifyTransformationForRow(rowIndex: number): string {
	return localize('flatFileImport.specifyTransformationForRow', "Specify transformation for row {0}", rowIndex);
}
export function selectColumn(colName: string): string {
	return localize('flatFileImport.selectColumn', "Select column {0}", colName);
}
// SQL Queries
export const selectSchemaQuery = `SELECT name FROM sys.schemas`;
