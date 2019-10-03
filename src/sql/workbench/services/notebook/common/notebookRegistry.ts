/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { ExtensionsRegistry, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { localize } from 'vs/nls';
import * as platform from 'vs/platform/registry/common/platform';
import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';

export const Extensions = {
	NotebookProviderContribution: 'notebook.providers',
	NotebookLanguageMagicContribution: 'notebook.languagemagics'
};

export interface NotebookProviderRegistration {
	provider: string;
	fileExtensions: string | string[];
	standardKernels: azdata.nb.IStandardKernel | azdata.nb.IStandardKernel[];
}

let notebookProviderType: IJSONSchema = {
	type: 'object',
	default: { provider: '', fileExtensions: [], standardKernels: [] },
	properties: {
		provider: {
			description: localize('carbon.extension.contributes.notebook.provider', "Identifier of the notebook provider."),
			type: 'string'
		},
		fileExtensions: {
			description: localize('carbon.extension.contributes.notebook.fileExtensions', "What file extensions should be registered to this notebook provider"),
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
			description: localize('carbon.extension.contributes.notebook.standardKernels', "What kernels should be standard with this notebook provider"),
			oneOf: [
				{
					type: 'object',
					properties: {
						name: {
							type: 'string',
						},
						displayName: {
							type: 'string',
						},
						connectionProviderIds: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					}
				},
				{
					type: 'array',
					items: {
						type: 'object',
						items: {
							type: 'object',
							properties: {
								name: {
									type: 'string',
								},
								connectionProviderIds: {
									type: 'array',
									items: {
										type: 'string'
									}
								}
							}
						}
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
let notebookLanguageMagicType: IJSONSchema = {
	type: 'object',
	default: { magic: '', language: '', kernels: [], executionTarget: null },
	properties: {
		magic: {
			description: localize('carbon.extension.contributes.notebook.magic', "Name of the cell magic, such as '%%sql'."),
			type: 'string'
		},
		language: {
			description: localize('carbon.extension.contributes.notebook.language', "The cell language to be used if this cell magic is included in the cell"),
			type: 'string'
		},
		executionTarget: {
			description: localize('carbon.extension.contributes.notebook.executionTarget', "Optional execution target this magic indicates, for example Spark vs SQL"),
			type: 'string'
		},
		kernels: {
			description: localize('carbon.extension.contributes.notebook.kernels', "Optional set of kernels this is valid for, e.g. python3, pyspark, sql"),
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

let languageMagicContrib: IJSONSchema = {
	description: localize('vscode.extension.contributes.notebook.languagemagics', "Contributes notebook language."),
	oneOf: [
		notebookLanguageMagicType,
		{
			type: 'array',
			items: notebookLanguageMagicType
		}
	]
};

export interface NotebookLanguageMagicRegistration {
	magic: string;
	language: string;
	kernels?: string[];
	executionTarget?: string;
}

export interface INotebookProviderRegistry {
	readonly providers: NotebookProviderRegistration[];
	readonly languageMagics: NotebookLanguageMagicRegistration[];
	readonly onNewRegistration: Event<{ id: string, registration: NotebookProviderRegistration }>;

	registerNotebookProvider(provider: NotebookProviderRegistration): void;
	registerNotebookLanguageMagic(magic: NotebookLanguageMagicRegistration): void;
}

class NotebookProviderRegistry implements INotebookProviderRegistry {
	private providerIdToRegistration = new Map<string, NotebookProviderRegistration>();
	private magicToRegistration = new Map<string, NotebookLanguageMagicRegistration>();
	private _onNewRegistration = new Emitter<{ id: string, registration: NotebookProviderRegistration }>();
	public readonly onNewRegistration: Event<{ id: string, registration: NotebookProviderRegistration }> = this._onNewRegistration.event;

	registerNotebookProvider(registration: NotebookProviderRegistration): void {
		// Note: this method intentionally overrides default provider for a file type.
		// This means that any built-in provider will be overridden by registered extensions
		this.providerIdToRegistration.set(registration.provider, registration);
		this._onNewRegistration.fire({ id: registration.provider, registration: registration });
	}

	public get providers(): NotebookProviderRegistration[] {
		let registrationArray: NotebookProviderRegistration[] = [];
		this.providerIdToRegistration.forEach(p => registrationArray.push(p));
		return registrationArray;
	}

	registerNotebookLanguageMagic(magicRegistration: NotebookLanguageMagicRegistration): void {
		this.magicToRegistration.set(magicRegistration.magic, magicRegistration);
	}

	public get languageMagics(): NotebookLanguageMagicRegistration[] {
		let registrationArray: NotebookLanguageMagicRegistration[] = [];
		this.magicToRegistration.forEach(p => registrationArray.push(p));
		return registrationArray;
	}

}

const notebookProviderRegistry = new NotebookProviderRegistry();
platform.Registry.add(Extensions.NotebookProviderContribution, notebookProviderRegistry);


ExtensionsRegistry.registerExtensionPoint<NotebookProviderRegistration | NotebookProviderRegistration[]>({ extensionPoint: Extensions.NotebookProviderContribution, jsonSchema: notebookContrib }).setHandler(extensions => {

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

ExtensionsRegistry.registerExtensionPoint<NotebookLanguageMagicRegistration | NotebookLanguageMagicRegistration[]>({ extensionPoint: Extensions.NotebookLanguageMagicContribution, jsonSchema: languageMagicContrib }).setHandler(extensions => {

	function handleExtension(contrib: NotebookLanguageMagicRegistration, extension: IExtensionPointUser<any>) {
		notebookProviderRegistry.registerNotebookLanguageMagic(contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<NotebookLanguageMagicRegistration>(value)) {
			for (let command of value) {
				handleExtension(command, extension);
			}
		} else {
			handleExtension(value, extension);
		}
	}
});
