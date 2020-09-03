/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dataworkspace from 'dataworkspace';
import * as vscode from 'vscode';
import { IProjectProviderRegistry } from './interfaces';

export const ProjectProviderRegistry: IProjectProviderRegistry = new class implements IProjectProviderRegistry {
	private _providers = new Array<dataworkspace.IProjectProvider>();

	registerProvider(provider: dataworkspace.IProjectProvider): vscode.Disposable {
		this.validateProvider(provider);
		this._providers.push(provider);
		return new vscode.Disposable(() => {
			const idx = this._providers.indexOf(provider);
			if (idx >= 0) {
				this._providers.splice(idx, 1);
			}
		});
	}

	get providers(): dataworkspace.IProjectProvider[] {
		return this._providers.slice(0);
	}

	clear(): void {
		this._providers.length = 0;
	}

	validateProvider(provider: dataworkspace.IProjectProvider): void {
	}
};
