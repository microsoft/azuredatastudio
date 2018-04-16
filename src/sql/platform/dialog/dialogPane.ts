/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/wizardModal';
import { Modal, IModalOptions, IModalDialogStyles } from 'sql/base/browser/ui/modal/modal';
import { Builder } from 'vs/base/browser/builder';
import { IPartService, Dimension } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler, IThemable } from 'vs/platform/theme/common/styler';
import { attachModalDialogStyler } from '../../common/theme/styler';
import { Wizard, DialogPage, Dialog, OptionsDialogButton } from './dialogTypes';
import { Button } from 'vs/base/browser/ui/button/button';
import { Disposable } from 'vs/base/common/lifecycle';
import { TabbedPanel, IPanelTab, IPanelView } from '../../base/browser/ui/panel/panel';


export class DialogPane extends Disposable implements IThemable {
	private _activeTabIndex: number;
	private _tabbedPanel: TabbedPanel;

	// HTML Elements
	private _body: HTMLElement;
	private _tabBar: HTMLElement;
	private _tabs: HTMLElement[];
	private _tabContent: HTMLElement[];

	constructor(
		private _dialog: Dialog,
		// @IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
	) {
		super();
		this._tabs = [];
		this._tabContent = [];
	}

	public createBody(container: HTMLElement): HTMLElement {
		new Builder(container).div({ class: 'customDialog-pane' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
			if (this._dialog.tabs.length > 1) {
				this._tabbedPanel = new TabbedPanel(this._body);
				this._dialog.tabs.forEach((tab, tabIndex) => {
					this._tabbedPanel.pushTab({
						title: tab.title,
						identifier: 'dialogPane.' + this._dialog.title + '.' + tabIndex,
						view: {
							render: (container) => {
								// TODO: Do something with the content
							},
							layout: (dimension) => {

							}
						} as IPanelView
					} as IPanelTab);
				});
			} else {
				// TODO: Do something with the content
			}
		});

		this._activeTabIndex = 0;
		return this._body;
	}

	public show(): void {
		this._body.classList.remove('customDialog-hidden');
	}

	public hide(): void {
		this._body.classList.add('customDialog-hidden');
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	public style(styles: IModalDialogStyles): void {
		this._body.style.backgroundColor = styles.dialogBodyBackground ? styles.dialogBodyBackground.toString() : undefined;
		this._body.style.color = styles.dialogForeground ? styles.dialogForeground.toString() : undefined;
	}
}