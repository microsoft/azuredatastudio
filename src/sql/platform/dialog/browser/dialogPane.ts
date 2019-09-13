/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dialogModal';

import { NgModuleRef } from '@angular/core';

import { IModalDialogStyles } from 'sql/workbench/browser/modal/modal';
import { DialogTab } from 'sql/platform/dialog/common/dialogTypes';
import { TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import { bootstrapAngular } from 'sql/platform/bootstrap/browser/bootstrapService';
import { DialogModule } from 'sql/platform/dialog/browser/dialog.module';
import { DialogComponentParams, LayoutRequestParams } from 'sql/platform/dialog/browser/dialogContainer.component';

import * as DOM from 'vs/base/browser/dom';
import { IThemable } from 'vs/platform/theme/common/styler';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { attachTabbedPanelStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

export class DialogPane extends Disposable implements IThemable {
	private _tabbedPanel: TabbedPanel;
	private _moduleRefs: NgModuleRef<{}>[] = [];

	// Validation
	private _modelViewValidityMap = new Map<string, boolean>();

	private _body: HTMLElement;
	private _selectedTabIndex: number = 0; //TODO: can be an option
	private _onLayoutChange = new Emitter<LayoutRequestParams>();
	private _selectedTabContent: string;
	public pageNumber?: number;

	constructor(
		public title: string,
		private _content: string | DialogTab[],
		private _validityChangedCallback: (valid: boolean) => void,
		private _instantiationService: IInstantiationService,
		private _themeService: IThemeService,
		public displayPageTitle: boolean,
		public description?: string,
	) {
		super();
	}

	public createBody(container: HTMLElement): HTMLElement {
		this._body = DOM.append(container, DOM.$('div.dialogModal-pane'));
		if (typeof this._content === 'string' || this._content.length < 2) {
			let modelViewId = typeof this._content === 'string' ? this._content : this._content[0].content;
			this.initializeModelViewContainer(this._body, modelViewId);
		} else {
			this._tabbedPanel = new TabbedPanel(this._body);
			attachTabbedPanelStyler(this._tabbedPanel, this._themeService);
			this._content.forEach((tab, tabIndex) => {
				if (this._selectedTabIndex === tabIndex) {
					this._selectedTabContent = tab.content;
				}
				let tabContainer = document.createElement('div');
				tabContainer.style.display = 'none';
				this._body.appendChild(tabContainer);
				this.initializeModelViewContainer(tabContainer, tab.content, tab);
				this._tabbedPanel.onTabChange(e => {
					tabContainer.style.height = (this.getTabDimension().height - this._tabbedPanel.headersize) + 'px';
					this._onLayoutChange.fire({ modelViewId: tab.content });
				});
				this._tabbedPanel.pushTab({
					title: tab.title,
					identifier: 'dialogPane.' + this.title + '.' + tabIndex,
					view: {
						render: (container) => {
							if (tabContainer.parentElement === this._body) {
								this._body.removeChild(tabContainer);
							}
							container.appendChild(tabContainer);
							tabContainer.style.display = 'block';
						},
						layout: (dimension) => { this.getTabDimension(); },
						focus: () => { this.focus(); }
					}
				});
			});
		}

		return this._body;
	}

	private getTabDimension(): DOM.Dimension {
		return new DOM.Dimension(DOM.getContentWidth(this._body) - 5, DOM.getContentHeight(this._body) - 5);
	}

	public layout(alwaysRefresh: boolean = false): void {
		let layoutParams: LayoutRequestParams = {
			alwaysRefresh: alwaysRefresh,
			modelViewId: this._selectedTabContent
		};
		if (this._tabbedPanel) {
			this._tabbedPanel.layout(this.getTabDimension());
			this._onLayoutChange.fire(layoutParams);
		} else if (alwaysRefresh) {
			this._onLayoutChange.fire(layoutParams);
		}
	}

	/**
	 * Bootstrap angular for the dialog's model view controller with the given model view ID
	 */
	private initializeModelViewContainer(bodyContainer: HTMLElement, modelViewId: string, tab?: DialogTab) {
		bootstrapAngular(this._instantiationService,
			DialogModule,
			bodyContainer,
			'dialog-modelview-container',
			{
				modelViewId: modelViewId,
				validityChangedCallback: (valid: boolean) => {
					this._setValidity(modelViewId, valid);
					if (tab) {
						tab.notifyValidityChanged(valid);
					}
				},
				onLayoutRequested: this._onLayoutChange.event,
				dialogPane: this
			} as DialogComponentParams,
			undefined,
			(moduleRef) => {
				return this._moduleRefs.push(moduleRef);
			});
	}

	public show(focus: boolean = false): void {
		this._body.classList.remove('dialogModal-hidden');
		if (focus) {
			this.focus();
		}
	}

	public hide(): void {
		this._body.classList.add('dialogModal-hidden');
	}

	private focus(): void {
		let focusedElement = <HTMLElement>this._body.querySelector('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
		focusedElement ? focusedElement.focus() : this._body.focus();
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	public style(styles: IModalDialogStyles): void {
		this._body.style.backgroundColor = styles.dialogBodyBackground ? styles.dialogBodyBackground.toString() : undefined;
		this._body.style.color = styles.dialogForeground ? styles.dialogForeground.toString() : undefined;
	}

	private _setValidity(modelViewId: string, valid: boolean) {
		let oldValidity = this.isValid();
		this._modelViewValidityMap.set(modelViewId, valid);
		let newValidity = this.isValid();
		if (newValidity !== oldValidity) {
			this._validityChangedCallback(newValidity);
		}
	}

	private isValid(): boolean {
		let valid = true;
		this._modelViewValidityMap.forEach(value => valid = valid && value);
		return valid;
	}

	public dispose() {
		super.dispose();
		this._body.remove();
		this._moduleRefs.forEach(moduleRef => moduleRef.destroy());
	}
}
