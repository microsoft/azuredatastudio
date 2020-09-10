/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProjectProvider } from 'dataworkspace';
import * as vscode from 'vscode';
import { IProjectProviderRegistry } from './interfaces';

export const ProjectProviderRegistry: IProjectProviderRegistry = new class implements IProjectProviderRegistry {
	private _providers = new Array<IProjectProvider>();
	private _providerMapping: { [key: string]: IProjectProvider } = {};

	registerProvider(provider: IProjectProvider): vscode.Disposable {
		this.validateProvider(provider);
		this._providers.push(provider);
		provider.supportedProjectTypes.forEach(projectType => {
			this._providerMapping[projectType.projectFileExtension.toUpperCase()] = provider;
		});
		return new vscode.Disposable(() => {
			const idx = this._providers.indexOf(provider);
			if (idx >= 0) {
				this._providers.splice(idx, 1);
				provider.supportedProjectTypes.forEach(projectType => {
					delete this._providerMapping[projectType.projectFileExtension.toUpperCase()];
				});
			}
		});
	}

	get providers(): IProjectProvider[] {
		return this._providers.slice(0);
	}

	clear(): void {
		this._providers.length = 0;
	}

	validateProvider(provider: IProjectProvider): void {
	}

	getProviderByProjectType(projectType: string): IProjectProvider | undefined {
		return projectType ? this._providerMapping[projectType.toUpperCase()] : undefined;
	}
};
