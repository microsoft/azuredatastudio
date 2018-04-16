/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/wizardModal';
import { Modal, IModalOptions } from 'sql/base/browser/ui/modal/modal';
import { Builder } from 'vs/base/browser/builder';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { attachModalDialogStyler } from '../../common/theme/styler';
import { Wizard, DialogPage, Dialog, OptionsDialogButton } from './dialogTypes';
import { Button } from 'vs/base/browser/ui/button/button';
import { DialogPane } from './dialogPane';

export class WizardModal extends Modal {
	private _currentPage: number;
	private _pages: DialogPane[];

	// Wizard HTML elements
	private _body: HTMLElement;
	private _progressBar: HTMLElement;
	private _pageHeader: HTMLElement;
	private _pageContent: HTMLElement;

	// Buttons
	private _previousButton: Button;
	private _nextButton: Button;

	constructor(
		private _wizard: Wizard,
		name: string,
		options: IModalOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(_wizard.title, name, partService, telemetryService, contextKeyService, options);
		this._pages = [];
	}

	public layout(): void {

	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		this._previousButton = this.addFooterButton('Last', () => this.showPage(this._currentPage - 1));
		this._nextButton = this.addFooterButton('Next', () => this.showPage(this._currentPage + 1));
		attachButtonStyler(this._previousButton, this._themeService);
		attachButtonStyler(this._nextButton, this._themeService);
	}

	protected renderBody(container: HTMLElement): void {
		new Builder(container).div({ class: 'wizardModal-body' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
		});

		let builder = new Builder(this._body);
		builder.div({ class: 'wizardModal-progressBar' }, (progressBarBuilder) => {
			this._progressBar = progressBarBuilder.getHTMLElement();
		});
		this._wizard.pages.forEach(page => {
			let dialogPane = new DialogPane(new Dialog(page.title, [page]));
			dialogPane.createBody(this._body);
			this._pages.push(dialogPane);

			// builder.div({ class: 'wizardModal-page' }, (pageBuilder) => {
			// 	let pageElement = pageBuilder.getHTMLElement();
			// 	pageElement.style.display = 'none';
			// 	this._pages.push(pageElement);
			// 	pageBuilder.div({ class: 'wizardModal-page-header' }, (pageHeaderBuilder) => {
			// 		this._pageHeader = pageHeaderBuilder.getHTMLElement();
			// 		this._pageHeader.textContent = page.title;
			// 	});
			// 	pageBuilder.div({ class: 'wizardModal-page-content' }, (pageContentBuilder) => {
			// 		this._pageContent = pageContentBuilder.getHTMLElement();
			// 	});
			// });
		});
	}

	private showPage(index: number): void {
		if (!this._pages[index]) {
			this.ok();
			return;
		}
		this.setButtonsForPage(index);
		this._pages.forEach(page => page.hide());
		this._pages[index].show();
		this._currentPage = index;
	}

	private setButtonsForPage(index: number) {
		if (this._pages[index - 1]) {
			this._previousButton.element.style.display = 'block';
		} else {
			this._previousButton.element.style.display = 'none';
		}

		if (this._pages[index + 1]) {
			this._nextButton.label = 'Next';
		} else {
			this._nextButton.label = 'Done';
		}
	}

	public open(): void {
		this.showPage(0);
		this.show();
	}

	public ok(): void {
		this.dispose();
		this.hide();
	}
}