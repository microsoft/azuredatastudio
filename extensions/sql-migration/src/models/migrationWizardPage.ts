/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationStateModel, StateChangeEvent } from './stateMachine';
export abstract class MigrationWizardPage {
	constructor(
		protected readonly wizard: azdata.window.Wizard,
		protected readonly wizardPage: azdata.window.WizardPage,
		protected readonly migrationStateModel: MigrationStateModel
	) { }

	public registerWizardContent(): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			this.wizardPage.registerContent(async (view) => {
				try {
					await this.registerContent(view);
					resolve();
				} catch (ex) {
					reject(ex);
				} finally {
					reject(new Error());
				}
			});
		});
	}

	protected abstract registerContent(view: azdata.ModelView): Promise<void>;

	public getwizardPage(): azdata.window.WizardPage {
		return this.wizardPage;
	}

	public abstract onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void>;
	public abstract onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void>;

	private readonly stateChanges: (() => Promise<void>)[] = [];
	protected async onStateChangeEvent(e: StateChangeEvent) {

		this.stateChanges.push((): Promise<void> => {
			return this.handleStateChange(e);
		});

		await this.enableQueueProcessor();
	}

	private queueActive = false;
	private async enableQueueProcessor(): Promise<void> {
		if (this.queueActive) {
			return;
		}
		this.queueActive = true;
		while (true) {
			const stateChangeFunction = this.stateChanges.shift();
			if (!stateChangeFunction) {
				break;
			}
			try {
				await stateChangeFunction();
			} catch (ex) {
				console.error(ex);
			}
		}
		this.queueActive = false;
	}

	protected abstract handleStateChange(e: StateChangeEvent): Promise<void>;

	public canEnter(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public canLeave(): Promise<boolean> {
		return Promise.resolve(true);
	}

	protected async goToNextPage(): Promise<void> {
		const current = this.wizard.currentPage;
		await this.wizard.setCurrentPage(current + 1);
	}

}

