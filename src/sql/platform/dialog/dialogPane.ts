/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { NgModuleRef } from '@angular/core';
import { IModalDialogStyles } from 'sql/base/browser/ui/modal/modal';
import { Dialog } from 'sql/platform/dialog/dialogTypes';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { DialogModule } from 'sql/platform/dialog/dialog.module';
import { DialogComponentParams } from 'sql/platform/dialog/dialogContainer.component';
import { Builder } from 'vs/base/browser/builder';
import { IThemable } from 'vs/platform/theme/common/styler';
import { Disposable } from 'vs/base/common/lifecycle';

export class DialogPane extends Disposable implements IThemable {
	private _activeTabIndex: number;
	private _tabbedPanel: TabbedPanel;
	private _moduleRef: NgModuleRef<{}>;

	// HTML Elements
	private _body: HTMLElement;
	private _tabBar: HTMLElement;
	private _tabs: HTMLElement[];
	private _tabContent: HTMLElement[];

	constructor(
		private _dialog: Dialog,
		private _bootstrapService: IBootstrapService
	) {
		super();
		this._tabs = [];
		this._tabContent = [];
	}

	public createBody(container: HTMLElement): HTMLElement {
		new Builder(container).div({ class: 'dialogModal-pane' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
			if (typeof this._dialog.content === 'string' || this._dialog.content.length < 2) {
				let modelViewId = typeof this._dialog.content === 'string' ? this._dialog.content : this._dialog.content[0].content;
				this.initializeModelViewContainer(this._body, modelViewId);
			} else {
				this._tabbedPanel = new TabbedPanel(this._body);
				this._dialog.content.forEach((tab, tabIndex) => {
					this._tabbedPanel.pushTab({
						title: tab.title,
						identifier: 'dialogPane.' + this._dialog.title + '.' + tabIndex,
						view: {
							render: (container) => {
								this.initializeModelViewContainer(container, tab.content);
							},
							layout: (dimension) => { }
						} as IPanelView
					} as IPanelTab);
				});
			}
		});

		this._activeTabIndex = 0;
		return this._body;
	}

	/**
	 * Bootstrap angular for the dialog's model view controller with the given model view ID
	 */
	private initializeModelViewContainer(bodyContainer: HTMLElement, modelViewId: string) {
		this._bootstrapService.bootstrap(
			DialogModule,
			bodyContainer,
			'dialog-modelview-container',
			{ modelViewId: modelViewId } as DialogComponentParams,
			undefined,
			(moduleRef) => this._moduleRef = moduleRef);
	}

	public show(): void {
		this._body.classList.remove('dialogModal-hidden');
	}

	public hide(): void {
		this._body.classList.add('dialogModal-hidden');
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	public style(styles: IModalDialogStyles): void {
		this._body.style.backgroundColor = styles.dialogBodyBackground ? styles.dialogBodyBackground.toString() : undefined;
		this._body.style.color = styles.dialogForeground ? styles.dialogForeground.toString() : undefined;
	}

	public dispose() {
		super.dispose();
		this._moduleRef.destroy();
	}
}
