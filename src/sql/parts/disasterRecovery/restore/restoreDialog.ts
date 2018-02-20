/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!./media/restoreDialog';
import { Builder, $ } from 'vs/base/browser/builder';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import Event, { Emitter } from 'vs/base/common/event';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Widget } from 'vs/base/browser/ui/widget';
import { MessageType, IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { Button } from 'sql/base/browser/ui/button/button';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { InputBox, OnLoseFocusParams } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { CheckboxSelectColumn } from 'sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin';
import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import * as DialogHelper from 'sql/base/browser/ui/modal/dialogHelper';
import { Modal } from 'sql/base/browser/ui/modal/modal';
import { attachButtonStyler, attachModalDialogStyler, attachTableStyler, attachInputBoxStyler, attachSelectBoxStyler, attachEditableDropdownStyler } from 'sql/common/theme/styler';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as BackupConstants from 'sql/parts/disasterRecovery/backup/constants';
import { RestoreViewModel, RestoreOptionParam, SouceDatabaseNamesParam } from 'sql/parts/disasterRecovery/restore/restoreViewModel';
import * as FileValidationConstants from 'sql/parts/fileBrowser/common/fileValidationServiceConstants';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { TabbedPanel, PanelTabIdentifier } from 'sql/base/browser/ui/panel/panel';
import * as DOM from 'vs/base/browser/dom';
import * as sqlops from 'sqlops';
import * as strings from 'vs/base/common/strings';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';

interface FileListElement {
	logicalFileName: string;
	fileType: string;
	originalFileName: string;
	restoreAs: string;
}

export class RestoreDialog extends Modal {
	public viewModel: RestoreViewModel;

	private _scriptButton: Button;
	private _restoreButton: Button;
	private _closeButton: Button;
	private _optionsMap: { [name: string]: Widget } = {};
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

	private _restorePlanTable: Table<Slick.SlickData>;
	private _restorePlanData: TableDataView<Slick.SlickData>;
	private _restorePlanColumn;

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
		optionsMetadata: sqlops.ServiceOption[],
		@IPartService partService: IPartService,
		@IThemeService private _themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IBootstrapService private _bootstrapService: IBootstrapService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(localize('RestoreDialogTitle', 'Restore database'), TelemetryKeys.Restore, partService, telemetryService, contextKeyService, { hasErrors: true, isWide: true, hasSpinner: true });
		this._restoreTitle = localize('restoreTitle', 'Restore database');
		this._databaseTitle = localize('database', 'Database');
		this._backupFileTitle = localize('backupFile', 'Backup file');
		this._restoreLabel = localize('restore', 'Restore');

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
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		let cancelLabel = localize('cancel', 'Cancel');
		this._scriptButton = this.addFooterButton(localize('script', 'Script'), () => this.restore(true));
		this._restoreButton = this.addFooterButton(this._restoreLabel, () => this.restore(false));
		this._closeButton = this.addFooterButton(cancelLabel, () => this.cancel());
		this.registerListeners();
		this._destinationRestoreToInputBox.disable();
	}

	protected renderBody(container: HTMLElement) {

		let restoreFromElement;
		$().div({ class: 'restore-from' }, (restoreFromContainer) => {
			restoreFromElement = restoreFromContainer.getHTMLElement();
			this.createLabelElement(restoreFromContainer, localize('source', 'Source'), true);
			this._restoreFromSelectBox = this.createSelectBoxHelper(restoreFromContainer, localize('restoreFrom', 'Restore from'), [this._databaseTitle, this._backupFileTitle], this._databaseTitle);
		});

		$().div({ class: 'backup-file-path' }, (filePathContainer) => {
			filePathContainer.hide();
			this._restoreFromBackupFileElement = filePathContainer.getHTMLElement();
			let errorMessage = localize('missingBackupFilePathError', 'Backup file path is required.');
			let validationOptions: IInputOptions = {
				validationOptions: {
					validation: (value: string) => !value ? ({ type: MessageType.ERROR, content: errorMessage }) : null
				},
				placeholder: localize('multipleBackupFilePath', 'Please enter one or more file paths separated by commas')
			};

			filePathContainer.div({ class: 'dialog-input-section' }, (inputContainer) => {
				inputContainer.div({ class: 'dialog-label' }, (labelContainer) => {
					labelContainer.innerHtml(localize('backupFilePath', "Backup file path"));
				});

				inputContainer.div({ class: 'dialog-input' }, (inputCellContainer) => {
					this._filePathInputBox = new InputBox(inputCellContainer.getHTMLElement(), this._contextViewService, validationOptions);
				});

				inputContainer.div({ class: 'file-browser' }, (inputCellContainer) => {
					this._browseFileButton = new Button(inputCellContainer);
					this._browseFileButton.label = '...';
				});
			});
		});

		let sourceDatabasesElement;
		$().div({ class: 'source-database-list' }, (sourceDatabasesContainer) => {
			sourceDatabasesElement = sourceDatabasesContainer.getHTMLElement();
			this._sourceDatabaseSelectBox = this.createSelectBoxHelper(sourceDatabasesContainer, localize('database', 'Database'), [], '');
		});

		// Source section
		let sourceElement: HTMLElement;
		$().div({ class: 'source-section new-section' }, (sourceContainer) => {
			sourceElement = sourceContainer.getHTMLElement();
			sourceContainer.append(restoreFromElement);
			sourceContainer.append(this._restoreFromBackupFileElement);
			sourceContainer.append(sourceDatabasesElement);
		});

		// Destination section
		let destinationElement: HTMLElement;
		$().div({ class: 'destination-section new-section' }, (destinationContainer) => {
			destinationElement = destinationContainer.getHTMLElement();
			this.createLabelElement(destinationContainer, localize('destination', 'Destination'), true);

			destinationContainer.div({ class: 'dialog-input-section' }, (inputContainer) => {
				inputContainer.div({ class: 'dialog-label' }, (labelContainer) => {
					labelContainer.innerHtml(localize('targetDatabase', 'Target database'));
				});

				inputContainer.div({ class: 'dialog-input' }, (inputCellContainer) => {
					// Get the bootstrap params and perform the bootstrap
					inputCellContainer.style('width', '100%');
					this._databaseDropdown = new Dropdown(inputCellContainer.getHTMLElement(), this._contextViewService, this._themeService,
						{
							strictSelection: false
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
				});
			});

			this._destinationRestoreToInputBox = this.createInputBoxHelper(destinationContainer, localize('restoreTo', 'Restore to'));
		});


		// Restore plan section
		let restorePlanElement: HTMLElement;
		$().div({ class: 'restore-plan-section new-section' }, (restorePlanContainer) => {
			restorePlanElement = restorePlanContainer.getHTMLElement();
			this.createLabelElement(restorePlanContainer, localize('restorePlan', 'Restore plan'), true);
			this.createLabelElement(restorePlanContainer, localize('backupSetsToRestore', 'Backup sets to restore'));

			// Backup sets table
			restorePlanContainer.div({ class: 'dialog-input-section restore-list' }, (labelContainer) => {
				this._restorePlanData = new TableDataView<Slick.SlickData>();
				this._restorePlanTable = new Table<Slick.SlickData>(labelContainer.getHTMLElement(), this._restorePlanData, this._restorePlanColumn, { enableColumnReorder: false });
				this._restorePlanTable.setSelectionModel(new RowSelectionModel({ selectActiveRow: false }));
				this._restorePlanTable.onSelectedRowsChanged((e, data) => this.backupFileCheckboxChanged(e, data));
			});
		});

		// Content in general tab
		let generalTab = $('.restore-dialog');
		generalTab.append(sourceElement);
		generalTab.append(destinationElement);
		generalTab.append(restorePlanElement);

		// Content in file tab
		let fileContentElement: HTMLElement;
		$().div({ class: 'restore-dialog' }, (builder) => {
			fileContentElement = builder.getHTMLElement();

			// Restore database file as section
			builder.div({ class: 'new-section' }, (sectionContainer) => {
				this.createLabelElement(sectionContainer, localize('restoreDatabaseFileAs', 'Restore database files as'), true);
				this.createOptionControl(sectionContainer, this._relocateDatabaseFilesOption);
				sectionContainer.div({ class: 'sub-section' }, (subSectionContainer) => {
					this.createOptionControl(subSectionContainer, this._relocatedDataFileFolderOption);
					this.createOptionControl(subSectionContainer, this._relocatedLogFileFolderOption);
				});
			});

			// Restore database file details section
			builder.div({ class: 'new-section' }, (sectionContainer) => {
				this.createLabelElement(sectionContainer, localize('restoreDatabaseFileDetails', 'Restore database file details'), true);
				// file list table
				sectionContainer.div({ class: 'dialog-input-section restore-list' }, (fileNameContainer) => {
					let logicalFileName = localize('logicalFileName', 'Logical file Name');
					let fileType = localize('fileType', 'File type');
					let originalFileName = localize('originalFileName', 'Original File Name');
					let restoreAs = localize('restoreAs', 'Restore as');
					var columns = [{
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
					this._fileListTable = new Table<FileListElement>(fileNameContainer.getHTMLElement(), this._fileListData, columns, { enableColumnReorder: false });
					this._fileListTable.setSelectionModel(new RowSelectionModel());
				});
			});
		});

		// Content in options tab
		let optionsContentElement: HTMLElement;
		$().div({ class: 'restore-dialog' }, (builder) => {
			optionsContentElement = builder.getHTMLElement();

			// Restore options section
			builder.div({ class: 'new-section' }, (sectionContainer) => {
				this.createLabelElement(sectionContainer, localize('restoreOptions', 'Restore options'), true);
				this.createOptionControl(sectionContainer, this._withReplaceDatabaseOption);
				this.createOptionControl(sectionContainer, this._withKeepReplicationOption);
				this.createOptionControl(sectionContainer, this._withRestrictedUserOption);
				this.createOptionControl(sectionContainer, this._recoveryStateOption);

				sectionContainer.div({ class: 'sub-section' }, (subSectionContainer) => {
					this.createOptionControl(subSectionContainer, this._standbyFileOption);
				});
			});

			// Tail-Log backup section
			builder.div({ class: 'new-section' }, (sectionContainer) => {
				this.createLabelElement(sectionContainer, localize('taillogBackup', 'Tail-Log backup'), true);
				this.createOptionControl(sectionContainer, this._takeTaillogBackupOption);
				sectionContainer.div({ class: 'sub-section' }, (subSectionContainer) => {
					this.createOptionControl(subSectionContainer, this._tailLogWithNoRecoveryOption);
					this.createOptionControl(subSectionContainer, this._tailLogBackupFileOption);
				});
			});

			// Server connections section
			builder.div({ class: 'new-section' }, (sectionContainer) => {
				this.createLabelElement(sectionContainer, localize('serverConnection', 'Server connections'), true);
				this.createOptionControl(sectionContainer, this._closeExistingConnectionsOption);
			});
		});

		let restorePanel = $('.restore-panel');
		container.appendChild(restorePanel.getHTMLElement());
		this._panel = new TabbedPanel(restorePanel.getHTMLElement());
		this._generalTabId = this._panel.pushTab({
			identifier: 'general',
			title: localize('generalTitle', 'General'),
			view: {
				render: c => {
					generalTab.appendTo(c);
				},
				layout: () => { }
			}
		});

		let fileTab = this._panel.pushTab({
			identifier: 'fileContent',
			title: localize('filesTitle', 'Files'),
			view: {
				layout: () => { },
				render: c => {
					c.appendChild(fileContentElement);
				}
			}
		});

		this._panel.pushTab({
			identifier: 'options',
			title: localize('optionsTitle', 'Options'),
			view: {
				layout: () => { },
				render: c => {
					c.appendChild(optionsContentElement);
				}
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

	private createLabelElement(container: Builder, content: string, isHeader?: boolean) {
		let className = 'dialog-label';
		if (isHeader) {
			className += ' header';
		}
		container.div({ class: className }, (labelContainer) => {
			labelContainer.innerHtml(content);
		});
	}

	private createOptionControl(container: Builder, optionName: string): void {
		let option = this.viewModel.getOptionMetadata(optionName);
		let propertyWidget: any;
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

	private createCheckBoxHelper(container: Builder, label: string, isChecked: boolean, onCheck: (viaKeyboard: boolean) => void): Checkbox {
		let checkbox: Checkbox;
		container.div({ class: 'dialog-input-section' }, (inputCellContainer) => {
			checkbox = new Checkbox(inputCellContainer.getHTMLElement(), {
				label: label,
				checked: isChecked,
				onChange: onCheck
			});
		});
		return checkbox;
	}

	private createSelectBoxHelper(container: Builder, label: string, options: string[], selectedOption: string): SelectBox {
		let selectBox: SelectBox;
		container.div({ class: 'dialog-input-section' }, (inputContainer) => {
			inputContainer.div({ class: 'dialog-label' }, (labelContainer) => {
				labelContainer.innerHtml(label);
			});

			inputContainer.div({ class: 'dialog-input' }, (inputCellContainer) => {
				selectBox = new SelectBox(options, selectedOption, inputCellContainer.getHTMLElement(), this._contextViewService);
				selectBox.render(inputCellContainer.getHTMLElement());
			});
		});
		return selectBox;
	}

	private createInputBoxHelper(container: Builder, label: string, options?: IInputOptions): InputBox {
		let inputBox: InputBox;
		container.div({ class: 'dialog-input-section' }, (inputContainer) => {
			inputContainer.div({ class: 'dialog-label' }, (labelContainer) => {
				labelContainer.innerHtml(label);
			});

			inputContainer.div({ class: 'dialog-input' }, (inputCellContainer) => {
				inputBox = new InputBox(inputCellContainer.getHTMLElement(), this._contextViewService, options);
			});
		});
		return inputBox;
	}

	private resetRestoreContent(): void {
		this._restorePlanData.clear();
		this._fileListData.clear();
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
		this.hideSpinner();
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
		this._bootstrapService.fileBrowserDialogService.showDialog(this._ownerUri,
			this.viewModel.defaultBackupFolder,
			BackupConstants.fileFiltersSet,
			FileValidationConstants.restore,
			true,
			filepath => this.onFileBrowsed(filepath));
	}

	private onFileBrowsed(filepath: string) {
		var oldFilePath = this._filePathInputBox.value;
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
			new Builder(this._restoreFromBackupFileElement).show();
		} else {
			this.viewModel.onRestoreFromChanged(false);
			new Builder(this._restoreFromBackupFileElement).hide();
		}
		this.resetRestoreContent();
	}

	private get isRestoreFromDatabaseSelected(): boolean {
		return this._restoreFromSelectBox.value === this._databaseTitle;
	}

	public validateRestore(overwriteTargetDatabase: boolean = false, isBackupFileCheckboxChanged: boolean = false): void {
		this._isBackupFileCheckboxChanged = isBackupFileCheckboxChanged;
		this.showSpinner();
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
		for (var key in this._optionsMap) {
			var widget: Widget = this._optionsMap[key];
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
		let widget = this._optionsMap[optionParam.optionName];
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

	private updateRestoreDatabaseFiles(dbFiles: sqlops.RestoreDatabaseFileInfo[]) {
		this._fileListData.clear();
		if (dbFiles) {
			let data = [];
			for (let i = 0; i < dbFiles.length; i++) {
				data[i] = {
					logicalFileName: dbFiles[i].logicalFileName,
					fileType: dbFiles[i].fileType,
					originalFileName: dbFiles[i].originalFileName,
					restoreAs: dbFiles[i].restoreAsFileName
				};
			}

			this._fileListData.push(data);

			// Select the first row for the table by default
			this._fileListTable.setSelectedRows([0]);
			this._fileListTable.setActiveCell(0, 0);
		}
	}

	private updateBackupSetsToRestore(backupSetsToRestore: sqlops.DatabaseFileInfo[]) {
		if (this._isBackupFileCheckboxChanged) {
			let selectedRow = [];
			for (let i = 0; i < backupSetsToRestore.length; i++) {
				if (backupSetsToRestore[i].isSelected) {
					selectedRow.push(i);
				}
			}
			this._restorePlanTable.setSelectedRows(selectedRow);
		} else {
			this._restorePlanData.clear();
			if (backupSetsToRestore && backupSetsToRestore.length > 0) {
				if (!this._restorePlanColumn) {
					let firstRow = backupSetsToRestore[0];
					this._restorePlanColumn = firstRow.properties.map(item => {
						return {
							id: item.propertyName,
							name: item.propertyDisplayName,
							field: item.propertyName
						};
					});

					let checkboxSelectColumn = new CheckboxSelectColumn({ title: this._restoreLabel, toolTip: this._restoreLabel, width: 15 });
					this._restorePlanColumn.unshift(checkboxSelectColumn.getColumnDefinition());
					this._restorePlanTable.columns = this._restorePlanColumn;
					this._restorePlanTable.registerPlugin(checkboxSelectColumn);
					this._restorePlanTable.autosizeColumns();
				}

				let data = [];
				let selectedRow = [];
				for (let i = 0; i < backupSetsToRestore.length; i++) {
					let backupFile = backupSetsToRestore[i];
					let newData = {};
					for (let j = 0; j < backupFile.properties.length; j++) {
						newData[backupFile.properties[j].propertyName] = backupFile.properties[j].propertyValueDisplayName;
					}
					data.push(newData);
					if (backupFile.isSelected) {
						selectedRow.push(i);
					}
				}
				this._restorePlanData.push(data);
				this._restorePlanTable.setSelectedRows(selectedRow);
				this._restorePlanTable.setActiveCell(selectedRow[0], 0);
			}
		}
	}
}