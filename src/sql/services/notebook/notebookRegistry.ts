/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { ExtensionsRegistry, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { localize } from 'vs/nls';
import * as platform from 'vs/platform/registry/common/platform';

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
	registerNotebookProvider(provider: NotebookProviderDescription): void;
	getSupportedFileExtensions(): string[];
	getProviderForFileType(fileType: string): string;
}

class NotebookProviderRegistry implements INotebookProviderRegistry {
	private providerIdToProviders = new Map<string, NotebookProviderDescription>();
	private fileToProviders = new Map<string, NotebookProviderDescription>();

	registerNotebookProvider(provider: NotebookProviderDescription): void {
		// Note: this method intentionally overrides default provider for a file type.
		// This means that any built-in provider will be overridden by registered extensions
		this.providerIdToProviders.set(provider.provider, provider);
		if (provider.fileExtensions) {
			if (Array.isArray<string>(provider.fileExtensions)) {
				for (let fileType of provider.fileExtensions) {
					this.addFileProvider(fileType, provider);
				}
			} else {
				this.addFileProvider(provider.fileExtensions, provider);
			}
		}
	}

	private addFileProvider(fileType: string, provider: NotebookProviderDescription) {
		this.fileToProviders.set(fileType.toUpperCase(), provider);
	}

	getSupportedFileExtensions(): string[] {
		return Array.from(this.fileToProviders.keys());
	}

	getProviderForFileType(fileType: string): string {
		fileType = fileType.toUpperCase();
		let provider = this.fileToProviders.get(fileType);
		return provider ? provider.provider : undefined;
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
