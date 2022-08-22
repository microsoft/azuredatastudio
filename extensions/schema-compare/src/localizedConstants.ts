/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// Labels
export const OkButtonText: string = localize('schemaCompareDialog.ok', "OK");
export const CancelButtonText: string = localize('schemaCompareDialog.cancel', "Cancel");
export const SourceTitle: string = localize('schemaCompareDialog.SourceTitle', "Source");
export const TargetTitle: string = localize('schemaCompareDialog.TargetTitle', "Target");
export const FileTextBoxLabel: string = localize('schemaCompareDialog.fileTextBoxLabel', "File");
export const DacpacRadioButtonLabel: string = localize('schemaCompare.dacpacRadioButtonLabel', "Data-tier Application File (.dacpac)");
export const DatabaseRadioButtonLabel: string = localize('schemaCompare.databaseButtonLabel', "Database");
export const ProjectRadioButtonLabel: string = localize('schemaCompare.projectButtonLabel', "Database Project");
export const RadioButtonsLabel: string = localize('schemaCompare.radioButtonsLabel', "Type");
export const ServerDropdownLabel: string = localize('schemaCompareDialog.serverDropdownTitle', "Server");
export const DatabaseDropdownLabel: string = localize('schemaCompareDialog.databaseDropdownTitle', "Database");
export const StructureDropdownLabel: string = localize('schemaCompareDialog.structureDropdownLabel', "Folder Structure");
export const SchemaCompareLabel: string = localize('schemaCompare.dialogTitle', "Schema Compare");
export const differentSourceMessage: string = localize('schemaCompareDialog.differentSourceMessage', "A different source schema has been selected. Compare to see the comparison?");
export const differentTargetMessage: string = localize('schemaCompareDialog.differentTargetMessage', "A different target schema has been selected. Compare to see the comparison?");
export const differentSourceTargetMessage: string = localize('schemaCompareDialog.differentSourceTargetMessage', "Different source and target schemas have been selected. Compare to see the comparison?");
export const YesButtonText: string = localize('schemaCompareDialog.Yes', "Yes");
export const NoButtonText: string = localize('schemaCompareDialog.No', "No");
export const sourceFile: string = localize('schemaCompareDialog.sourceTextBox', "Source file");
export const targetFile: string = localize('schemaCompareDialog.targetTextBox', "Target file");
export const sourceDatabase: string = localize('schemaCompareDialog.sourceDatabaseDropdown', "Source Database");
export const targetDatabase: string = localize('schemaCompareDialog.targetDatabaseDropdown', "Target Database");
export const sourceServer: string = localize('schemaCompareDialog.sourceServerDropdown', "Source Server");
export const targetServer: string = localize('schemaCompareDialog.targetServerDropdown', "Target Server");
export const defaultText: string = localize('schemaCompareDialog.defaultUser', "default");
export const open: string = localize('schemaCompare.openFile', "Open");
export const targetStructure = localize('targetStructure', "Target Folder Structure");
export const file = localize('file', "File");
export const flat = localize('flat', "Flat");
export const objectType = localize('objectType', "Object Type");
export const schema = localize('schema', "Schema");
export const schemaObjectType = localize('schemaObjectType', "Schema/Object Type");
export const selectSourceFile: string = localize('schemaCompare.selectSourceFile', "Select source file");
export const selectTargetFile: string = localize('schemaCompare.selectTargetFile', "Select target file");
export const ResetButtonText: string = localize('SchemaCompareOptionsDialog.Reset', "Reset");
export const OptionsChangedMessage: string = localize('schemaCompareOptions.RecompareMessage', "Options have changed. Recompare to see the comparison?");
export const OptionsLabel: string = localize('SchemaCompare.SchemaCompareOptionsDialogLabel', "Schema Compare Options");
export const GeneralOptionsLabel: string = localize('SchemaCompare.GeneralOptionsLabel', "General Options");
export const ObjectTypesOptionsLabel: string = localize('SchemaCompare.ObjectTypesOptionsLabel', "Include Object Types");
export const diffEditorTitle: string = localize('schemaCompare.CompareDetailsTitle', "Compare Details");
export const applyConfirmation: string = localize('schemaCompare.ApplyConfirmation', "Are you sure you want to update the target?");
export const reCompareToRefeshMessage: string = localize('schemaCompare.RecompareToRefresh', "Press Compare to refresh the comparison.");
export const generateScriptEnabledMessage: string = localize('schemaCompare.generateScriptEnabledButton', "Generate script to deploy changes to target");
export const generateScriptNoChangesMessage: string = localize('schemaCompare.generateScriptNoChanges', "No changes to script");
export const applyEnabledMessage: string = localize('schemaCompare.applyButtonEnabledTitle', "Apply changes to target");
export const applyNoChangesMessage: string = localize('schemaCompare.applyNoChanges', "No changes to apply");
export const includeExcludeInfoMessage: string = localize('schemaCompare.includeExcludeInfoMessage', "Please note that include/exclude operations can take a moment to calculate affected dependencies");
export const sourceTitle: string = localize('schemaCompareDialog.SourceTitle', "Source");
export const targetTitle: string = localize('schemaCompareDialog.TargetTitle', "Target");
export const deleteAction: string = localize('schemaCompare.deleteAction', "Delete");
export const changeAction: string = localize('schemaCompare.changeAction', "Change");
export const addAction: string = localize('schemaCompare.addAction', "Add");
export const differencesTableTitle: string = localize('schemaCompare.differencesTableTitle', "Comparison between Source and Target");
export const waitText: string = localize('schemaCompare.waitText', "Initializing Comparison. This might take a moment.");
export const startText: string = localize('schemaCompare.startText', "To compare two schemas, first select a source schema and target schema, then press Compare.");
export const noDifferencesText: string = localize('schemaCompare.noDifferences', "No schema differences were found.");
export const type: string = localize('schemaCompare.typeColumn', "Type");
export const sourceName: string = localize('schemaCompare.sourceNameColumn', "Source Name");
export const include: string = localize('schemaCompare.includeColumnName', "Include");
export const action: string = localize('schemaCompare.actionColumn', "Action");
export const targetName: string = localize('schemaCompare.targetNameColumn', "Target Name");
export const generateScriptDisabled: string = localize('schemaCompare.generateScriptButtonDisabledTitle', "Generate script is enabled when the target is a database");
export const applyDisabled: string = localize('schemaCompare.applyButtonDisabledTitle', "Apply is enabled when the target is a database or database project");
export function cannotExcludeMessageDependent(diffEntryName: string, firstDependentName: string): string { return localize('schemaCompare.cannotExcludeMessageWithDependent', "Cannot exclude {0}. Included dependents exist, such as {1}", diffEntryName, firstDependentName); }
export function cannotIncludeMessageDependent(diffEntryName: string, firstDependentName: string): string { return localize('schemaCompare.cannotIncludeMessageWithDependent', "Cannot include {0}. Excluded dependents exist, such as {1}", diffEntryName, firstDependentName); }
export function cannotExcludeMessage(diffEntryName: string): string { return localize('schemaCompare.cannotExcludeMessage', "Cannot exclude {0}. Included dependents exist", diffEntryName); }
export function cannotIncludeMessage(diffEntryName: string): string { return localize('schemaCompare.cannotIncludeMessage', "Cannot include {0}. Excluded dependents exist", diffEntryName); }
export const compare: string = localize('schemaCompare.compareButton', "Compare");
export const stop: string = localize('schemaCompare.cancelCompareButton', "Stop");
export const generateScript: string = localize('schemaCompare.generateScriptButton', "Generate script");
export const options: string = localize('schemaCompare.optionsButton', "Options");
export const apply: string = localize('schemaCompare.updateButton', "Apply");
export const switchDirection: string = localize('schemaCompare.switchDirectionButton', "Switch direction");
export const switchDirectionDescription: string = localize('schemaCompare.switchButtonTitle', "Switch source and target");
export const selectSource: string = localize('schemaCompare.sourceButtonTitle', "Select Source");
export const selectTarget: string = localize('schemaCompare.targetButtonTitle', "Select Target");
export const openScmp: string = localize('schemaCompare.openScmpButton', "Open .scmp file");
export const openScmpDescription: string = localize('schemaCompare.openScmpButtonTitle', "Load source, target, and options saved in an .scmp file");
export const saveScmp: string = localize('schemaCompare.saveScmpButton', "Save .scmp file");
export const saveScmpDescription: string = localize('schemaCompare.saveScmpButtonTitle', "Save source and target, options, and excluded elements");
export const save: string = localize('schemaCompare.saveFile', "Save");
export function getConnectionString(caller: string): string { return localize('schemaCompare.GetConnectionString', "Do you want to connect to {0}?", caller); }
export const selectConnection: string = localize('schemaCompare.selectConnection', "Select connection");

// Error messages
export function compareErrorMessage(errorMessage: string): string { return localize('schemaCompare.compareErrorMessage', "Schema Compare failed: {0}", errorMessage ? errorMessage : 'Unknown'); }
export function saveScmpErrorMessage(errorMessage: string): string { return localize('schemaCompare.saveScmpErrorMessage', "Save scmp failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function cancelErrorMessage(errorMessage: string): string { return localize('schemaCompare.cancelErrorMessage', "Cancel schema compare failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function generateScriptErrorMessage(errorMessage: string): string { return localize('schemaCompare.generateScriptErrorMessage', "Generate script failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function applyErrorMessage(errorMessage: string): string { return localize('schemaCompare.updateErrorMessage', "Schema Compare Apply failed '{0}'", errorMessage ? errorMessage : 'Unknown'); }
export function openScmpErrorMessage(errorMessage: string): string { return localize('schemaCompare.openScmpErrorMessage', "Open scmp failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function OptionNotFoundWarningMessage(label: string) { return localize('OptionNotFoundWarningMessage', "label: {0} does not exist in the options value name lookup", label); }
export const applyError: string = localize('schemaCompare.applyError', "There was an error updating the project");
export const dspErrorSource: string = localize('schemaCompareDialog.dspErrorSource', "The source .sqlproj file does not specify a database schema component");
export const dspErrorTarget: string = localize('schemaCompareDialog.dspErrorTarget', "The target .sqlproj file does not specify a database schema component");
export const noProjectExtension: string = localize('schemaCompareDialog.noProjectExtension', "The sql-database-projects extension is required to perform schema comparison with database projects");
export const noProjectExtensionApply: string = localize('schemaCompareDialog.noProjectExtensionApply', "The sql-database-projects extension is required to apply changes to a project");

// Information messages
export const applySuccess: string = localize('schemaCompare.applySuccess', "Project was successfully updated");

// Extensions
export const sqlDatabaseProjectExtensionId: string = 'microsoft.sql-database-projects';

// Commands
export const sqlDatabaseProjectsPublishChanges: string = 'sqlDatabaseProjects.schemaComparePublishProjectChanges';
