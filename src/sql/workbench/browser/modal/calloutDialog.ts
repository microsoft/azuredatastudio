/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as DOM from 'vs/base/browser/dom';
import * as styler from 'vs/platform/theme/common/styler';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { ITriggerProperties, Modal } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IFileDialogService, IOpenDialogOptions } from 'vs/platform/dialogs/common/dialogs';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Deferred } from 'sql/base/common/promise';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { Button } from 'sql/base/browser/ui/button/button';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';
import { IPathService } from 'vs/workbench/services/path/common/pathService';

export type CalloutType = 'IMAGE' | 'LINK';

export interface ICalloutDialogOptions {
	insertTitle?: string,
	calloutType?: CalloutType,
	insertMarkup?: string,
	imagePath?: string,
	embedImage?: boolean
}
export class CalloutDialog extends Modal {
	private _calloutType: CalloutType;
	private _selectionComplete: Deferred<ICalloutDialogOptions>;
	private _insertButton: Button;
	private _cancelButton: Button;
	// Link
	private _linkTextLabel: HTMLElement;
	private _linkTextInputBox: InputBox;
	private _linkAddressLabel: HTMLElement;
	private _linkUrlInputBox: InputBox;
	// Image
	private _imageLocationLabel: HTMLElement;
	private _imageLocalRadioButton: RadioButton;
	private _imageRemoteRadioButton: RadioButton;
	private _imageUrlLabel: HTMLElement;
	private _imageUrlInputBox: InputBox;
	private _imageBrowseButton: HTMLAnchorElement;
	private _imageEmbedLabel: HTMLElement;
	private _imageEmbedCheckbox: Checkbox;

	private readonly insertButtonText = localize('callout.insertButton', "Insert");
	private readonly cancelButtonText = localize('callout.cancelButton', "Cancel");
	// Link
	private readonly linkTextLabel = localize('callout.linkTextLabel', "Text to display");
	private readonly linkTextPlaceholder = localize('callout.linkTextPlaceholder', "Text to display");
	private readonly linkAddressLabel = localize('callout.linkAddressLabel', "Address");
	private readonly linkAddressPlaceholder = localize('callout.linkAddressPlaceholder', "Link to an existing file or web page");
	// Image
	private readonly locationLabel = localize('callout.locationLabel', "Image location");
	private readonly localImageLabel = localize('callout.localImageLabel', "This computer");
	private readonly remoteImageLabel = localize('callout.remoteImageLabel', "Online");
	private readonly pathInputLabel = localize('callout.pathInputLabel', "Image URL");
	private readonly pathPlaceholder = localize('callout.pathPlaceholder', "Enter image path");
	private readonly urlPlaceholder = localize('callout.urlPlaceholder', "Enter image URL");
	private readonly browseAltText = localize('callout.browseAltText', "Browse");
	private readonly embedImageLabel = localize('callout.embedImageLabel', "Attach image to notebook");

	constructor(
		calloutType: CalloutType,
		title: string,
		triggerProperties: ITriggerProperties,
		@IPathService private readonly _pathService: IPathService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(
			title,
			TelemetryKeys.CalloutDialog,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'callout',
				dialogPosition: 'below',
				triggerProperties: triggerProperties
			});

		this._selectionComplete = new Deferred<ICalloutDialogOptions>();
		this._calloutType = calloutType;
	}

	/**
	 * Opens the dialog and returns a promise for what options the user chooses.
	 */
	public open(): Promise<ICalloutDialogOptions> {
		this.show();
		return this._selectionComplete.promise;
	}

	public render() {
		super.render();

		attachModalDialogStyler(this, this._themeService);

		this._insertButton = this.addFooterButton(this.insertButtonText, () => this.insert());
		attachButtonStyler(this._insertButton, this._themeService);

		this._cancelButton = this.addFooterButton(this.cancelButtonText, () => this.cancel(), null, true);
		attachButtonStyler(this._cancelButton, this._themeService);

		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		if (this._calloutType === 'IMAGE') {
			this.buildInsertImageCallout(container);
		}

		if (this._calloutType === 'LINK') {
			this.buildInsertLinkCallout(container);
		}
	}

	private buildInsertImageCallout(container: HTMLElement): void {
		let imageContentColumn = DOM.$('.column.insert-image');
		DOM.append(container, imageContentColumn);

		let locationRow = DOM.$('.row');
		DOM.append(imageContentColumn, locationRow);

		this._imageLocationLabel = DOM.$('p');
		this._imageLocationLabel.innerText = this.locationLabel;
		DOM.append(locationRow, this._imageLocationLabel);

		let radioButtonGroup = DOM.$('.radio-group');
		this._imageLocalRadioButton = new RadioButton(radioButtonGroup, {
			label: this.localImageLabel,
			enabled: true,
			checked: true
		});
		this._imageRemoteRadioButton = new RadioButton(radioButtonGroup, {
			label: this.remoteImageLabel,
			enabled: true,
			checked: false
		});
		this._imageLocalRadioButton.value = localize('local', "Local");
		this._imageLocalRadioButton.name = 'group1';
		this._imageRemoteRadioButton.value = localize('remote', "Remote");
		this._imageRemoteRadioButton.name = 'group1';
		DOM.append(locationRow, radioButtonGroup);

		let pathRow = DOM.$('.row');
		DOM.append(imageContentColumn, pathRow);
		this._imageUrlLabel = DOM.$('p');
		if (this._imageLocalRadioButton.checked === true) {
			this._imageUrlLabel.innerText = this.pathPlaceholder;
		} else {
			this._imageUrlLabel.innerText = this.urlPlaceholder;
		}
		DOM.append(pathRow, this._imageUrlLabel);

		let inputContainer = DOM.$('.flex-container');
		this._imageUrlInputBox = new InputBox(
			inputContainer,
			this._contextViewService,
			{
				placeholder: this.pathPlaceholder,
				ariaLabel: this.pathInputLabel
			});
		let browseButtonContainer = DOM.$('.button-icon');
		this._imageBrowseButton = DOM.$('a.codicon.masked-icon.browse-local');
		this._imageBrowseButton.title = this.browseAltText;
		DOM.append(inputContainer, browseButtonContainer);
		DOM.append(browseButtonContainer, this._imageBrowseButton);

		this._register(DOM.addDisposableListener(this._imageBrowseButton, DOM.EventType.CLICK, async () => {
			let selectedUri = await this.handleBrowse();
			if (selectedUri) {
				this._imageUrlInputBox.value = selectedUri.fsPath;
			}
		}, true));

		this._register(this._imageRemoteRadioButton.onClicked(e => {
			this._imageBrowseButton.style.display = 'none';
			this._imageUrlLabel.innerText = this.urlPlaceholder;
			this._imageUrlInputBox.setPlaceHolder(this.urlPlaceholder);
		}));
		this._register(this._imageLocalRadioButton.onClicked(e => {
			this._imageBrowseButton.style.display = 'block';
			this._imageUrlLabel.innerText = this.pathPlaceholder;
			this._imageUrlInputBox.setPlaceHolder(this.pathPlaceholder);
		}));
		DOM.append(pathRow, inputContainer);

		let embedRow = DOM.$('.row');
		DOM.append(imageContentColumn, embedRow);
		this._imageEmbedLabel = DOM.append(embedRow, DOM.$('.checkbox'));
		this._imageEmbedCheckbox = new Checkbox(
			this._imageEmbedLabel,
			{
				label: this.embedImageLabel,
				checked: false,
				onChange: (viaKeyboard) => { },
				ariaLabel: this.embedImageLabel
			});
		DOM.append(embedRow, this._imageEmbedLabel);
	}

	private buildInsertLinkCallout(container: HTMLElement): void {
		let linkContentColumn = DOM.$('.column.insert-link');
		DOM.append(container, linkContentColumn);

		let linkTextRow = DOM.$('.row');
		DOM.append(linkContentColumn, linkTextRow);

		this._linkTextLabel = DOM.$('p');
		this._linkTextLabel.innerText = this.linkTextLabel;
		DOM.append(linkTextRow, this._linkTextLabel);

		const linkTextInputContainer = DOM.$('.input-field');
		this._linkTextInputBox = new InputBox(
			linkTextInputContainer,
			this._contextViewService,
			{
				placeholder: this.linkTextPlaceholder,
				ariaLabel: this.linkTextLabel
			});
		DOM.append(linkTextRow, linkTextInputContainer);

		let linkAddressRow = DOM.$('.row');
		DOM.append(linkContentColumn, linkAddressRow);
		this._linkAddressLabel = DOM.$('p');
		this._linkAddressLabel.innerText = this.linkAddressLabel;
		DOM.append(linkAddressRow, this._linkAddressLabel);

		const linkAddressInputContainer = DOM.$('.input-field');
		this._linkUrlInputBox = new InputBox(
			linkAddressInputContainer,
			this._contextViewService,
			{
				placeholder: this.linkAddressPlaceholder,
				ariaLabel: this.linkAddressLabel
			});
		DOM.append(linkAddressRow, linkAddressInputContainer);
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachButtonStyler(this._insertButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
		if (this._calloutType === 'IMAGE') {
			this._register(styler.attachInputBoxStyler(this._imageUrlInputBox, this._themeService));
			this._register(styler.attachCheckboxStyler(this._imageEmbedCheckbox, this._themeService));
		}
		if (this._calloutType === 'LINK') {
			this._register(styler.attachInputBoxStyler(this._linkTextInputBox, this._themeService));
			this._register(styler.attachInputBoxStyler(this._linkUrlInputBox, this._themeService));
		}
	}

	protected layout(height?: number): void {
	}

	public insert() {
		this.hide();
		if (this._calloutType === 'IMAGE') {
			this._selectionComplete.resolve({
				insertMarkup: `<img src="${this._imageUrlInputBox.value}">`,
				imagePath: this._imageUrlInputBox.value,
				embedImage: this._imageEmbedCheckbox.checked
			});
		}
		if (this._calloutType === 'LINK') {
			this._selectionComplete.resolve({
				insertMarkup: `<a href="${this._linkUrlInputBox.value}">${this._linkTextInputBox.value}</a>`,
			});
		}
		this.dispose();
	}

	public cancel() {
		this.hide();
		this._selectionComplete.resolve({
			insertMarkup: '',
			imagePath: undefined,
			embedImage: undefined
		});
		this.dispose();
	}

	private async getUserHome(): Promise<string> {
		const userHomeUri = await this._pathService.userHome();
		return userHomeUri.path;
	}

	private async handleBrowse(): Promise<URI | void> {
		let options: IOpenDialogOptions = {
			openLabel: undefined,
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri: URI.file(await this.getUserHome()),
			title: undefined
		};
		let imgeUri: URI[] = await this._fileDialogService.showOpenDialog(options);
		if (imgeUri.length > 0) {
			return imgeUri[0];
		}
	}
}
