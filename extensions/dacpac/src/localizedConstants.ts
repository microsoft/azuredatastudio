/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// Labels
export const targetServer = localize('dacFx.targetServer', "Target Server");
export const sourceServer = localize('dacFx.sourceServer', "Source Server");
export const sourceDatabase = localize('dacFx.sourceDatabase', "Source Database");
export const targetDatabase = localize('dacFx.targetDatabase', "Target Database");
export const fileLocation = localize('dacfx.fileLocation', "File Location");
export const selectFile = localize('dacfx.selectFile', "Select file");
export const summaryTableTitle = localize('dacfx.summaryTableTitle', "Summary of settings");
export const version = localize('dacfx.version', "Version");
export const setting = localize('dacfx.setting', "Setting");
export const value = localize('dacfx.value', "Value");
export const databaseName = localize('dacFx.databaseName', "Database Name");
export const open = localize('dacFxDeploy.openFile', "Open");
export const upgradeExistingDatabase = localize('dacFx.upgradeExistingDatabase', "Upgrade Existing Database");
export const newDatabase = localize('dacFx.newDatabase', "New Database");
export function dataLossTextWithCount(count: number): string { return localize('dacfx.dataLossTextWithCount', "{0} of the deploy actions listed may result in data loss. Please ensure you have a backup or snapshot available in the event of an issue with the deployment.", count); }
export const proceedDataLossMessage = localize('dacFx.proceedDataLoss', "Proceed despite possible data loss");
export const noDataLossMessage = localize('dacfx.noDataLoss', "No data loss will occur from the listed deploy actions.");
export const dataLossMessage = localize('dacfx.dataLossText', "The deploy actions may result in data loss. Please ensure you have a backup or snapshot available in the event of an issue with the deployment.");
export const operation = localize('dacfx.operation', "Operation");
export const operationTooltip = localize('dacfx.operationTooltip', "Operation(Create, Alter, Delete) that will occur during deployment");
export const type = localize('dacfx.type', "Type");
export const typeTooltip = localize('dacfx.typeTooltip', "Type of object that will be affected by deployment");
export const object = localize('dacfx.object', "Object");
export const objectTooltip = localize('dacfx.objecTooltip', "Name of object that will be affected by deployment");
export const dataLoss = localize('dacfx.dataLoss', "Data Loss");
export const dataLossTooltip = localize('dacfx.dataLossTooltip', "Operations that may result in data loss are marked with a warning sign");
export const save = localize('dacfx.save', "Save");
export const versionText = localize('dacFx.versionText', "Version (use x.x.x.x where x is a number)");
export const deployDescription = localize('dacFx.deployDescription', "Deploy a data-tier application .dacpac file to an instance of SQL Server [Deploy Dacpac]");
export const extractDescription = localize('dacFx.extractDescription', "Extract a data-tier application from an instance of SQL Server to a .dacpac file [Extract Dacpac]");
export const importDescription = localize('dacFx.importDescription', "Create a database from a .bacpac file [Import Bacpac]");
export const exportDescription = localize('dacFx.exportDescription', "Export the schema and data from a database to the logical .bacpac file format [Export Bacpac]");
export const wizardTitle = localize('dacfx.wizardTitle', "Data-tier Application Wizard");
export const selectOperationPageName = localize('dacFx.selectOperationPageName', "Select an Operation");
export const deployConfigPageName = localize('dacFx.deployConfigPageName', "Select Deploy Dacpac Settings");
export const deployPlanPageName = localize('dacFx.deployPlanPageName', "Review the deploy plan");
export const summaryPageName = localize('dacFx.summaryPageName', "Summary");
export const extractConfigPageName = localize('dacFx.extractConfigPageName', "Select Extract Dacpac Settings");
export const importConfigPageName = localize('dacFx.importConfigPageName', "Select Import Bacpac Settings");
export const exportConfigPageName = localize('dacFx.exportConfigPageName', "Select Export Bacpac Settings");
export const deploy = localize('dacFx.deployButton', "Deploy");
export const extract = localize('dacFx.extract', "Extract");
export const importText = localize('dacFx.import', "Import");
export const exportText = localize('dacFx.export', "Export");
export const generateScript = localize('dacFx.generateScriptButton', "Generate Script");
export const generatingScriptMessage = localize('dacfx.scriptGeneratingMessage', "You can view the status of script generation in the Tasks View once the wizard is closed. The generated script will open when complete.");
export const defaultText = localize('dacfx.default', "default");
export const deployPlanTableTitle = localize('dacfx.deployPlanTableTitle', "Deploy plan operations");

// Error messages
export const databaseNameExistsErrorMessage = localize('dacfx.databaseNameExistsErrorMessage', "A database with the same name already exists on the instance of SQL Server");
export const undefinedFilenameErrorMessage = localize('dacfx.undefinedFilenameErrorMessage', "Undefined name");
export const filenameEndingIsPeriodErrorMessage = localize('dacfx.filenameEndingInPeriodErrorMessage', "File name cannot end with a period");
export const whitespaceFilenameErrorMessage = localize('dacfx.whitespaceFilenameErrorMessage', "File name cannot be whitespace");
export const invalidFileCharsErrorMessage = localize('dacfx.invalidFileCharsErrorMessage', "Invalid file characters");
export const reservedWindowsFilenameErrorMessage = localize('dacfx.reservedWindowsFilenameErrorMessage', "This file name is reserved for use by Windows. Choose another name and try again");
export const reservedValueErrorMessage = localize('dacfx.reservedValueErrorMessage', "Reserved file name. Choose another name and try again");
export const trailingWhitespaceErrorMessage = localize('dacfx.trailingWhitespaceErrorMessage', "File name cannot end with a whitespace");
export const tooLongFilenameErrorMessage = localize('dacfx.tooLongFilenameErrorMessage', "File name is over 255 characters");
export function deployPlanErrorMessage(errorMessage: string): string { return localize('dacfx.deployPlanErrorMessage', "Generating deploy plan failed '{0}'", errorMessage ? errorMessage : 'Unknown'); }
