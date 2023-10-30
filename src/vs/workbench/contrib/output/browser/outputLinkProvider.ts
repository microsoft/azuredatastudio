/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { RunOnceScheduler } from 'vs/base/common/async';
import { IModelService } from 'vs/editor/common/services/model';
import { ILink } from 'vs/editor/common/languages';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { OUTPUT_MODE_ID, LOG_MODE_ID } from 'vs/workbench/services/output/common/output';
import { MonacoWebWorker, createWebWorker } from 'vs/editor/browser/services/webWorker';
import { ICreateData, OutputLinkComputer } from 'vs/workbench/contrib/output/common/outputLinkComputer';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';

export class OutputLinkProvider {

	private static readonly DISPOSE_WORKER_TIME = 3 * 60 * 1000; // dispose worker after 3 minutes of inactivity

	private worker?: MonacoWebWorker<OutputLinkComputer>;
	private disposeWorkerScheduler: RunOnceScheduler;
	private linkProviderRegistration: IDisposable | undefined;

	constructor(
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IModelService private readonly modelService: IModelService,
		@ILanguageConfigurationService private readonly languageConfigurationService: ILanguageConfigurationService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
	) {
		this.disposeWorkerScheduler = new RunOnceScheduler(() => this.disposeWorker(), OutputLinkProvider.DISPOSE_WORKER_TIME);

		this.registerListeners();
		this.updateLinkProviderWorker();
	}

	private registerListeners(): void {
		this.contextService.onDidChangeWorkspaceFolders(() => this.updateLinkProviderWorker());
	}

	private updateLinkProviderWorker(): void {

		// Setup link provider depending on folders being opened or not
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length > 0) {
			if (!this.linkProviderRegistration) {
				this.linkProviderRegistration = this.languageFeaturesService.linkProvider.register([{ language: OUTPUT_MODE_ID, scheme: '*' }, { language: LOG_MODE_ID, scheme: '*' }], {
					provideLinks: async model => {
						const links = await this.provideLinks(model.uri);

						return links && { links };
					}
				});
			}
		} else {
			dispose(this.linkProviderRegistration);
			this.linkProviderRegistration = undefined;
		}

		// Dispose worker to recreate with folders on next provideLinks request
		this.disposeWorker();
		this.disposeWorkerScheduler.cancel();
	}

	private getOrCreateWorker(): MonacoWebWorker<OutputLinkComputer> {
		this.disposeWorkerScheduler.schedule();

		if (!this.worker) {
			const createData: ICreateData = {
				workspaceFolders: this.contextService.getWorkspace().folders.map(folder => folder.uri.toString())
			};

			this.worker = createWebWorker<OutputLinkComputer>(this.modelService, this.languageConfigurationService, {
				moduleId: 'vs/workbench/contrib/output/common/outputLinkComputer',
				createData,
				label: 'outputLinkComputer'
			});
		}

		return this.worker;
	}

	private async provideLinks(modelUri: URI): Promise<ILink[]> {
		const linkComputer = await this.getOrCreateWorker().withSyncedResources([modelUri]);

		return linkComputer.computeLinks(modelUri.toString());
	}

	private disposeWorker(): void {
		if (this.worker) {
			this.worker.dispose();
			this.worker = undefined;
		}
	}
}
