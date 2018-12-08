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

export interface NotebookProviderDescription {
	provider: string;
	fileExtensions: string | string[];
}

let notebookProviderType: IJSONSchema = {
	type: 'object',
	default: { provider: '', fileExtensions: [] },
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
	readonly providers: NotebookProviderDescription[];
	readonly onNewProvider: Event<{ id: string, properties: NotebookProviderDescription }>;

	registerNotebookProvider(provider: NotebookProviderDescription): void;
}

class NotebookProviderRegistry implements INotebookProviderRegistry {
	private providerIdToProviders = new Map<string, NotebookProviderDescription>();
	private _onNewProvider = new Emitter<{ id: string, properties: NotebookProviderDescription }>();
	public readonly onNewProvider: Event<{ id: string, properties: NotebookProviderDescription }> = this._onNewProvider.event;

	registerNotebookProvider(provider: NotebookProviderDescription): void {
		// Note: this method intentionally overrides default provider for a file type.
		// This means that any built-in provider will be overridden by registered extensions
		this.providerIdToProviders.set(provider.provider, provider);
		this._onNewProvider.fire( { id: provider.provider, properties: provider });
	}

	public get providers(): NotebookProviderDescription[] {
		let providerArray: NotebookProviderDescription[] = [];
		this.providerIdToProviders.forEach(p => providerArray.push(p));
		return providerArray;
	}
}

const notebookProviderRegistry = new NotebookProviderRegistry();
platform.Registry.add(Extensions.NotebookProviderContribution, notebookProviderRegistry);


ExtensionsRegistry.registerExtensionPoint<NotebookProviderDescription | NotebookProviderDescription[]>(Extensions.NotebookProviderContribution, [], notebookContrib).setHandler(extensions => {

	function handleExtension(contrib: NotebookProviderDescription, extension: IExtensionPointUser<any>) {
		notebookProviderRegistry.registerNotebookProvider(contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<NotebookProviderDescription>(value)) {
			for (let command of value) {
				handleExtension(command, extension);
			}
		} else {
			handleExtension(value, extension);
		}
	}
});
