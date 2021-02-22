/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/linkCalloutDialog';
import * as DOM from 'vs/base/browser/dom';
import * as strings from 'vs/base/common/strings';
import * as styler from 'vs/platform/theme/common/styler';
import { localize } from 'vs/nls';
import * as constants from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/constants';

import { CalloutDialog } from 'sql/workbench/browser/modal/calloutDialog';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IDialogProperties } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Deferred } from 'sql/base/common/promise';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { DialogWidth } from 'sql/workbench/api/common/sqlExtHostTypes';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';

export interface ICalloutDialogOptions {
	insertTitle?: string,
	insertMarkup?: string
}

export class LinkCalloutDialog extends CalloutDialog {
	private _selectionComplete: Deferred<ICalloutDialogOptions> = new Deferred<ICalloutDialogOptions>();
	private _linkTextLabel: HTMLElement;
	private _linkTextInputBox: InputBox;
	private _linkAddressLabel: HTMLElement;
	private _linkUrlInputBox: InputBox;


	private readonly linkTextLabel = localize('callout.linkTextLabel', "Text to display");
	private readonly linkTextPlaceholder = localize('callout.linkTextPlaceholder', "Text to display");
	private readonly linkAddressLabel = localize('callout.linkAddressLabel', "Address");
	private readonly linkAddressPlaceholder = localize('callout.linkAddressPlaceholder', "Link to an existing file or web page");

	constructor(
		title: string,
		width: DialogWidth,
		dialogProperties: IDialogProperties,
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
	public open(): Promise<ICalloutDialogOptions> {
		this.show();
		return this._selectionComplete.promise;
	}

	public render(): void {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this.addFooterButton(constants.insertButtonText, () => this.insert());
		this.addFooterButton(constants.cancelButtonText, () => this.cancel(), undefined, true);
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
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
		this._register(styler.attachInputBoxStyler(this._linkTextInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._linkUrlInputBox, this._themeService));
	}

	public insert(): void {
		this.hide();
		this._selectionComplete.resolve({
			insertMarkup: `<a href="${strings.escape(this._linkUrlInputBox.value)}">${strings.escape(this._linkTextInputBox.value)}</a>`,
		});
		this.dispose();
	}

	public cancel(): void {
		this.hide();
		this._selectionComplete.resolve({
			insertMarkup: ''
		});
		this.dispose();
	}
}
