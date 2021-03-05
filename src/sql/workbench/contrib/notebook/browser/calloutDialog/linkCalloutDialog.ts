/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/linkCalloutDialog';
import * as DOM from 'vs/base/browser/dom';
import * as styler from 'vs/platform/theme/common/styler';
import * as constants from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/constants';
import { CalloutDialog } from 'sql/workbench/browser/modal/calloutDialog';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { DialogPosition, IDialogProperties } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Deferred } from 'sql/base/common/promise';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { escapeLabel, escapeUrl } from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/utils';

const DEFAULT_DIALOG_WIDTH = 452;

export interface ILinkCalloutDialogOptions {
	insertTitle?: string,
	insertEscapedMarkdown?: string,
	insertUnescapedLinkLabel?: string,
	insertUnescapedLinkUrl?: string
}

export class LinkCalloutDialog extends CalloutDialog<ILinkCalloutDialogOptions> {
	private _selectionComplete: Deferred<ILinkCalloutDialogOptions> = new Deferred<ILinkCalloutDialogOptions>();
	private _linkTextLabel: HTMLElement;
	private _linkTextInputBox: InputBox;
	private _linkAddressLabel: HTMLElement;
	private _linkUrlInputBox: InputBox;
	private _previouslySelectedRange: Range;

	constructor(
		title: string,
		dialogProperties: IDialogProperties,
		dialogPosition: DialogPosition,
		private readonly _defaultLabel: string = '',
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
			DEFAULT_DIALOG_WIDTH,
			dialogProperties,
			dialogPosition,
			themeService,
			layoutService,
			telemetryService,
			contextKeyService,
			clipboardService,
			logService,
			textResourcePropertiesService
		);
		let selection = window.getSelection();
		if (selection.rangeCount > 0) {
			this._previouslySelectedRange = selection?.getRangeAt(0);
		}
	}

	/**
	 * Opens the dialog and returns a promise for what options the user chooses.
	 */
	public open(): Promise<ILinkCalloutDialogOptions> {
		this._selectionComplete = new Deferred<ILinkCalloutDialogOptions>();
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
		DOM.append(linkAddressRow, linkAddressInputContainer);
	}

	private registerListeners(): void {
		this._register(styler.attachInputBoxStyler(this._linkTextInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._linkUrlInputBox, this._themeService));
	}

	protected onAccept(e?: StandardKeyboardEvent) {
		// EventHelper.stop() will call preventDefault. Without it, text cell will insert an extra newline when pressing enter on dialog
		DOM.EventHelper.stop(e, true);
		this.insert();
	}

	protected onClose(e?: StandardKeyboardEvent) {
		DOM.EventHelper.stop(e, true);
		this.cancel();
	}

	public insert(): void {
		this.hide();
		let escapedLabel = escapeLabel(this._linkTextInputBox.value);
		let escapedUrl = escapeUrl(this._linkUrlInputBox.value);

		if (this._previouslySelectedRange) {
			// Reset selection to previous state before callout was open
			let selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(this._previouslySelectedRange);

			this._selectionComplete.resolve({
				insertEscapedMarkdown: `[${escapedLabel}](${escapedUrl})`,
				insertUnescapedLinkLabel: this._linkTextInputBox.value,
				insertUnescapedLinkUrl: this._linkUrlInputBox.value
			});
		}
	}

	public cancel(): void {
		super.cancel();
		this._selectionComplete.resolve({
			insertEscapedMarkdown: '',
			insertUnescapedLinkLabel: escapeLabel(this._linkTextInputBox.value)
		});
	}

	public set url(val: string) {
		this._linkUrlInputBox.value = val;
	}
}
