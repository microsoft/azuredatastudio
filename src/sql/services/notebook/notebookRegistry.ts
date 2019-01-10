/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { ExtensionsRegistry, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { localize } from 'vs/nls';
import * as platform from 'vs/platform/registry/common/platform';
import { Event, Emitter } from 'vs/base/common/event';

export const Extensions = {
	NotebookProviderContribution: 'notebook.providers'
};

export interface NotebookProviderRegistration {
	provider: string;
	fileExtensions: string | string[];
	standardKernels: string | string[];
}

let notebookProviderType: IJSONSchema = {
	type: 'object',
	default: { provider: '', fileExtensions: [], standardKernels: [] },
	properties: {
		provider: {
			description: localize('carbon.extension.contributes.notebook.provider', 'Identifier of the notebook provider.'),
			type: 'string'
		},
		fileExtensions: {
			description: localize('carbon.extension.contributes.notebook.fileExtensions', 'What file extensions should be registered to this notebook provider'),
			oneOf: [
				{ type: 'string' },
				{
					type: 'array',
					items: {
						type: 'string'
					}
				}
			]
		},
		standardKernels: {
			description: localize('carbon.extension.contributes.notebook.standardKernels', 'What kernels should be standard with this notebook provider'),
			oneOf: [
				{ type: 'string' },
				{
					type: 'array',
					items: {
						type: 'string'
					}
				}
			]
		}
	}
};

let notebookContrib: IJSONSchema = {
	description: localize('vscode.extension.contributes.notebook.providers', "Contributes notebook providers."),
	oneOf: [
		notebookProviderType,
		{
			type: 'array',
			items: notebookProviderType
		}
	]
};

export interface INotebookProviderRegistry {
	readonly registrations: NotebookProviderRegistration[];
	readonly onNewRegistration: Event<{ id: string, registration: NotebookProviderRegistration }>;

	registerNotebookProvider(registration: NotebookProviderRegistration): void;
}

class NotebookProviderRegistry implements INotebookProviderRegistry {
	private providerIdToRegistration = new Map<string, NotebookProviderRegistration>();
	private _onNewRegistration = new Emitter<{ id: string, registration: NotebookProviderRegistration }>();
	public readonly onNewRegistration: Event<{ id: string, registration: NotebookProviderRegistration }> = this._onNewRegistration.event;

	registerNotebookProvider(registration: NotebookProviderRegistration): void {
		// Note: this method intentionally overrides default provider for a file type.
		// This means that any built-in provider will be overridden by registered extensions
		this.providerIdToRegistration.set(registration.provider, registration);
		this._onNewRegistration.fire( { id: registration.provider, registration: registration });
	}

	public get registrations(): NotebookProviderRegistration[] {
		let registrationArray: NotebookProviderRegistration[] = [];
		this.providerIdToRegistration.forEach(p => registrationArray.push(p));
		return registrationArray;
	}
}

const notebookProviderRegistry = new NotebookProviderRegistry();
platform.Registry.add(Extensions.NotebookProviderContribution, notebookProviderRegistry);


ExtensionsRegistry.registerExtensionPoint<NotebookProviderRegistration | NotebookProviderRegistration[]>(Extensions.NotebookProviderContribution, [], notebookContrib).setHandler(extensions => {

	function handleExtension(contrib: NotebookProviderRegistration, extension: IExtensionPointUser<any>) {
		notebookProviderRegistry.registerNotebookProvider(contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<NotebookProviderRegistration>(value)) {
			for (let command of value) {
				handleExtension(command, extension);
			}
		} else {
			handleExtension(value, extension);
		}
	}
});
