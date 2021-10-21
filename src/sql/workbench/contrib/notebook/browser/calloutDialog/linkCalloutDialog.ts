/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/linkCalloutDialog';
import * as DOM from 'vs/base/browser/dom';
import * as styler from 'vs/platform/theme/common/styler';
import * as constants from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/constants';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { Modal, IDialogProperties, DialogPosition, DialogWidth } from 'sql/workbench/browser/modal/modal';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Deferred } from 'sql/base/common/promise';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachCalloutDialogStyler } from 'sql/workbench/common/styler';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { escapeLabel, escapeUrl, unquoteText } from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/utils';

export interface ILinkCalloutDialogOptions {
	insertTitle?: string,
	insertEscapedMarkdown?: string,
	insertUnescapedLinkLabel?: string,
	insertUnescapedLinkUrl?: string
}

const DEFAULT_DIALOG_WIDTH: DialogWidth = 452;

export class LinkCalloutDialog extends Modal {
	private _selectionComplete: Deferred<ILinkCalloutDialogOptions> = new Deferred<ILinkCalloutDialogOptions>();
	private _linkTextLabel: HTMLElement;
	private _linkTextInputBox: InputBox;
	private _linkAddressLabel: HTMLElement;
	private _linkUrlInputBox: InputBox;
	private _previouslySelectedRange: Range;

	constructor(
		title: string,
		dialogPosition: DialogPosition,
		dialogProperties: IDialogProperties,
		private readonly _defaultLabel: string = '',
		private readonly _defaultLinkUrl: string = '',
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
		let selection = window.getSelection();
		if (selection.rangeCount > 0) {
			this._previouslySelectedRange = selection?.getRangeAt(0);
		}
	}

	protected layout(height?: number): void {
	}

	/**
	 * Opens the dialog and returns a promise for what options the user chooses.
	 */
	public open(): Promise<ILinkCalloutDialogOptions> {
		this._selectionComplete = new Deferred<ILinkCalloutDialogOptions>();
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
		let linkContentColumn = DOM.$('.column.insert-link');
		DOM.append(container, linkContentColumn);

		let linkTextRow = DOM.$('.row');
		DOM.append(linkContentColumn, linkTextRow);

		this._linkTextLabel = DOM.$('p');
		this._linkTextLabel.innerText = constants.linkTextLabel;
		DOM.append(linkTextRow, this._linkTextLabel);

		const linkTextInputContainer = DOM.$('.input-field');
		this._linkTextInputBox = new InputBox(
			linkTextInputContainer,
			this._contextViewService,
			{
				placeholder: constants.linkTextPlaceholder,
				ariaLabel: constants.linkTextLabel
			});
		this._linkTextInputBox.value = this._defaultLabel;
		DOM.append(linkTextRow, linkTextInputContainer);

		let linkAddressRow = DOM.$('.row');
		DOM.append(linkContentColumn, linkAddressRow);
		this._linkAddressLabel = DOM.$('p');
		this._linkAddressLabel.innerText = constants.linkAddressLabel;
		DOM.append(linkAddressRow, this._linkAddressLabel);

		const linkAddressInputContainer = DOM.$('.input-field');
		this._linkUrlInputBox = new InputBox(
			linkAddressInputContainer,
			this._contextViewService,
			{
				placeholder: constants.linkAddressPlaceholder,
				ariaLabel: constants.linkAddressLabel
			});
		this._linkUrlInputBox.value = this._defaultLinkUrl;
		DOM.append(linkAddressRow, linkAddressInputContainer);
	}

	private registerListeners(): void {
		this._register(styler.attachInputBoxStyler(this._linkTextInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._linkUrlInputBox, this._themeService));
	}

	protected override onAccept(e?: StandardKeyboardEvent) {
		// EventHelper.stop() will call preventDefault. Without it, text cell will insert an extra newline when pressing enter on dialog
		DOM.EventHelper.stop(e, true);
		this.insert();
	}

	protected override onClose(e?: StandardKeyboardEvent) {
		DOM.EventHelper.stop(e, true);
		this.cancel();
	}

	public insert(): void {
		this.hide('ok');
		let escapedLabel = escapeLabel(this._linkTextInputBox.value);
		let unquotedUrl = unquoteText(this._linkUrlInputBox.value);
		let escapedUrl = escapeUrl(unquotedUrl);

		if (this._previouslySelectedRange) {
			// Reset selection to previous state before callout was open
			let selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(this._previouslySelectedRange);

			this._selectionComplete.resolve({
				insertEscapedMarkdown: `[${escapedLabel}](${escapedUrl})`,
				insertUnescapedLinkLabel: this._linkTextInputBox.value,
				insertUnescapedLinkUrl: unquotedUrl
			});
		}
	}

	public cancel(): void {
		this.hide('cancel');
		this._selectionComplete.resolve({
			insertEscapedMarkdown: '',
			insertUnescapedLinkLabel: escapeLabel(this._linkTextInputBox.value)
		});
	}

	public set url(val: string) {
		this._linkUrlInputBox.value = val;
	}
}
