/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

// Placeholder values
export const dataSourcesFileName = 'datasources.json';

// UI Strings

export const noOpenProjectMessage = localize('noProjectOpenMessage', "No open database project");
export const projectNodeName = localize('projectNodeName', "Database Project");
export const dataSourcesNodeName = localize('dataSourcesNodeName', "Data Sources");
export const sqlConnectionStringFriendly = localize('sqlConnectionStringFriendly', "SQL connection string");

// Error messages

export const multipleSqlProjFiles = localize('multipleSqlProjFilesSelected', "Multiple .sqlproj files selected; please select only one.");
export const noSqlProjFiles = localize('noSqlProjFilesSelected', "No .sqlproj file selected; please select one.");
export const noDataSourcesFile = localize('noDataSourcesFile', "No {0} found", dataSourcesFileName);
export const missingVersion = localize('missingVersion', "Missing 'version' entry in {0}", dataSourcesFileName);
export const unrecognizedDataSourcesVersion = localize('unrecognizedDataSourcesVersion', "Unrecognized version: ");
export const unknownDataSourceType = localize('unknownDataSourceType', "Unknown data source type: ");
export const invalidSqlConnectionString = localize('invalidSqlConnectionString', "Invalid SQL connection string");
