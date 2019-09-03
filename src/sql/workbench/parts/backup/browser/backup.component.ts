/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/backupDialog';

import { ElementRef, Component, Inject, forwardRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Button } from 'sql/base/browser/ui/button/button';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { ListBox } from 'sql/base/browser/ui/listBox/listBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachButtonStyler, attachListBoxStyler, attachInputBoxStyler, attachSelectBoxStyler, attachCheckboxStyler } from 'sql/platform/theme/common/styler';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import * as BackupConstants from 'sql/workbench/parts/backup/common/constants';
import { IBackupService, TaskExecutionMode } from 'sql/platform/backup/common/backupService';
import * as FileValidationConstants from 'sql/workbench/services/fileBrowser/common/fileValidationServiceConstants';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';
import * as cr from 'vs/platform/theme/common/colorRegistry';

import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { localize } from 'vs/nls';
import * as types from 'vs/base/common/types';
import * as strings from 'vs/base/common/strings';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ISelectOptionItem } from 'vs/base/browser/ui/selectBox/selectBox';
import { KeyCode } from 'vs/base/common/keyCodes';
import { ITheme } from 'vs/platform/theme/common/themeService';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';

export const BACKUP_SELECTOR: string = 'backup-component';

export class RestoreItemSource {
	restoreItemLocation: string;
	restoreItemDeviceType: number;
	isLogicalDevice: boolean;

	constructor(location: any) {
		this.restoreItemDeviceType = location.restoreItemDeviceType;
		this.restoreItemLocation = location.restoreItemLocation;
		this.isLogicalDevice = location.isLogicalDevice;
	}
}

interface MssqlBackupInfo {
	ownerUri: string;
	databaseName: string;
	backupType: number;
	backupComponent: number;
	backupDeviceType: number;
	selectedFiles: string;
	backupsetName: string;
	selectedFileGroup: { [path: string]: string };

	// List of {key: backup path, value: device type}
	backupPathDevices: { [path: string]: number };
	backupPathList: [string];
	isCopyOnly: boolean;
	formatMedia: boolean;
	initialize: boolean;
	skipTapeHeader: boolean;
	mediaName: string;
	mediaDescription: string;
	checksum: boolean;
	continueAfterError: boolean;
	logTruncation: boolean;
	tailLogBackup: boolean;
	retainDays: number;
	compressionOption: number;
	verifyBackupRequired: boolean;
	encryptionAlgorithm: number;
	encryptorType: number;
	encryptorName: string;
}

const LocalizedStrings = {
	BACKUP_NAME: localize('backup.backupName', "Backup name"),
	RECOVERY_MODEL: localize('backup.recoveryModel', "Recovery model"),
	BACKUP_TYPE: localize('backup.backupType', "Backup type"),
	BACKUP_DEVICE: localize('backup.backupDevice', "Backup files"),
	ALGORITHM: localize('backup.algorithm', "Algorithm"),
	CERTIFICATE_OR_ASYMMETRIC_KEY: localize('backup.certificateOrAsymmetricKey', "Certificate or Asymmetric key"),
	MEDIA: localize('backup.media', "Media"),
	MEDIA_OPTION: localize('backup.mediaOption', "Backup to the existing media set"),
	MEDIA_OPTION_FORMAT: localize('backup.mediaOptionFormat', "Backup to a new media set"),
	EXISTING_MEDIA_APPEND: localize('backup.existingMediaAppend', "Append to the existing backup set"),
	EXISTING_MEDIA_OVERWRITE: localize('backup.existingMediaOverwrite', "Overwrite all existing backup sets"),
	NEW_MEDIA_SET_NAME: localize('backup.newMediaSetName', "New media set name"),
	NEW_MEDIA_SET_DESCRIPTION: localize('backup.newMediaSetDescription', "New media set description"),
	CHECKSUM_CONTAINER: localize('backup.checksumContainer', "Perform checksum before writing to media"),
	VERIFY_CONTAINER: localize('backup.verifyContainer', "Verify backup when finished"),
	CONTINUE_ON_ERROR_CONTAINER: localize('backup.continueOnErrorContainer', "Continue on error"),
	EXPIRATION: localize('backup.expiration', "Expiration"),
	SET_BACKUP_RETAIN_DAYS: localize('backup.setBackupRetainDays', "Set backup retain days"),
	COPY_ONLY: localize('backup.copyOnly', "Copy-only backup"),
	ADVANCED_CONFIGURATION: localize('backup.advancedConfiguration', "Advanced Configuration"),
	COMPRESSION: localize('backup.compression', "Compression"),
	SET_BACKUP_COMPRESSION: localize('backup.setBackupCompression', "Set backup compression"),
	ENCRYPTION: localize('backup.encryption', "Encryption"),
	TRANSACTION_LOG: localize('backup.transactionLog', "Transaction log"),
	TRUNCATE_TRANSACTION_LOG: localize('backup.truncateTransactionLog', "Truncate the transaction log"),
	BACKUP_TAIL: localize('backup.backupTail', "Backup the tail of the log"),
	RELIABILITY: localize('backup.reliability', "Reliability"),
	MEDIA_NAME_REQUIRED_ERROR: localize('backup.mediaNameRequired', "Media name is required"),
	NO_ENCRYPTOR_WARNING: localize('backup.noEncryptorWarning', "No certificate or asymmetric key is available")
};

@Component({
	selector: BACKUP_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./backup.component.html'))
})
export class BackupComponent extends AngularDisposable {
	@ViewChild('pathContainer', { read: ElementRef }) pathElement;
	@ViewChild('backupTypeContainer', { read: ElementRef }) backupTypeElement;
	@ViewChild('backupsetName', { read: ElementRef }) backupNameElement;
	@ViewChild('compressionContainer', { read: ElementRef }) compressionElement;
	@ViewChild('tlogOption', { read: ElementRef }) tlogOptionElement;
	@ViewChild('algorithmContainer', { read: ElementRef }) encryptionAlgorithmElement;
	@ViewChild('encryptorContainer', { read: ElementRef }) encryptorElement;
	@ViewChild('mediaName', { read: ElementRef }) mediaNameElement;
	@ViewChild('mediaDescription', { read: ElementRef }) mediaDescriptionElement;
	@ViewChild('recoveryModelContainer', { read: ElementRef }) recoveryModelElement;
	@ViewChild('backupDaysContainer', { read: ElementRef }) backupDaysElement;
	@ViewChild('backupButtonContainer', { read: ElementRef }) backupButtonElement;
	@ViewChild('cancelButtonContainer', { read: ElementRef }) cancelButtonElement;
	@ViewChild('addPathContainer', { read: ElementRef }) addPathElement;
	@ViewChild('removePathContainer', { read: ElementRef }) removePathElement;
	@ViewChild('copyOnlyContainer', { read: ElementRef }) copyOnlyElement;
	@ViewChild('encryptCheckContainer', { read: ElementRef }) encryptElement;
	@ViewChild('encryptContainer', { read: ElementRef }) encryptContainerElement;
	@ViewChild('verifyContainer', { read: ElementRef }) verifyElement;
	@ViewChild('checksumContainer', { read: ElementRef }) checksumElement;
	@ViewChild('continueOnErrorContainer', { read: ElementRef }) continueOnErrorElement;
	@ViewChild('encryptWarningContainer', { read: ElementRef }) encryptWarningElement;
	@ViewChild('inProgressContainer', { read: ElementRef }) inProgressElement;
	@ViewChild('modalFooterContainer', { read: ElementRef }) modalFooterElement;
	@ViewChild('scriptButtonContainer', { read: ElementRef }) scriptButtonElement;
	@ViewChild('advancedOptionContainer', { read: ElementRef }) advancedOptionElement;
	@ViewChild('advancedOptionBodyContainer', { read: ElementRef }) advancedOptionBodyElement;

	private localizedStrings = LocalizedStrings;

	private _uri: string;
	private _advancedHeaderSize = 32;

	private connection: IConnectionProfile;
	private databaseName: string;
	private defaultNewBackupFolder: string;
	private recoveryModel: string;
	private backupEncryptors;
	private containsBackupToUrl: boolean;

	// UI element disable flag
	private disableFileComponent: boolean;
	private disableTlog: boolean;

	private selectedBackupComponent: string;
	private selectedFilesText: string;
	private selectedInitOption: string;
	private isTruncateChecked: boolean;
	private isTaillogChecked: boolean;
	private isFormatChecked: boolean;
	private isEncryptChecked: boolean;
	// Key: backup path, Value: device type
	private backupPathTypePairs: { [path: string]: number };

	private compressionOptions = [BackupConstants.defaultCompression, BackupConstants.compressionOn, BackupConstants.compressionOff];
	private encryptionAlgorithms = [BackupConstants.aes128, BackupConstants.aes192, BackupConstants.aes256, BackupConstants.tripleDES];
	private existingMediaOptions = ['append', 'overwrite'];
	private backupTypeOptions: string[];

	private backupTypeSelectBox: SelectBox;
	private backupNameBox: InputBox;
	private recoveryBox: InputBox;
	private backupRetainDaysBox: InputBox;
	private backupButton: Button;
	private cancelButton: Button;
	private scriptButton: Button;
	private addPathButton: Button;
	private removePathButton: Button;
	private pathListBox: ListBox;
	private compressionSelectBox: SelectBox;
	private algorithmSelectBox: SelectBox;
	private encryptorSelectBox: SelectBox;
	private mediaNameBox: InputBox;
	private mediaDescriptionBox: InputBox;
	private copyOnlyCheckBox: Checkbox;
	private encryptCheckBox: Checkbox;
	private verifyCheckBox: Checkbox;
	private checksumCheckBox: Checkbox;
	private continueOnErrorCheckBox: Checkbox;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeDetectorRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IFileBrowserDialogController) private fileBrowserDialogService: IFileBrowserDialogController,
		@Inject(IBackupUiService) private _backupUiService: IBackupUiService,
		@Inject(IBackupService) private _backupService: IBackupService,
		@Inject(IClipboardService) private clipboardService: IClipboardService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService
	) {
		super();
		this._backupUiService.onShowBackupEvent((param) => this.onGetBackupConfigInfo(param));
	}

	ngOnInit() {
		let self = this;
		this.addFooterButtons();

		this.recoveryBox = new InputBox(this.recoveryModelElement.nativeElement, this.contextViewService, {
			placeholder: this.recoveryModel,
			ariaLabel: LocalizedStrings.RECOVERY_MODEL
		});
		// Set backup type
		this.backupTypeSelectBox = new SelectBox([], '', this.contextViewService, undefined, { ariaLabel: this.localizedStrings.BACKUP_TYPE });
		this.backupTypeSelectBox.render(this.backupTypeElement.nativeElement);

		// Set copy-only check box
		this.copyOnlyCheckBox = new Checkbox(this.copyOnlyElement.nativeElement, {
			label: LocalizedStrings.COPY_ONLY,
			checked: false,
			onChange: (viaKeyboard) => { },
			ariaLabel: LocalizedStrings.COPY_ONLY
		});

		// Encryption checkbox
		this.encryptCheckBox = new Checkbox(this.encryptElement.nativeElement, {
			label: LocalizedStrings.ENCRYPTION,
			checked: false,
			onChange: (viaKeyboard) => self.onChangeEncrypt(),
			ariaLabel: LocalizedStrings.ENCRYPTION
		});

		// Verify backup checkbox
		this.verifyCheckBox = new Checkbox(this.verifyElement.nativeElement, {
			label: LocalizedStrings.VERIFY_CONTAINER,
			checked: false,
			onChange: (viaKeyboard) => { },
			ariaLabel: LocalizedStrings.VERIFY_CONTAINER
		});

		// Perform checksum checkbox
		this.checksumCheckBox = new Checkbox(this.checksumElement.nativeElement, {
			label: LocalizedStrings.CHECKSUM_CONTAINER,
			checked: false,
			onChange: (viaKeyboard) => { },
			ariaLabel: LocalizedStrings.CHECKSUM_CONTAINER
		});

		// Continue on error checkbox
		this.continueOnErrorCheckBox = new Checkbox(this.continueOnErrorElement.nativeElement, {
			label: LocalizedStrings.CONTINUE_ON_ERROR_CONTAINER,
			checked: false,
			onChange: (viaKeyboard) => { },
			ariaLabel: LocalizedStrings.CONTINUE_ON_ERROR_CONTAINER
		});

		// Set backup name
		this.backupNameBox = new InputBox(this.backupNameElement.nativeElement, this.contextViewService, {
			ariaLabel: LocalizedStrings.BACKUP_NAME
		});

		// Set backup path list
		this.pathListBox = new ListBox([], this.contextViewService);
		this.pathListBox.setAriaLabel(LocalizedStrings.BACKUP_DEVICE);
		this.pathListBox.onKeyDown(e => {
			if (this.pathListBox.selectedOptions.length > 0) {
				const key = e.keyCode;
				const ctrlOrCmd = e.ctrlKey || e.metaKey;

				if (ctrlOrCmd && key === KeyCode.KEY_C) {
					let textToCopy = this.pathListBox.selectedOptions[0];
					for (let i = 1; i < this.pathListBox.selectedOptions.length; i++) {
						textToCopy = textToCopy + ', ' + this.pathListBox.selectedOptions[i];
					}

					// Copy to clipboard
					this.clipboardService.writeText(textToCopy);

					e.stopPropagation();
				}
			}
		});
		this.pathListBox.render(this.pathElement.nativeElement);

		// Set backup path add/remove buttons
		this.addPathButton = this._register(new Button(this.addPathElement.nativeElement));
		this.addPathButton.label = '+';
		this.addPathButton.title = localize('addFile', "Add a file");

		this.removePathButton = this._register(new Button(this.removePathElement.nativeElement));
		this.removePathButton.label = '-';
		this.removePathButton.title = localize('removeFile', "Remove files");

		// Set compression
		this.compressionSelectBox = this._register(new SelectBox(this.compressionOptions, this.compressionOptions[0], this.contextViewService, undefined, { ariaLabel: this.localizedStrings.SET_BACKUP_COMPRESSION }));
		this.compressionSelectBox.render(this.compressionElement.nativeElement);

		// Set encryption
		this.algorithmSelectBox = this._register(new SelectBox(this.encryptionAlgorithms, this.encryptionAlgorithms[0], this.contextViewService, undefined, { ariaLabel: this.localizedStrings.ALGORITHM }));
		this.algorithmSelectBox.render(this.encryptionAlgorithmElement.nativeElement);
		this.encryptorSelectBox = this._register(new SelectBox([], '', this.contextViewService, undefined, { ariaLabel: this.localizedStrings.CERTIFICATE_OR_ASYMMETRIC_KEY }));
		this.encryptorSelectBox.render(this.encryptorElement.nativeElement);

		// Set media
		this.mediaNameBox = this._register(new InputBox(this.mediaNameElement.nativeElement,
			this.contextViewService,
			{
				validationOptions: {
					validation: (value: string) => !value ? ({ type: MessageType.ERROR, content: LocalizedStrings.MEDIA_NAME_REQUIRED_ERROR }) : null
				},
				ariaLabel: LocalizedStrings.NEW_MEDIA_SET_NAME
			}
		));

		this.mediaDescriptionBox = this._register(new InputBox(this.mediaDescriptionElement.nativeElement, this.contextViewService, {
			ariaLabel: LocalizedStrings.NEW_MEDIA_SET_DESCRIPTION
		}));

		// Set backup retain days
		let invalidInputMessage = localize('backupComponent.invalidInput', "Invalid input. Value must be greater than or equal 0.");
		this.backupRetainDaysBox = this._register(new InputBox(this.backupDaysElement.nativeElement,
			this.contextViewService,
			{
				placeholder: '0',
				type: 'number',
				min: '0',
				validationOptions: {
					validation: (value: string) => {
						if (types.isNumber(Number(value)) && Number(value) < 0) {
							return { type: MessageType.ERROR, content: invalidInputMessage };
						} else {
							return null;
						}
					}
				},
				ariaLabel: LocalizedStrings.SET_BACKUP_RETAIN_DAYS
			}));

		// Disable elements
		this.recoveryBox.disable();
		this.mediaNameBox.disable();
		this.mediaDescriptionBox.disable();

		this.registerListeners();
		this.updateTheme(this.themeService.getTheme());
	}

	ngAfterViewInit() {
		this._backupUiService.onShowBackupDialog();
	}

	private onGetBackupConfigInfo(param: { connection: IConnectionProfile, ownerUri: string }) {
		// Show spinner
		this.showSpinner();
		this.backupEnabled = false;

		// Reset backup values
		this.backupNameBox.value = '';
		this.pathListBox.setOptions([], 0);

		this.connection = param.connection;
		this._uri = param.ownerUri;

		// Get backup configuration info
		this._backupService.getBackupConfigInfo(this._uri).then(configInfo => {
			if (configInfo) {
				this.defaultNewBackupFolder = configInfo.defaultBackupFolder;
				this.recoveryModel = configInfo.recoveryModel;
				this.backupEncryptors = configInfo.backupEncryptors;
				this.initialize(true);
			} else {
				this.initialize(false);
			}
			// Hide spinner
			this.hideSpinner();
		});
	}

	/**
	 * Show spinner in the backup dialog
	 */
	private showSpinner(): void {
		this.inProgressElement.nativeElement.style.visibility = 'visible';
	}

	/**
	 * Hide spinner in the backup dialog
	 */
	private hideSpinner(): void {
		this.inProgressElement.nativeElement.style.visibility = 'hidden';
	}

	private addFooterButtons(): void {
		// Set script footer button
		this.scriptButton = this._register(new Button(this.scriptButtonElement.nativeElement));
		this.scriptButton.label = localize('backupComponent.script', "Script");
		this.addButtonClickHandler(this.scriptButton, () => this.onScript());
		this._register(attachButtonStyler(this.scriptButton, this.themeService));
		this.scriptButton.enabled = false;

		// Set backup footer button
		this.backupButton = this._register(new Button(this.backupButtonElement.nativeElement));
		this.backupButton.label = localize('backupComponent.backup', "Backup");
		this.addButtonClickHandler(this.backupButton, () => this.onOk());
		this._register(attachButtonStyler(this.backupButton, this.themeService));
		this.backupEnabled = false;

		// Set cancel footer button
		this.cancelButton = this._register(new Button(this.cancelButtonElement.nativeElement));
		this.cancelButton.label = localize('backupComponent.cancel', "Cancel");
		this.addButtonClickHandler(this.cancelButton, () => this.onCancel());
		this._register(attachButtonStyler(this.cancelButton, this.themeService));
	}

	private initialize(isMetadataPopulated: boolean): void {

		this.databaseName = this.connection.databaseName;
		this.selectedBackupComponent = BackupConstants.labelDatabase;
		this.backupPathTypePairs = {};
		this.isFormatChecked = false;
		this.isEncryptChecked = false;
		this.selectedInitOption = this.existingMediaOptions[0];
		this.backupTypeOptions = [];

		if (isMetadataPopulated) {
			this.backupEnabled = true;

			// Set recovery model
			this.setControlsForRecoveryModel();

			// Set backup type
			this.backupTypeSelectBox.setOptions(this.backupTypeOptions, 0);

			this.setDefaultBackupName();
			this.backupNameBox.focus();

			// Set backup path list
			this.setDefaultBackupPaths();
			let pathlist: ISelectOptionItem[] = [];
			for (let i in this.backupPathTypePairs) {
				pathlist.push({ text: i });
			}
			this.pathListBox.setOptions(pathlist, 0);

			// Set encryption
			let encryptorItems = this.populateEncryptorCombo();
			this.encryptorSelectBox.setOptions(encryptorItems, 0);

			if (encryptorItems.length === 0) {
				// Disable encryption checkbox
				this.encryptCheckBox.disable();

				// Show warning instead of algorithm select boxes
				(<HTMLElement>this.encryptWarningElement.nativeElement).style.display = 'inline';
				(<HTMLElement>this.encryptContainerElement.nativeElement).style.display = 'none';
			}
			else {
				// Show algorithm select boxes instead of warning
				(<HTMLElement>this.encryptWarningElement.nativeElement).style.display = 'none';
				(<HTMLElement>this.encryptContainerElement.nativeElement).style.display = 'inline';

				// Disable the algorithm select boxes since encryption is not checked by default
				this.setEncryptOptionsEnabled(false);
			}

			this.setTLogOptions();

			// disable elements
			this.recoveryBox.disable();
			this.mediaNameBox.disable();
			this.mediaDescriptionBox.disable();
			this.recoveryBox.value = this.recoveryModel;

			// show warning message if latest backup file path contains url
			if (this.containsBackupToUrl) {
				this.pathListBox.setValidation(false, { content: localize('backup.containsBackupToUrlError', "Only backup to file is supported"), type: MessageType.WARNING });
				this.pathListBox.focus();
			}
		}

		this._changeDetectorRef.detectChanges();
	}

	/**
	 * Reset dialog controls to their initial state.
	 */
	private resetDialog(): void {
		this.isFormatChecked = false;
		this.isEncryptChecked = false;

		this.copyOnlyCheckBox.checked = false;
		this.copyOnlyCheckBox.enable();
		this.compressionSelectBox.setOptions(this.compressionOptions, 0);
		this.encryptCheckBox.checked = false;
		this.encryptCheckBox.enable();
		this.onChangeEncrypt();

		this.mediaNameBox.value = '';
		this.mediaDescriptionBox.value = '';
		this.checksumCheckBox.checked = false;
		this.verifyCheckBox.checked = false;
		this.continueOnErrorCheckBox.checked = false;
		this.backupRetainDaysBox.value = '0';
		this.algorithmSelectBox.setOptions(this.encryptionAlgorithms, 0);
		this.selectedInitOption = this.existingMediaOptions[0];
		this.containsBackupToUrl = false;
		this.pathListBox.setValidation(true);

		this.cancelButton.applyStyles();
		this.scriptButton.applyStyles();
		this.backupButton.applyStyles();
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachInputBoxStyler(this.backupNameBox, this.themeService));
		this._register(attachInputBoxStyler(this.recoveryBox, this.themeService));
		this._register(attachSelectBoxStyler(this.backupTypeSelectBox, this.themeService));
		this._register(attachListBoxStyler(this.pathListBox, this.themeService));
		this._register(attachButtonStyler(this.addPathButton, this.themeService));
		this._register(attachButtonStyler(this.removePathButton, this.themeService));
		this._register(attachSelectBoxStyler(this.compressionSelectBox, this.themeService));
		this._register(attachSelectBoxStyler(this.algorithmSelectBox, this.themeService));
		this._register(attachSelectBoxStyler(this.encryptorSelectBox, this.themeService));
		this._register(attachInputBoxStyler(this.mediaNameBox, this.themeService));
		this._register(attachInputBoxStyler(this.mediaDescriptionBox, this.themeService));
		this._register(attachInputBoxStyler(this.backupRetainDaysBox, this.themeService));
		this._register(attachCheckboxStyler(this.copyOnlyCheckBox, this.themeService));
		this._register(attachCheckboxStyler(this.encryptCheckBox, this.themeService));
		this._register(attachCheckboxStyler(this.verifyCheckBox, this.themeService));
		this._register(attachCheckboxStyler(this.checksumCheckBox, this.themeService));
		this._register(attachCheckboxStyler(this.continueOnErrorCheckBox, this.themeService));

		this._register(this.backupTypeSelectBox.onDidSelect(selected => this.onBackupTypeChanged()));
		this.addButtonClickHandler(this.addPathButton, () => this.onAddClick());
		this.addButtonClickHandler(this.removePathButton, () => this.onRemoveClick());
		this._register(this.mediaNameBox.onDidChange(mediaName => {
			this.mediaNameChanged(mediaName);
		}));
		this._register(this.backupRetainDaysBox.onDidChange(days => {
			this.backupRetainDaysChanged(days);
		}));

		this._register(this.themeService.onDidColorThemeChange(e => this.updateTheme(e)));
	}

	// Update theming that is specific to backup dialog
	private updateTheme(theme: ITheme): void {
		// set modal footer style
		let footerHtmlElement: HTMLElement = <HTMLElement>this.modalFooterElement.nativeElement;
		const backgroundColor = theme.getColor(SIDE_BAR_BACKGROUND);
		const border = theme.getColor(cr.contrastBorder) ? theme.getColor(cr.contrastBorder).toString() : null;
		const footerBorderTopWidth = border ? '1px' : null;
		const footerBorderTopStyle = border ? 'solid' : null;
		footerHtmlElement.style.backgroundColor = backgroundColor ? backgroundColor.toString() : null;
		footerHtmlElement.style.borderTopWidth = footerBorderTopWidth;
		footerHtmlElement.style.borderTopStyle = footerBorderTopStyle;
		footerHtmlElement.style.borderTopColor = border;
	}

	private addButtonClickHandler(button: Button, handler: () => void) {
		if (button && handler) {
			button.onDidClick(() => {
				if (button.enabled) {
					handler();
				}
			});
		}
	}

	/*
	* UI event handlers
	*/
	private onScript(): void {
		this._backupService.backup(this._uri, this.createBackupInfo(), TaskExecutionMode.script);
		this.close();
	}

	private onOk(): void {
		this._backupService.backup(this._uri, this.createBackupInfo(), TaskExecutionMode.executeAndScript);
		this.close();
	}

	private onCancel(): void {
		this.close();
		this.connectionManagementService.disconnect(this._uri);
	}

	private close(): void {
		this._backupUiService.closeBackup();
		this.resetDialog();
	}

	private onChangeTlog(): void {
		this.isTruncateChecked = !this.isTruncateChecked;
		this.isTaillogChecked = !this.isTaillogChecked;
		this.detectChange();
	}

	private onChangeEncrypt(): void {
		if (this.encryptCheckBox.checked) {
			this.setEncryptOptionsEnabled(true);

			// Force to choose format media option since otherwise encryption cannot be done
			if (!this.isFormatChecked) {
				this.onChangeMediaFormat();
			}
		} else {
			this.setEncryptOptionsEnabled(false);
		}
		this.isEncryptChecked = this.encryptCheckBox.checked;
		this.detectChange();
	}

	private onChangeMediaFormat(): void {
		this.isFormatChecked = !this.isFormatChecked;
		this.enableMediaInput(this.isFormatChecked);
		if (this.isFormatChecked) {
			if (strings.isFalsyOrWhitespace(this.mediaNameBox.value)) {
				this.backupEnabled = false;
				this.backupButton.enabled = false;
				this.mediaNameBox.showMessage({ type: MessageType.ERROR, content: LocalizedStrings.MEDIA_NAME_REQUIRED_ERROR });
			}
		} else {
			this.enableBackupButton();
		}
		this.detectChange();
	}

	private set backupEnabled(value: boolean) {
		this.backupButton.enabled = value;
		this.scriptButton.enabled = value;
	}

	private onBackupTypeChanged(): void {
		if (this.getSelectedBackupType() === BackupConstants.labelDifferential) {
			this.copyOnlyCheckBox.checked = false;
			this.copyOnlyCheckBox.disable();
		} else {
			this.copyOnlyCheckBox.enable();
		}

		this.setTLogOptions();
		this.setDefaultBackupName();
		this._changeDetectorRef.detectChanges();
	}

	private onAddClick(): void {
		this.fileBrowserDialogService.showDialog(this._uri,
			this.defaultNewBackupFolder,
			BackupConstants.fileFiltersSet,
			FileValidationConstants.backup,
			false,
			(filepath => this.handlePathAdded(filepath)));
	}

	private handlePathAdded(filepath: string) {
		if (filepath && !this.backupPathTypePairs[filepath]) {
			if ((this.getBackupPathCount() < BackupConstants.maxDevices)) {
				this.backupPathTypePairs[filepath] = BackupConstants.deviceTypeFile;
				this.pathListBox.add(filepath);
				this.enableBackupButton();
				this.enableAddRemoveButtons();

				// stop showing error message if the list content was invalid due to no file path
				if (!this.pathListBox.isContentValid && this.pathListBox.count === 1) {
					this.pathListBox.setValidation(true);
				}

				this._changeDetectorRef.detectChanges();
			}
		}
	}

	private onRemoveClick(): void {
		let self = this;
		this.pathListBox.selectedOptions.forEach(selected => {
			if (self.backupPathTypePairs[selected]) {
				if (self.backupPathTypePairs[selected] === BackupConstants.deviceTypeURL) {
					// stop showing warning message since url path is getting removed
					this.pathListBox.setValidation(true);
					this.containsBackupToUrl = false;
				}

				delete self.backupPathTypePairs[selected];
			}
		});

		this.pathListBox.remove();
		if (this.pathListBox.count === 0) {
			this.backupEnabled = false;

			// show input validation error
			this.pathListBox.setValidation(false, { content: localize('backup.backupFileRequired', "Backup file path is required"), type: MessageType.ERROR });
			this.pathListBox.focus();
		}

		this.enableAddRemoveButtons();
		this._changeDetectorRef.detectChanges();
	}

	private enableAddRemoveButtons(): void {
		if (this.pathListBox.count === 0) {
			this.removePathButton.enabled = false;
		} else if (this.pathListBox.count === BackupConstants.maxDevices) {
			this.addPathButton.enabled = false;
		} else {
			this.removePathButton.enabled = true;
			this.addPathButton.enabled = true;
		}
	}

	/*
	* Helper methods
	*/
	private setControlsForRecoveryModel(): void {
		if (this.recoveryModel === BackupConstants.recoveryModelSimple) {
			this.selectedBackupComponent = BackupConstants.labelDatabase;
			this.disableFileComponent = true;
		} else {
			this.disableFileComponent = false;
		}

		this.populateBackupTypes();
	}

	private populateBackupTypes(): void {
		this.backupTypeOptions.push(BackupConstants.labelFull);
		if (this.databaseName !== 'master') {
			this.backupTypeOptions.push(BackupConstants.labelDifferential);
			if (this.recoveryModel !== BackupConstants.recoveryModelSimple) {
				this.backupTypeOptions.push(BackupConstants.labelLog);
			}
		}
	}

	private populateEncryptorCombo(): string[] {
		let encryptorCombo = [];
		this.backupEncryptors.forEach((encryptor) => {
			let encryptorTypeStr = (encryptor.encryptorType === 0 ? BackupConstants.serverCertificate : BackupConstants.asymmetricKey);
			encryptorCombo.push(encryptor.encryptorName + '(' + encryptorTypeStr + ')');
		});
		return encryptorCombo;
	}

	private setDefaultBackupName(): void {
		if (this.backupNameBox && (!this.backupNameBox.value || this.backupNameBox.value.trim().length === 0)) {
			let utc = new Date().toJSON().slice(0, 19);
			this.backupNameBox.value = this.databaseName + '-' + this.getSelectedBackupType() + '-' + utc;
		}
	}

	private setDefaultBackupPaths(): void {
		if (this.defaultNewBackupFolder && this.defaultNewBackupFolder.length > 0) {

			// TEMPORARY WORKAROUND: karlb 5/27 - try to guess path separator on server based on first character in path
			let serverPathSeparator: string = '\\';
			if (this.defaultNewBackupFolder[0] === '/') {
				serverPathSeparator = '/';
			}
			let d: Date = new Date();
			let formattedDateTime: string = `-${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}-${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`;
			let defaultNewBackupLocation = this.defaultNewBackupFolder + serverPathSeparator + this.databaseName + formattedDateTime + '.bak';

			// Add a default new backup location
			this.backupPathTypePairs[defaultNewBackupLocation] = BackupConstants.deviceTypeFile;
		}
	}

	private isBackupToFile(controllerType: number): boolean {
		let isfile = false;
		if (controllerType === 102) {
			isfile = true;
		} else if (controllerType === 105) {
			isfile = false;
		} else if (controllerType === BackupConstants.backupDeviceTypeDisk) {
			isfile = true;
		} else if (controllerType === BackupConstants.backupDeviceTypeTape || controllerType === BackupConstants.backupDeviceTypeURL) {
			isfile = false;
		}
		return isfile;
	}

	private enableMediaInput(enable: boolean): void {
		if (enable) {
			this.mediaNameBox.enable();
			this.mediaDescriptionBox.enable();
		} else {
			this.mediaNameBox.disable();
			this.mediaDescriptionBox.disable();
		}
	}

	private detectChange(): void {
		this._changeDetectorRef.detectChanges();
	}

	private setTLogOptions(): void {
		if (this.getSelectedBackupType() === BackupConstants.labelLog) {
			// Enable log options
			this.disableTlog = false;
			// Choose the default option
			this.isTruncateChecked = true;
		} else {
			// Unselect log options
			this.isTruncateChecked = false;
			this.isTaillogChecked = false;
			// Disable log options
			this.disableTlog = true;
		}
	}

	private getBackupTypeNumber(): number {
		let backupType;
		switch (this.getSelectedBackupType()) {
			case BackupConstants.labelFull:
				backupType = 0;
				break;
			case BackupConstants.labelDifferential:
				backupType = 1;
				break;
			case BackupConstants.labelLog:
				backupType = 2;
				break;
		}
		return backupType;
	}

	private getBackupPathCount(): number {
		return this.pathListBox.count;
	}

	private getSelectedBackupType(): string {
		let backupType = '';
		if (this.backupTypeSelectBox) {
			backupType = this.backupTypeSelectBox.value;
		}
		return backupType;
	}

	private enableBackupButton(): void {
		if (!this.backupButton.enabled) {
			if (this.pathListBox.count > 0 && (!this.isFormatChecked || this.mediaNameBox.value) && this.backupRetainDaysBox.validate()) {
				this.backupEnabled = true;
			}
		}
	}

	private setEncryptOptionsEnabled(enabled: boolean): void {
		if (enabled) {
			this.algorithmSelectBox.enable();
			this.encryptorSelectBox.enable();
		} else {
			this.algorithmSelectBox.disable();
			this.encryptorSelectBox.disable();
		}
	}

	private mediaNameChanged(mediaName: string): void {
		if (!mediaName) {
			this.backupEnabled = false;
		} else {
			this.enableBackupButton();
		}
	}

	private backupRetainDaysChanged(days: string): void {
		if (!this.backupRetainDaysBox.validate()) {
			this.backupEnabled = false;
		} else {
			this.enableBackupButton();
		}
	}

	private createBackupInfo(): MssqlBackupInfo {
		let backupPathArray = [];
		for (let i in this.backupPathTypePairs) {
			backupPathArray.push(i);
		}

		// get encryptor type and name
		let encryptorName = '';
		let encryptorType;

		if (this.encryptCheckBox.checked && this.encryptorSelectBox.value !== '') {
			let selectedEncryptor = this.encryptorSelectBox.value;
			let encryptorTypeStr = selectedEncryptor.substring(selectedEncryptor.lastIndexOf('(') + 1, selectedEncryptor.lastIndexOf(')'));
			encryptorType = (encryptorTypeStr === BackupConstants.serverCertificate ? 0 : 1);
			encryptorName = selectedEncryptor.substring(0, selectedEncryptor.lastIndexOf('('));
		}

		let backupInfo = <MssqlBackupInfo>{
			ownerUri: this._uri,
			databaseName: this.databaseName,
			backupType: this.getBackupTypeNumber(),
			backupComponent: 0,
			backupDeviceType: BackupConstants.backupDeviceTypeDisk,
			backupPathList: backupPathArray,
			selectedFiles: this.selectedFilesText,
			backupsetName: this.backupNameBox.value,
			selectedFileGroup: undefined,
			backupPathDevices: this.backupPathTypePairs,
			isCopyOnly: this.copyOnlyCheckBox.checked,

			// Get advanced options
			formatMedia: this.isFormatChecked,
			initialize: (this.isFormatChecked ? true : (this.selectedInitOption === this.existingMediaOptions[1])),
			skipTapeHeader: this.isFormatChecked,
			mediaName: (this.isFormatChecked ? this.mediaNameBox.value : ''),
			mediaDescription: (this.isFormatChecked ? this.mediaDescriptionBox.value : ''),
			checksum: this.checksumCheckBox.checked,
			continueAfterError: this.continueOnErrorCheckBox.checked,
			logTruncation: this.isTruncateChecked,
			tailLogBackup: this.isTaillogChecked,
			retainDays: strings.isFalsyOrWhitespace(this.backupRetainDaysBox.value) ? 0 : this.backupRetainDaysBox.value,
			compressionOption: this.compressionOptions.indexOf(this.compressionSelectBox.value),
			verifyBackupRequired: this.verifyCheckBox.checked,
			encryptionAlgorithm: (this.encryptCheckBox.checked ? this.encryptionAlgorithms.indexOf(this.algorithmSelectBox.value) : 0),
			encryptorType: encryptorType,
			encryptorName: encryptorName
		};

		return backupInfo;
	}
}
