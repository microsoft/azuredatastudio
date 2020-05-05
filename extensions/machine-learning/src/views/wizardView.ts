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
			const currentPage = this._wizard.currentPage;
			if (page && currentPage < index) {
				this.addPage(page, index);
				this._wizard.removePage(index);
				this.createWizardPage(page.title || '', page);
				this._wizard.addPage(<azdata.window.WizardPage>page.viewPanel, index);
				this._wizard.setCurrentPage(currentPage);
			}
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
		if (pageInfo?.lastPage !== undefined) {
			let idxLast = pageInfo.lastPage;
			let lastPage = this._pages[idxLast];
			if (lastPage && lastPage.validate) {
				return await lastPage.validate();
			}
		}
		return true;
	}

	private async onWizardPageChanged(pageInfo: azdata.window.WizardPageChangeInfo) {
		if (pageInfo?.lastPage !== undefined) {
			let idxLast = pageInfo.lastPage;
			let lastPage = this._pages[idxLast];
			if (lastPage && lastPage.onLeave) {
				await lastPage.onLeave();
			}
		}

		if (pageInfo?.newPage !== undefined) {
			let idx = pageInfo.newPage;
			let page = this._pages[idx];
			if (page && page.onEnter) {
				if (this._wizard && this._wizard.pages.length > idx) {
					this._wizard.pages[idx].title = page.title;
				}
				await page.onEnter();
			}
		}
	}

	public get wizard(): azdata.window.Wizard | undefined {
		return this._wizard;
	}

	public async refresh(): Promise<void> {
		for (let index = 0; index < this._pages.length; index++) {
			const page = this._pages[index];
			if (this._wizard?.pages[index]?.title !== page.title) {
				this.addWizardPage(page, index);
			}
		}
		await super.refresh();
	}
}
