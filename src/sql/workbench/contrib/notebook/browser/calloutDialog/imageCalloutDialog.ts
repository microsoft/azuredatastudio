/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/imageCalloutDialog';
import * as DOM from 'vs/base/browser/dom';
import * as strings from 'vs/base/common/strings';
import * as styler from 'vs/platform/theme/common/styler';
import { URI } from 'vs/base/common/uri';
import * as constants from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/constants';
import { CalloutDialog } from 'sql/workbench/browser/modal/calloutDialog';
import { IFileDialogService, IOpenDialogOptions } from 'vs/platform/dialogs/common/dialogs';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IDialogProperties } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Deferred } from 'sql/base/common/promise';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';
import { DialogWidth } from 'sql/workbench/api/common/sqlExtHostTypes';

export interface IImageCalloutDialogOptions {
	insertTitle?: string,
	insertMarkup?: string,
	imagePath?: string,
	embedImage?: boolean
}

export class ImageCalloutDialog extends CalloutDialog<IImageCalloutDialogOptions> {
	private _selectionComplete: Deferred<IImageCalloutDialogOptions> = new Deferred<IImageCalloutDialogOptions>();
	private _imageLocationLabel: HTMLElement;
	private _imageLocalRadioButton: RadioButton;
	private _editorImageLocationGroup: string = 'editorImageLocationGroup';
	private _imageRemoteRadioButton: RadioButton;
	private _imageUrlLabel: HTMLElement;
	private _imageUrlInputBox: InputBox;
	private _imageBrowseButton: HTMLAnchorElement;
	private _imageEmbedLabel: HTMLElement;
	private _imageEmbedCheckbox: Checkbox;

	constructor(
		title: string,
		width: DialogWidth,
		dialogProperties: IDialogProperties,
		@IPathService private readonly _pathService: IPathService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IContextViewService private readonly _contextViewService: IContextViewService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(
			title,
			width,
			dialogProperties,
			themeService,
			layoutService,
			telemetryService,
			contextKeyService,
			clipboardService,
			logService,
			textResourcePropertiesService
		);
	}

	/**
	 * Opens the dialog and returns a promise for what options the user chooses.
	 */
	public open(): Promise<IImageCalloutDialogOptions> {
		this.show();
		return this._selectionComplete.promise;
	}

	public render(): void {
		super.render();

		this.addFooterButton(constants.insertButtonText, () => this.insert());
		this.addFooterButton(constants.cancelButtonText, () => this.cancel(), undefined, true);
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		let imageContentColumn = DOM.$('.column.insert-image');
		DOM.append(container, imageContentColumn);

		let locationRow = DOM.$('.row');
		DOM.append(imageContentColumn, locationRow);

		this._imageLocationLabel = DOM.$('p');
		this._imageLocationLabel.innerText = constants.locationLabel;
		DOM.append(locationRow, this._imageLocationLabel);

		let radioButtonGroup = DOM.$('.radio-group');
		this._imageLocalRadioButton = new RadioButton(radioButtonGroup, {
			label: constants.localImageLabel,
			enabled: true,
			checked: true
		});
		this._imageRemoteRadioButton = new RadioButton(radioButtonGroup, {
			label: constants.remoteImageLabel,
			enabled: true,
			checked: false
		});
		this._imageLocalRadioButton.name = this._editorImageLocationGroup;
		this._imageLocalRadioButton.value = constants.locationLocal;
		this._imageRemoteRadioButton.name = this._editorImageLocationGroup;
		this._imageRemoteRadioButton.value = constants.locationRemote;

		DOM.append(locationRow, radioButtonGroup);

		let pathRow = DOM.$('.row');
		DOM.append(imageContentColumn, pathRow);
		this._imageUrlLabel = DOM.$('p');
		if (this._imageLocalRadioButton.checked === true) {
			this._imageUrlLabel.innerText = constants.pathPlaceholder;
		} else {
			this._imageUrlLabel.innerText = constants.urlPlaceholder;
		}
		DOM.append(pathRow, this._imageUrlLabel);

		let inputContainer = DOM.$('.flex-container');
		this._imageUrlInputBox = new InputBox(
			inputContainer,
			this._contextViewService,
			{
				placeholder: constants.pathPlaceholder,
				ariaLabel: constants.pathInputLabel
			});
		let browseButtonContainer = DOM.$('.button-icon');
		this._imageBrowseButton = DOM.$('a.codicon.masked-icon.browse-local');
		this._imageBrowseButton.title = constants.browseAltText;
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
			this._imageUrlLabel.innerText = constants.urlPlaceholder;
			this._imageUrlInputBox.setPlaceHolder(constants.urlPlaceholder);
		}));
		this._register(this._imageLocalRadioButton.onClicked(e => {
			this._imageBrowseButton.style.display = 'block';
			this._imageUrlLabel.innerText = constants.pathPlaceholder;
			this._imageUrlInputBox.setPlaceHolder(constants.pathPlaceholder);
		}));
		DOM.append(pathRow, inputContainer);

		let embedRow = DOM.$('.row');
		DOM.append(imageContentColumn, embedRow);
		this._imageEmbedLabel = DOM.append(embedRow, DOM.$('.checkbox'));
		this._imageEmbedCheckbox = new Checkbox(
			this._imageEmbedLabel,
			{
				label: constants.embedImageLabel,
				checked: false,
				onChange: (viaKeyboard) => { },
				ariaLabel: constants.embedImageLabel
			});
		DOM.append(embedRow, this._imageEmbedLabel);
	}

	private registerListeners(): void {
		this._register(styler.attachInputBoxStyler(this._imageUrlInputBox, this._themeService));
		this._register(styler.attachCheckboxStyler(this._imageEmbedCheckbox, this._themeService));
	}

	public insert(): void {
		this.hide();
		this._selectionComplete.resolve({
			insertMarkup: `<img src="${strings.escape(this._imageUrlInputBox.value)}">`,
			imagePath: this._imageUrlInputBox.value,
			embedImage: this._imageEmbedCheckbox.checked
		});
		this.dispose();
	}

	public cancel(): void {
		super.cancel();
		this._selectionComplete.resolve({
			insertMarkup: '',
			imagePath: undefined,
			embedImage: undefined
		});
	}

	private async getUserHome(): Promise<string> {
		const userHomeUri = await this._pathService.userHome();
		return userHomeUri.path;
	}

	private async handleBrowse(): Promise<URI | undefined> {
		let options: IOpenDialogOptions = {
			openLabel: undefined,
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri: URI.file(await this.getUserHome()),
			title: undefined
		};
		let imageUri: URI[] = await this._fileDialogService.showOpenDialog(options);
		if (imageUri.length > 0) {
			return imageUri[0];
		} else {
			return undefined;
		}
	}
}
