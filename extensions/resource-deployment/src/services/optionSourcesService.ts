/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';

interface OptionsSourceContribution {
	id: string;
}

class OptionsSourcesService {
	private _optionsSourceStore = new Map<string, rd.IOptionsSourceProvider>();

	registerOptionsSourceProvider(provider: rd.IOptionsSourceProvider): vscode.Disposable {
		if (this._optionsSourceStore.has(provider.id)) {
			throw new Error(loc.optionsSourceAlreadyDefined(provider.id));
		}
		this._optionsSourceStore.set(provider.id, provider);
		return {
			dispose: () => this.unregisterOptionsSourceProvider(provider.id)
		};
	}

	private unregisterOptionsSourceProvider(providerId: string): void {
		this._optionsSourceStore.delete(providerId);
	}

	async getOptionsSource(optionsSourceProviderId: string): Promise<rd.IOptionsSourceProvider> {
		let optionsSource = this._optionsSourceStore.get(optionsSourceProviderId);
		if (optionsSource === undefined) {
			// We don't have the provider registered yet so try to find and activate the extension that contributes it
			const ext = vscode.extensions.all.find(extension => {
				return !!(extension.packageJSON.contributes?.resourceDeploymentOptionsSources as OptionsSourceContribution[])?.find(optionsSource => optionsSource.id === optionsSourceProviderId);
			});
			if (ext) {
				await ext.activate();
			}
			optionsSource = this._optionsSourceStore.get(optionsSourceProviderId);
			// Still don't have it registered - is the extension not properly registering it?
			if (optionsSource === undefined) {
				throw new Error(loc.noOptionsSourceDefined(optionsSourceProviderId));
			}
		}
		return optionsSource!;
	}
}

export const optionsSourcesService = new OptionsSourcesService();
