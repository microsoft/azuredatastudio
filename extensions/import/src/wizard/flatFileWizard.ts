/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import {FlatFileProvider} from '../services/contracts';
import {ImportDataModel} from './api/models';
import {ImportPage} from './api/importPage';
// pages
import {FileConfigPage} from './pages/fileConfigPage';
import {ProsePreviewPage} from './pages/prosePreviewPage';
import {ModifyColumnsPage} from './pages/modifyColumnsPage';
import {SummaryPage} from './pages/summaryPage';

export class FlatFileWizard {
	private readonly provider: FlatFileProvider;
	private wizard: sqlops.window.modelviewdialog.Wizard;

	private importAnotherFileButton: sqlops.window.modelviewdialog.Button;

	constructor(provider: FlatFileProvider) {
		this.provider = provider;
	}

	public async start() {
		let model = <ImportDataModel>{};
		//let pages: ImportPage[] = [];
		let pages: Map<number, ImportPage> = new Map<number, ImportPage>();


		// TODO localize this
		let connections = await sqlops.connection.getActiveConnections();
		if (!connections || connections.length === 0) {
			vscode.window.showErrorMessage('Please connect to a server before using this wizard.');
			return;
		}

		this.wizard = sqlops.window.modelviewdialog.createWizard('Import flat file wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage('New Table Details');
		let page2 = sqlops.window.modelviewdialog.createWizardPage('Preview Data');
		let page3 = sqlops.window.modelviewdialog.createWizardPage('Modify Columns');
		let page4 = sqlops.window.modelviewdialog.createWizardPage('Summary');

		let fileConfigPage: FileConfigPage;
		page1.registerContent(async (view) => {
			fileConfigPage = new FileConfigPage(this, model, view, this.provider);
			pages.set(0, fileConfigPage);
			await fileConfigPage.start();
			fileConfigPage.onPageEnter();
		});

		let prosePreviewPage: ProsePreviewPage;
		page2.registerContent(async (view) => {
			prosePreviewPage = new ProsePreviewPage(this, model, view, this.provider);
			pages.set(1, prosePreviewPage);
			await prosePreviewPage.start();
		});

		let modifyColumnsPage: ModifyColumnsPage;
		page3.registerContent(async (view) => {
			modifyColumnsPage = new ModifyColumnsPage(this, model, view, this.provider);
			pages.set(2, modifyColumnsPage);
			await modifyColumnsPage.start();
		});

		let summaryPage: SummaryPage;

		page4.registerContent(async (view) => {
			summaryPage = new SummaryPage(this, model, view, this.provider);
			pages.set(3, summaryPage);
			await summaryPage.start();
		});


		this.importAnotherFileButton = sqlops.window.modelviewdialog.createButton('Import new file');
		this.importAnotherFileButton.onClick(() => {
			//TODO replace this with proper cleanup for all the pages
			this.wizard.close();
			pages.forEach((page) => page.cleanup());
			this.wizard.open();
		});

		this.importAnotherFileButton.hidden = true;
		this.wizard.customButtons = [this.importAnotherFileButton];

		this.wizard.onPageChanged(async (event) => {
			console.log(event);
			let idx = event.newPage;

			let page = pages.get(idx);

			if (page) {
				page.onPageEnter();
			}
		});

		this.wizard.onPageChanged(async (event) => {
			let idx = event.lastPage;

			let page = pages.get(idx);
			if (page) {
				page.onPageLeave();
			}
		});

		// 	if (e.lastPage === 3 && e.newPage !== 3) {
		// 		importAnotherFileButton.hidden = true;
		// 	}
		//
		// 	let oldLabel: string;
		// 	if (e.newPage === 2) {
		// 		oldLabel = wizard.nextButton.label;
		// 		wizard.nextButton.label = 'Import data';
		// 	} else if (oldLabel) {
		// 		wizard.nextButton.label = oldLabel;
		// 	}
		// });


		//not needed for this wizard
		this.wizard.generateScriptButton.hidden = true;

		this.wizard.pages = [page1, page2, page3, page4];
		this.wizard.open();
	}

	public setImportAnotherFileVisibility(visibility: boolean) {
		this.importAnotherFileButton.hidden = !visibility;
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}


}



