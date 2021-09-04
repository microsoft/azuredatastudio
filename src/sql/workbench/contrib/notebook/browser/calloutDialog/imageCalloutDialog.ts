/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/imageCalloutDialog';
import * as DOM from 'vs/base/browser/dom';
import * as styler from 'vs/platform/theme/common/styler';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as constants from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/constants';
import { URI } from 'vs/base/common/uri';
import { Modal, IDialogProperties, DialogPosition, DialogWidth } from 'sql/workbench/browser/modal/modal';
import { IFileDialogService, IOpenDialogOptions } from 'vs/platform/dialogs/common/dialogs';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
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
import { attachCalloutDialogStyler } from 'sql/workbench/common/styler';
import * as path from 'vs/base/common/path';
import { unquoteText } from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/utils';

export interface IImageCalloutDialogOptions {
	insertTitle?: string,
	insertEscapedMarkdown?: string,
	imagePath?: string,
	embedImage?: boolean
}

const DEFAULT_DIALOG_WIDTH: DialogWidth = 452;

const IMAGE_Extensions: string[] = ['jpg', 'jpeg', 'png', 'gif'];
export class ImageCalloutDialog extends Modal {
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
		dialogPosition: DialogPosition,
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
			TelemetryKeys.ModalDialogName.CalloutDialog,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'callout',
				dialogPosition: dialogPosition,
				dialogProperties: dialogProperties,
				width: DEFAULT_DIALOG_WIDTH
			}
		);
	}

	protected layout(height?: number): void {
	}

	/**
	 * Opens the dialog and returns a promise for what options the user chooses.
	 */
	public open(): Promise<IImageCalloutDialogOptions> {
		this.show();
		return this._selectionComplete.promise;
	}

	public override render(): void {
		super.render();
		attachCalloutDialogStyler(this, this._themeService);

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

		this._register(this._imageRemoteRadioButton.onClicked(e => {
			this._imageBrowseButton.style.display = 'none';
			this._imageEmbedCheckbox.enabled = false;
			this._imageUrlLabel.innerText = constants.urlPlaceholder;
			this._imageUrlInputBox.setPlaceHolder(constants.urlPlaceholder);
		}));
		this._register(this._imageLocalRadioButton.onClicked(e => {
			this._imageBrowseButton.style.display = 'block';
			this._imageEmbedCheckbox.enabled = true;
			this._imageUrlLabel.innerText = constants.pathPlaceholder;
			this._imageUrlInputBox.setPlaceHolder(constants.pathPlaceholder);
		}));
	}

	private registerListeners(): void {
		this._register(styler.attachInputBoxStyler(this._imageUrlInputBox, this._themeService));
		this._register(styler.attachCheckboxStyler(this._imageEmbedCheckbox, this._themeService));
	}

	public insert(): void {
		this.hide('ok');
		let imgPath = unquoteText(this._imageUrlInputBox.value);
		let imageName = path.basename(imgPath);
		this._selectionComplete.resolve({
			embedImage: this._imageEmbedCheckbox.checked,
			// check for spaces and remove them in imageName.
			// if spaces in image path replace with &#32; as per https://github.com/microsoft/vscode/issues/11933#issuecomment-249987377
			insertEscapedMarkdown: this._imageEmbedCheckbox.checked ? `![${imageName}](attachment:${imageName.replace(/\s/g, '')})` : `![](${imgPath.replace(/\s/g, '&#32;')})`,
			imagePath: imgPath
		});
		this.dispose();
	}

	public cancel(): void {
		this.hide('cancel');
		this._selectionComplete.resolve({
			insertEscapedMarkdown: '',
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
			title: undefined,
			filters: [{ extensions: IMAGE_Extensions, name: 'images' }]
		};
		let imageUri: URI[] = await this._fileDialogService.showOpenDialog(options);
		if (imageUri.length > 0) {
			return imageUri[0];
		} else {
			return undefined;
		}
	}

	public set imagePath(val: string) {
		this._imageUrlInputBox.value = val;
	}

	public set embedImage(val: boolean) {
		this._imageEmbedCheckbox.checked = val;
	}
}
