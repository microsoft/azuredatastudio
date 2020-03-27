/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import { MainViewBase } from './mainViewBase';
import { IPageView } from './interfaces';

/**
 * Wizard view to creates wizard and pages
 */
export class WizardView extends MainViewBase {

	private _wizard: azdata.window.Wizard | undefined;

	/**
	 *
	 */
	constructor(apiWrapper: ApiWrapper) {
		super(apiWrapper);
	}

	private createWizardPage(title: string, componentView: IPageView): azdata.window.WizardPage {
		let viewPanel = this._apiWrapper.createWizardPage(title);
		this.registerContent(viewPanel, componentView);
		componentView.viewPanel = viewPanel;
		return viewPanel;
	}

	/**
	 * Adds wizard page
	 * @param page page
	 * @param index page index
	 */
	public addWizardPage(page: IPageView, index: number): void {
		if (this._wizard) {
			this.addPage(page, index);
			this._wizard.removePage(index);
			if (!page.viewPanel) {
				this.createWizardPage(page.title || '', page);
			}
			this._wizard.addPage(<azdata.window.WizardPage>page.viewPanel, index);
			this._wizard.setCurrentPage(index);
		}
	}

	/**
	 * Adds wizard page
	 * @param page page
	 * @param index page index
	 */
	public removeWizardPage(page: IPageView, index: number): void {
		if (this._wizard && this._pages[index] === page) {
			this._pages = this._pages.splice(index);
			this._wizard.removePage(index);
		}
	}


	/**
	 *
	 * @param title Creates anew wizard
	 * @param pages wizard pages
	 */
	public createWizard(title: string, pages: IPageView[]): azdata.window.Wizard {
		this._wizard = this._apiWrapper.createWizard(title);
		this._pages = pages;
		this._wizard.pages = pages.map(x => this.createWizardPage(x.title || '', x));
		this._wizard.onPageChanged(async (info) => {
			await this.onWizardPageChanged(info);
		});

		return this._wizard;
	}

	public async validate(pageInfo: azdata.window.WizardPageChangeInfo): Promise<boolean> {
		if (pageInfo.lastPage !== undefined) {
			let idxLast = pageInfo.lastPage;
			let lastPage = this._pages[idxLast];
			if (lastPage && lastPage.validate) {
				return await lastPage.validate();
			}
		}
		return true;
	}

	private async onWizardPageChanged(pageInfo: azdata.window.WizardPageChangeInfo) {
		let idxLast = pageInfo.lastPage;
		let lastPage = this._pages[idxLast];
		if (lastPage && lastPage.onLeave) {
			await lastPage.onLeave();
		}

		let idx = pageInfo.newPage;
		let page = this._pages[idx];
		if (page && page.onEnter) {
			await page.onEnter();
		}
	}

	public get wizard(): azdata.window.Wizard | undefined {
		return this._wizard;
	}
}
