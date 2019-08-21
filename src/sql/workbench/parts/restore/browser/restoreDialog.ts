/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/restoreDialog';

import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Event, Emitter } from 'vs/base/common/event';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Widget } from 'vs/base/browser/ui/widget';
import { MessageType, IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { mixin } from 'vs/base/common/objects';
import * as strings from 'vs/base/common/strings';
import * as DOM from 'vs/base/browser/dom';

import * as azdata from 'azdata';

import { Button } from 'sql/base/browser/ui/button/button';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { InputBox, OnLoseFocusParams } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { CheckboxSelectColumn } from 'sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin';
import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachButtonStyler, attachModalDialogStyler, attachTableStyler, attachInputBoxStyler, attachSelectBoxStyler, attachEditableDropdownStyler, attachCheckboxStyler, attachTabbedPanelStyler } from 'sql/platform/theme/common/styler';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as BackupConstants from 'sql/workbench/parts/backup/common/constants';
import { RestoreViewModel, RestoreOptionParam, SouceDatabaseNamesParam } from 'sql/workbench/parts/restore/browser/restoreViewModel';
import * as FileValidationConstants from 'sql/workbench/services/fileBrowser/common/fileValidationServiceConstants';
import { Dropdown } from 'sql/base/parts/editableDropdown/browser/dropdown';
import { TabbedPanel, PanelTabIdentifier } from 'sql/base/browser/ui/panel/panel';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';

interface FileListElement {
	logicalFileName: string;
	fileType: string;
	originalFileName: string;
	restoreAs: string;
}

const LocalizedStrings = {
	BACKFILEPATH: localize('backupFilePath', "Backup file path"),
	TARGETDATABASE: localize('targetDatabase', "Target database")
};

export class RestoreDialog extends Modal {
	public viewModel: RestoreViewModel;

	private _scriptButton: Button;
	private _restoreButton: Button;
	private _closeButton: Button;
	private _optionsMap: { [name: string]: SelectBox | InputBox | Checkbox } = {};
	private _restoreLabel: string;
	private _restoreTitle: string;
	private _databaseTitle: string;
	private _backupFileTitle: string;
	private _ownerUri: string;
	private _databaseDropdown: Dropdown;
	private _isBackupFileCheckboxChanged: boolean;

	// General options
	private _filePathInputBox: InputBox;
	private _browseFileButton: Button;
	private _destinationRestoreToInputBox: InputBox;
	private _restoreFromSelectBox: SelectBox;
	private _sourceDatabaseSelectBox: SelectBox;

	private _panel: TabbedPanel;
	private _generalTabId: PanelTabIdentifier;

	// File option
	private readonly _relocateDatabaseFilesOption = 'relocateDbFiles';
	private readonly _relocatedDataFileFolderOption = 'dataFileFolder';
	private readonly _relocatedLogFileFolderOption = 'logFileFolder';

	// other options
	private readonly _withReplaceDatabaseOption = 'replaceDatabase';
	private readonly _withKeepReplicationOption = 'keepReplication';
	private readonly _withRestrictedUserOption = 'setRestrictedUser';

	private readonly _recoveryStateOption = 'recoveryState';
	private readonly _standbyFileOption = 'standbyFile';

	private readonly _takeTaillogBackupOption = 'backupTailLog';
	private readonly _tailLogWithNoRecoveryOption = 'tailLogWithNoRecovery';
	private readonly _tailLogBackupFileOption = 'tailLogBackupFile';

	private readonly _closeExistingConnectionsOption = 'closeExistingConnections';

	private _restoreFromBackupFileElement: HTMLElement;

	private _fileListTable: Table<FileListElement>;
	private _fileListData: TableDataView<FileListElement>;
	private _fileListTableContainer: HTMLElement;

	private _restorePlanTable: Table<Slick.SlickData>;
	private _restorePlanData: TableDataView<Slick.SlickData>;
	private _restorePlanColumn;
	private _restorePlanTableContainer: HTMLElement;
	private _isRenderedRestorePlanTable: boolean;

	private _onRestore = new Emitter<boolean>();
	public onRestore: Event<boolean> = this._onRestore.event;

	private _onValidate = new Emitter<boolean>();
	public onValidate: Event<boolean> = this._onValidate.event;

	private _onCancel = new Emitter<void>();
	public onCancel: Event<void> = this._onCancel.event;

	private _onCloseEvent = new Emitter<void>();
	public onCloseEvent: Event<void> = this._onCloseEvent.event;

	private _onDatabaseListFocused = new Emitter<void>();
	public onDatabaseListFocused: Event<void> = this._onDatabaseListFocused.event;

	constructor(
		optionsMetadata: azdata.ServiceOption[],
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IFileBrowserDialogController private fileBrowserDialogService: IFileBrowserDialogController,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(localize('RestoreDialogTitle', "Restore database"), TelemetryKeys.Restore, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { hasErrors: true, isWide: true, hasSpinner: true });
		this._restoreTitle = localize('restoreDialog.restoreTitle', "Restore database");
		this._databaseTitle = localize('restoreDialog.database', "Database");
		this._backupFileTitle = localize('restoreDialog.backupFile', "Backup file");
		this._restoreLabel = localize('restoreDialog.restore', "Restore");

		// view model
		this.viewModel = new RestoreViewModel(optionsMetadata);
		this.viewModel.onSetLastBackupTaken((value) => this.updateLastBackupTaken(value));
		this.viewModel.onSetfilePath((value) => this.updateFilePath(value));
		this.viewModel.onSetSourceDatabaseNames((databaseNamesParam) => this.updateSourceDatabaseName(databaseNamesParam));
		this.viewModel.onSetTargetDatabaseName((value) => this.updateTargetDatabaseName(value));
		this.viewModel.onSetLastBackupTaken((value) => this.updateLastBackupTaken(value));
		this.viewModel.onSetRestoreOption((optionParams) => this.updateRestoreOption(optionParams));
		this.viewModel.onUpdateBackupSetsToRestore((backupSets) => this.updateBackupSetsToRestore(backupSets));
		this.viewModel.onUpdateRestoreDatabaseFiles((files) => this.updateRestoreDatabaseFiles(files));

		this._isRenderedRestorePlanTable = false;
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		let cancelLabel = localize('restoreDialog.cancel', "Cancel");
		this._scriptButton = this.addFooterButton(localize('restoreDialog.script', "Script"), () => this.restore(true));
		this._restoreButton = this.addFooterButton(this._restoreLabel, () => this.restore(false));
		this._closeButton = this.addFooterButton(cancelLabel, () => this.cancel());
		this.registerListeners();
		this._destinationRestoreToInputBox.disable();
	}

	protected renderBody(container: HTMLElement) {
		const restoreFromElement = DOM.$('.restore-from');
		this.createLabelElement(restoreFromElement, localize('source', "Source"), true);
		this._restoreFromSelectBox = this.createSelectBoxHelper(restoreFromElement, localize('restoreFrom', "Restore from"), [this._databaseTitle, this._backupFileTitle], this._databaseTitle);

		this._restoreFromBackupFileElement = DOM.$('.backup-file-path');
		DOM.hide(this._restoreFromBackupFileElement);
		const errorMessage = localize('missingBackupFilePathError', "Backup file path is required.");
		const validationOptions: IInputOptions = {
			validationOptions: {
				validation: (value: string) => !value ? ({ type: MessageType.ERROR, content: errorMessage }) : null
			},
			placeholder: localize('multipleBackupFilePath', "Please enter one or more file paths separated by commas"),
			ariaLabel: LocalizedStrings.BACKFILEPATH
		};
		const filePathInputContainer = DOM.append(this._restoreFromBackupFileElement, DOM.$('.dialog-input-section'));
		DOM.append(filePathInputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.BACKFILEPATH;

		this._filePathInputBox = new InputBox(DOM.append(filePathInputContainer, DOM.$('.dialog-input')), this._contextViewService, validationOptions);

		this._browseFileButton = new Button(DOM.append(filePathInputContainer, DOM.$('.file-browser')));
		this._browseFileButton.label = '...';

		const sourceDatabasesElement = DOM.$('.source-database-list');
		this._sourceDatabaseSelectBox = this.createSelectBoxHelper(sourceDatabasesElement, localize('database', "Database"), [], '');

		// Source section
		const sourceElement = DOM.$('.source-section.new-section');
		sourceElement.append(restoreFromElement);
		sourceElement.append(this._restoreFromBackupFileElement);
		sourceElement.append(sourceDatabasesElement);

		// Destination section
		const destinationElement = DOM.$('.destination-section.new-section');
		this.createLabelElement(destinationElement, localize('destination', "Destination"), true);

		const destinationInputContainer = DOM.append(destinationElement, DOM.$('.dialog-input-section'));
		DOM.append(destinationInputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.TARGETDATABASE;

		const dropdownContainer = DOM.append(destinationInputContainer, DOM.$('.dialog-input'));

		// Get the bootstrap params and perform the bootstrap
		dropdownContainer.style.width = '100%';

		this._databaseDropdown = new Dropdown(dropdownContainer, this._contextViewService,
			{
				strictSelection: false,
				ariaLabel: LocalizedStrings.TARGETDATABASE,
				actionLabel: localize('restoreDialog.toggleDatabaseNameDropdown', "Select Database Toggle Dropdown")
			}
		);
		this._databaseDropdown.onValueChange(s => {
			this.databaseSelected(s);
		});

		this._databaseDropdown.onBlur(() => {
			this.databaseSelected(this._databaseDropdown.value);
		});

		this._databaseDropdown.onFocus(() => {
			this._onDatabaseListFocused.fire();
		});

		this._databaseDropdown.value = this.viewModel.targetDatabaseName;
		attachEditableDropdownStyler(this._databaseDropdown, this._themeService);

		this._destinationRestoreToInputBox = this.createInputBoxHelper(destinationElement, localize('restoreTo', "Restore to"));

		// Restore plan section
		const restorePlanElement = DOM.$('.restore-plan-section.new-section');
		this.createLabelElement(restorePlanElement, localize('restorePlan', "Restore plan"), true);
		this.createLabelElement(restorePlanElement, localize('backupSetsToRestore', "Backup sets to restore"));

		// Backup sets table
		this._restorePlanTableContainer = DOM.append(restorePlanElement, DOM.$('.dialog-input-section.restore-list'));
		DOM.hide(this._restorePlanTableContainer);
		this._restorePlanData = new TableDataView<Slick.SlickData>();
		this._restorePlanTable = new Table<Slick.SlickData>(this._restorePlanTableContainer,
			{ dataProvider: this._restorePlanData, columns: this._restorePlanColumn }, { enableColumnReorder: false });
		this._restorePlanTable.setTableTitle(localize('restorePlan', "Restore plan"));
		this._restorePlanTable.setSelectionModel(new RowSelectionModel({ selectActiveRow: false }));
		this._restorePlanTable.onSelectedRowsChanged((e, data) => this.backupFileCheckboxChanged(e, data));

		// Content in general tab
		const generalTab = DOM.$('.restore-dialog');
		generalTab.append(sourceElement);
		generalTab.append(destinationElement);
		generalTab.append(restorePlanElement);

		// Content in file tab
		const fileContentElement = DOM.$('.restore-dialog');
		const restoreAsSectionContainer = DOM.append(fileContentElement, DOM.$('.new-section'));

		this.createLabelElement(restoreAsSectionContainer, localize('restoreDatabaseFileAs', "Restore database files as"), true);
		this.createOptionControl(restoreAsSectionContainer, this._relocateDatabaseFilesOption);
		const subSectionContainer = DOM.append(restoreAsSectionContainer, DOM.$('.sub-section'));
		this.createOptionControl(subSectionContainer, this._relocatedDataFileFolderOption);
		this.createOptionControl(subSectionContainer, this._relocatedLogFileFolderOption);

		// Restore database file details section

		const restoreFileSectionContainer = DOM.append(fileContentElement, DOM.$('.new-section'));
		this.createLabelElement(restoreFileSectionContainer, localize('restoreDatabaseFileDetails', "Restore database file details"), true);
		// file list table
		this._fileListTableContainer = DOM.append(restoreFileSectionContainer, DOM.$('.dialog-input-section.restore-list'));
		DOM.hide(this._fileListTableContainer);
		const logicalFileName = localize('logicalFileName', "Logical file Name");
		const fileType = localize('fileType', "File type");
		const originalFileName = localize('originalFileName', "Original File Name");
		const restoreAs = localize('restoreAs', "Restore as");
		const columns = [{
			id: 'logicalFileName',
			name: logicalFileName,
			field: 'logicalFileName'
		}, {
			id: 'fileType',
			name: fileType,
			field: 'fileType'
		}, {
			id: 'originalFileName',
			name: originalFileName,
			field: 'originalFileName'
		}, {
			id: 'restoreAs',
			name: restoreAs,
			field: 'restoreAs'
		}];
		this._fileListData = new TableDataView<FileListElement>();
		this._fileListTable = new Table<FileListElement>(this._fileListTableContainer,
			{ dataProvider: this._fileListData, columns }, { enableColumnReorder: false });
		this._fileListTable.setSelectionModel(new RowSelectionModel());

		// Content in options tab
		const optionsContentElement = DOM.$('.restore-dialog');
		// Restore options section
		const restoreOptions = DOM.append(optionsContentElement, DOM.$('.new-section'));
		this.createLabelElement(restoreOptions, localize('restoreOptions', "Restore options"), true);
		this.createOptionControl(restoreOptions, this._withReplaceDatabaseOption);
		this.createOptionControl(restoreOptions, this._withKeepReplicationOption);
		this.createOptionControl(restoreOptions, this._withRestrictedUserOption);
		this.createOptionControl(restoreOptions, this._recoveryStateOption);

		this.createOptionControl(DOM.append(restoreOptions, DOM.$('.sub-section')), this._standbyFileOption);

		// Tail-Log backup section
		const tailLog = DOM.append(optionsContentElement, DOM.$('.new-section'));
		this.createLabelElement(tailLog, localize('taillogBackup', "Tail-Log backup"), true);
		this.createOptionControl(tailLog, this._takeTaillogBackupOption);
		const tailLogOptions = DOM.append(tailLog, DOM.$('.sub-section'));
		this.createOptionControl(tailLogOptions, this._tailLogWithNoRecoveryOption);
		this.createOptionControl(tailLogOptions, this._tailLogBackupFileOption);

		// Server connections section
		const serverConnections = DOM.append(optionsContentElement, DOM.$('.new-section'));
		this.createLabelElement(serverConnections, localize('serverConnection', "Server connections"), true);
		this.createOptionControl(serverConnections, this._closeExistingConnectionsOption);

		const restorePanel = DOM.$('.restore-panel');
		container.appendChild(restorePanel);
		this._panel = new TabbedPanel(restorePanel);
		attachTabbedPanelStyler(this._panel, this._themeService);
		this._generalTabId = this._panel.pushTab({
			identifier: 'general',
			title: localize('generalTitle', "General"),
			view: {
				render: c => {
					DOM.append(c, generalTab);
				},
				layout: () => { },
				focus: () => this._restoreFromSelectBox ? this._restoreFromSelectBox.focus() : generalTab.focus()
			}
		});

		const fileTab = this._panel.pushTab({
			identifier: 'fileContent',
			title: localize('filesTitle', "Files"),
			view: {
				layout: () => { },
				render: c => {
					c.appendChild(fileContentElement);
				},
				focus: () => this._optionsMap[this._relocateDatabaseFilesOption] ? this._optionsMap[this._relocateDatabaseFilesOption].focus() : fileContentElement.focus()
			}
		});

		this._panel.pushTab({
			identifier: 'options',
			title: localize('optionsTitle', "Options"),
			view: {
				layout: () => { },
				render: c => {
					c.appendChild(optionsContentElement);
				},
				focus: () => this._optionsMap[this._withReplaceDatabaseOption] ? this._optionsMap[this._withReplaceDatabaseOption].focus() : optionsContentElement.focus()
			}
		});

		this._panel.onTabChange(c => {
			if (c === fileTab && this._fileListTable) {
				this._fileListTable.resizeCanvas();
				this._fileListTable.autosizeColumns();
			}
			if (c !== this._generalTabId) {
				this._restoreFromSelectBox.hideMessage();
			}
		});

		this._restorePlanTable.grid.onKeyDown.subscribe((e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				this._destinationRestoreToInputBox.isEnabled() ? this._destinationRestoreToInputBox.focus() : this._databaseDropdown.focus();
				e.stopImmediatePropagation();
			} else if (event.equals(KeyCode.Tab)) {
				this.focusOnFirstEnabledFooterButton();
				e.stopImmediatePropagation();
			}
		});

		this._fileListTable.grid.onKeyDown.subscribe((e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				if ((<InputBox>this._optionsMap[this._relocatedLogFileFolderOption]).isEnabled()) {
					(<InputBox>this._optionsMap[this._relocatedLogFileFolderOption]).focus();
				} else if ((<InputBox>this._optionsMap[this._relocatedDataFileFolderOption]).isEnabled()) {
					(<InputBox>this._optionsMap[this._relocatedDataFileFolderOption]).focus();
				} else {
					(<Checkbox>this._optionsMap[this._relocateDatabaseFilesOption]).focus();
				}
				e.stopImmediatePropagation();
			} else if (event.equals(KeyCode.Tab)) {
				this.focusOnFirstEnabledFooterButton();
				e.stopImmediatePropagation();
			}
		});
	}

	private focusOnFirstEnabledFooterButton() {
		if (this._scriptButton.enabled) {
			this._scriptButton.focus();
		} else if (this._restoreButton.enabled) {
			this._restoreButton.focus();
		} else {
			this._closeButton.focus();
		}
	}

	private databaseSelected(dbName: string): void {
		if (this.viewModel.targetDatabaseName !== dbName) {
			this.viewModel.targetDatabaseName = dbName;
			this.validateRestore(false);
		}
	}

	public set databaseListOptions(vals: string[]) {
		this._databaseDropdown.values = vals;
	}

	private createLabelElement(container: HTMLElement, content: string, isHeader?: boolean) {
		let className = 'dialog-label';
		if (isHeader) {
			className += ' header';
		}
		DOM.append(container, DOM.$(`.${className}`)).innerText = content;
	}

	private createOptionControl(container: HTMLElement, optionName: string): void {
		const option = this.viewModel.getOptionMetadata(optionName);
		let propertyWidget: SelectBox | InputBox | Checkbox;
		switch (option.valueType) {
			case ServiceOptionType.boolean:
				propertyWidget = this.createCheckBoxHelper(container, option.description,
					DialogHelper.getBooleanValueFromStringOrBoolean(option.defaultValue), () => this.onBooleanOptionChecked(optionName));
				break;
			case ServiceOptionType.category:
				propertyWidget = this.createSelectBoxHelper(container, option.description, option.categoryValues.map(c => c.displayName), DialogHelper.getCategoryDisplayName(option.categoryValues, option.defaultValue));
				this._register(attachSelectBoxStyler(propertyWidget, this._themeService));
				this._register(propertyWidget.onDidSelect(selectedDatabase => {
					this.onCatagoryOptionChanged(optionName);
				}));
				break;
			case ServiceOptionType.string:
				propertyWidget = this.createInputBoxHelper(container, option.description);
				this._register(attachInputBoxStyler(propertyWidget, this._themeService));
				this._register(propertyWidget.onLoseFocus(params => {
					this.onStringOptionChanged(optionName, params);
				}));
		}

		this._optionsMap[optionName] = propertyWidget;
	}

	private onBooleanOptionChecked(optionName: string) {
		this.viewModel.setOptionValue(optionName, (<Checkbox>this._optionsMap[optionName]).checked);
		this.validateRestore(false);
	}

	private onCatagoryOptionChanged(optionName: string) {
		this.viewModel.setOptionValue(optionName, (<SelectBox>this._optionsMap[optionName]).value);
		this.validateRestore(false);
	}

	private onStringOptionChanged(optionName: string, params: OnLoseFocusParams) {
		if (params.hasChanged && params.value) {
			this.viewModel.setOptionValue(optionName, params.value);
			this.validateRestore(false);
		}
	}

	private createCheckBoxHelper(container: HTMLElement, label: string, isChecked: boolean, onCheck: (viaKeyboard: boolean) => void): Checkbox {
		const checkbox = new Checkbox(DOM.append(container, DOM.$('.dialog-input-section')), {
			label: label,
			checked: isChecked,
			onChange: onCheck,
			ariaLabel: label
		});
		this._register(attachCheckboxStyler(checkbox, this._themeService));
		return checkbox;
	}

	private createSelectBoxHelper(container: HTMLElement, label: string, options: string[], selectedOption: string): SelectBox {
		const inputContainer = DOM.append(container, DOM.$('.dialog-input-section'));
		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = label;
		const inputCellContainer = DOM.append(inputContainer, DOM.$('.dialog-input'));
		const selectBox = new SelectBox(options, selectedOption, this._contextViewService, inputCellContainer, { ariaLabel: label });
		selectBox.render(inputCellContainer);
		return selectBox;
	}

	private createInputBoxHelper(container: HTMLElement, label: string, options?: IInputOptions): InputBox {
		const ariaOptions = {
			ariaLabel: label
		};
		const inputContainer = DOM.append(container, DOM.$('.dialog-input-section'));
		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = label;
		return new InputBox(DOM.append(inputContainer, DOM.$('.dialog-input')), this._contextViewService, mixin(ariaOptions, options));
	}

	private clearRestorePlanDataTable(): void {
		if (this._restorePlanData.getLength() > 0) {
			this._restorePlanData.clear();
			DOM.hide(this._restorePlanTableContainer);
		}
	}

	private clearFileListTable(): void {
		if (this._fileListData.getLength() > 0) {
			this._fileListData.clear();
			DOM.hide(this._fileListTableContainer);
		}
	}

	private resetRestoreContent(): void {
		this.clearRestorePlanDataTable();
		this.clearFileListTable();
		this._restoreButton.enabled = false;
		this._scriptButton.enabled = false;
	}

	public onValidateResponseFail(errorMessage: string) {
		this.resetRestoreContent();
		if (this.isRestoreFromDatabaseSelected) {
			this._sourceDatabaseSelectBox.showMessage({ type: MessageType.ERROR, content: errorMessage });
		} else {
			this._sourceDatabaseSelectBox.setOptions([]);
			this._filePathInputBox.showMessage({ type: MessageType.ERROR, content: errorMessage });
		}
	}

	public removeErrorMessage() {
		this._filePathInputBox.hideMessage();
		this._sourceDatabaseSelectBox.hideMessage();
		this._destinationRestoreToInputBox.hideMessage();
	}

	public enableRestoreButton(enabled: boolean) {
		this.spinner = false;
		this._restoreButton.enabled = enabled;
		this._scriptButton.enabled = enabled;
	}

	public showError(errorMessage: string): void {
		this.setError(errorMessage);
	}

	private backupFileCheckboxChanged(e: Slick.EventData, data: Slick.OnSelectedRowsChangedEventArgs<Slick.SlickData>): void {
		let selectedFiles = [];
		data.grid.getSelectedRows().forEach(row => {
			selectedFiles.push(data.grid.getDataItem(row)['Id']);
		});

		let isSame = false;
		if (this.viewModel.selectedBackupSets && this.viewModel.selectedBackupSets.length === selectedFiles.length) {
			isSame = this.viewModel.selectedBackupSets.some(item => selectedFiles.includes(item));
		}

		if (!isSame) {
			this.viewModel.selectedBackupSets = selectedFiles;
			this.validateRestore(false, true);
		}
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachInputBoxStyler(this._filePathInputBox, this._themeService));
		this._register(attachInputBoxStyler(this._destinationRestoreToInputBox, this._themeService));
		this._register(attachSelectBoxStyler(this._restoreFromSelectBox, this._themeService));
		this._register(attachSelectBoxStyler(this._sourceDatabaseSelectBox, this._themeService));
		this._register(attachButtonStyler(this._browseFileButton, this._themeService));
		this._register(attachButtonStyler(this._scriptButton, this._themeService));
		this._register(attachButtonStyler(this._restoreButton, this._themeService));
		this._register(attachButtonStyler(this._closeButton, this._themeService));
		this._register(attachTableStyler(this._fileListTable, this._themeService));
		this._register(attachTableStyler(this._restorePlanTable, this._themeService));

		this._register(this._filePathInputBox.onLoseFocus(params => {
			this.onFilePathLoseFocus(params);
		}));

		this._browseFileButton.onDidClick(() => {
			this.onFileBrowserRequested();
		});

		this._register(this._sourceDatabaseSelectBox.onDidSelect(selectedDatabase => {
			this.onSourceDatabaseChanged(selectedDatabase.selected);
		}));

		this._register(this._restoreFromSelectBox.onDidSelect(selectedRestoreFrom => {
			this.onRestoreFromChanged(selectedRestoreFrom.selected);
		}));
	}

	private onFileBrowserRequested(): void {
		this.fileBrowserDialogService.showDialog(this._ownerUri,
			this.viewModel.defaultBackupFolder,
			BackupConstants.fileFiltersSet,
			FileValidationConstants.restore,
			true,
			filepath => this.onFileBrowsed(filepath));
	}

	private onFileBrowsed(filepath: string) {
		const oldFilePath = this._filePathInputBox.value;
		if (strings.isFalsyOrWhitespace(this._filePathInputBox.value)) {
			this._filePathInputBox.value = filepath;
		} else {
			this._filePathInputBox.value = this._filePathInputBox.value + ', ' + filepath;
		}

		if (oldFilePath !== this._filePathInputBox.value) {
			this.onFilePathChanged(this._filePathInputBox.value);
		}
	}

	private onFilePathLoseFocus(params: OnLoseFocusParams) {
		if (params.value) {
			if (params.hasChanged || (this.viewModel.filePath !== params.value)) {
				this.onFilePathChanged(params.value);
			}
		}
	}

	private onFilePathChanged(filePath: string) {
		this.viewModel.filePath = filePath;
		this.viewModel.selectedBackupSets = null;
		this.validateRestore(true);
	}

	private onSourceDatabaseChanged(selectedDatabase: string) {
		this.viewModel.sourceDatabaseName = selectedDatabase;
		this.viewModel.selectedBackupSets = null;
		this.validateRestore(true);
	}

	private onRestoreFromChanged(selectedRestoreFrom: string) {
		this.removeErrorMessage();
		if (selectedRestoreFrom === this._backupFileTitle) {
			this.viewModel.onRestoreFromChanged(true);
			DOM.show(this._restoreFromBackupFileElement);
		} else {
			this.viewModel.onRestoreFromChanged(false);
			DOM.hide(this._restoreFromBackupFileElement);
		}
		this.resetRestoreContent();
	}

	private get isRestoreFromDatabaseSelected(): boolean {
		return this._restoreFromSelectBox.value === this._databaseTitle;
	}

	public validateRestore(overwriteTargetDatabase: boolean = false, isBackupFileCheckboxChanged: boolean = false): void {
		this._isBackupFileCheckboxChanged = isBackupFileCheckboxChanged;
		this.spinner = true;
		this._restoreButton.enabled = false;
		this._scriptButton.enabled = false;
		this._onValidate.fire(overwriteTargetDatabase);
	}

	public restore(isScriptOnly: boolean): void {
		if (this._restoreButton.enabled) {
			this._onRestore.fire(isScriptOnly);
		}
	}

	public hideError() {
		this.setError('');
	}

	/* Overwrite esapce key behavior */
	protected onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.restore(false);
	}

	public cancel() {
		this._onCancel.fire();
		this.close();
	}

	public close() {
		this.resetDialog();
		this.hide();
		this._onCloseEvent.fire();
	}

	private resetDialog(): void {
		this.hideError();
		this._restoreFromSelectBox.selectWithOptionName(this._databaseTitle);
		this.onRestoreFromChanged(this._databaseTitle);
		this._sourceDatabaseSelectBox.select(0);
		this._panel.showTab(this._generalTabId);
		this._isBackupFileCheckboxChanged = false;
		this.removeErrorMessage();
		this.resetRestoreContent();
	}

	public open(serverName: string, ownerUri: string) {
		this.title = this._restoreTitle + ' - ' + serverName;
		this._ownerUri = ownerUri;

		this.show();
		this._restoreFromSelectBox.focus();
	}

	protected layout(height?: number): void {
		// Nothing currently laid out statically in this class
	}

	public dispose(): void {
		super.dispose();
		for (let key in this._optionsMap) {
			let widget: Widget = this._optionsMap[key];
			widget.dispose();
			delete this._optionsMap[key];
		}
	}

	private updateLastBackupTaken(value: string) {
		this._destinationRestoreToInputBox.value = value;
	}

	private updateFilePath(value: string) {
		this._filePathInputBox.value = value;
		if (!value) {
			this._filePathInputBox.hideMessage();
		}
	}

	private updateSourceDatabaseName(databaseNamesParam: SouceDatabaseNamesParam) {
		// Always adding an empty name as the first item so if the selected db name is not in the list,
		// The empty string would be selected and not the first db in the list
		let dbNames: string[] = [];
		if (this.isRestoreFromDatabaseSelected && databaseNamesParam.databaseNames
			&& databaseNamesParam.databaseNames.length > 0 && databaseNamesParam.databaseNames[0] !== '') {
			dbNames = [''].concat(databaseNamesParam.databaseNames);
		} else {
			dbNames = databaseNamesParam.databaseNames;
		}
		this._sourceDatabaseSelectBox.setOptions(dbNames);
		this._sourceDatabaseSelectBox.selectWithOptionName(databaseNamesParam.selectedDatabase);
	}

	private updateTargetDatabaseName(value: string) {
		this._databaseDropdown.value = value;
	}

	private updateRestoreOption(optionParam: RestoreOptionParam) {
		const widget = this._optionsMap[optionParam.optionName];
		if (widget) {
			if (widget instanceof Checkbox) {
				(<Checkbox>widget).checked = optionParam.value;
				this.enableDisableWiget(widget, optionParam.isReadOnly);
			} else if (widget instanceof SelectBox) {
				(<SelectBox>widget).selectWithOptionName(optionParam.value);
				this.enableDisableWiget(widget, optionParam.isReadOnly);
			} else if (widget instanceof InputBox) {
				(<InputBox>widget).value = optionParam.value;
				this.enableDisableWiget(widget, optionParam.isReadOnly);
			}
		}
	}

	private enableDisableWiget(widget: Checkbox | SelectBox | InputBox, isReadOnly: boolean) {
		if (isReadOnly) {
			widget.disable();
		} else {
			widget.enable();
		}
	}

	private updateRestoreDatabaseFiles(dbFiles: azdata.RestoreDatabaseFileInfo[]) {
		this.clearFileListTable();
		if (dbFiles && dbFiles.length > 0) {
			const data = [];
			for (let i = 0; i < dbFiles.length; i++) {
				data[i] = {
					logicalFileName: dbFiles[i].logicalFileName,
					fileType: dbFiles[i].fileType,
					originalFileName: dbFiles[i].originalFileName,
					restoreAs: dbFiles[i].restoreAsFileName
				};
			}
			DOM.show(this._fileListTableContainer);
			this._fileListData.push(data);

			// Set data and Select the first row for the table by default
			this._fileListTable.setData(this._fileListData);
			this._fileListTable.setSelectedRows([0]);
			this._fileListTable.setActiveCell(0, 0);
		}
	}

	private updateBackupSetsToRestore(backupSetsToRestore: azdata.DatabaseFileInfo[]) {
		if (this._isBackupFileCheckboxChanged) {
			const selectedRow = [];
			for (let i = 0; i < backupSetsToRestore.length; i++) {
				if (backupSetsToRestore[i].isSelected) {
					selectedRow.push(i);
				}
			}
			this._restorePlanTable.setSelectedRows(selectedRow);
		} else {
			this.clearRestorePlanDataTable();
			if (backupSetsToRestore && backupSetsToRestore.length > 0) {
				if (!this._restorePlanColumn) {
					const firstRow = backupSetsToRestore[0];
					this._restorePlanColumn = firstRow.properties.map(item => {
						return {
							id: item.propertyName,
							name: item.propertyDisplayName,
							field: item.propertyName
						};
					});

					const checkboxSelectColumn = new CheckboxSelectColumn({ title: this._restoreLabel, toolTip: this._restoreLabel, width: 15 });
					this._restorePlanColumn.unshift(checkboxSelectColumn.getColumnDefinition());
					this._restorePlanTable.columns = this._restorePlanColumn;
					this._restorePlanTable.registerPlugin(checkboxSelectColumn);
					this._restorePlanTable.autosizeColumns();
				}

				const data = [];
				const selectedRow = [];
				for (let i = 0; i < backupSetsToRestore.length; i++) {
					const backupFile = backupSetsToRestore[i];
					const newData = {};
					for (let j = 0; j < backupFile.properties.length; j++) {
						newData[backupFile.properties[j].propertyName] = backupFile.properties[j].propertyValueDisplayName;
					}
					data.push(newData);
					if (backupFile.isSelected) {
						selectedRow.push(i);
					}
				}
				DOM.show(this._restorePlanTableContainer);
				this._restorePlanData.push(data);
				this._restorePlanTable.setSelectedRows(selectedRow);
				this._restorePlanTable.setActiveCell(selectedRow[0], 0);

				if (!this._isRenderedRestorePlanTable) {
					this._isRenderedRestorePlanTable = true;
					this._restorePlanTable.resizeCanvas();
					this._restorePlanTable.autosizeColumns();
				}
			}
		}
	}
}
