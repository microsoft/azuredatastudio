/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { localize } from 'vs/nls';
import * as platform from 'vs/platform/registry/common/platform';
import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';

export const NotebookProviderRegistryId = 'notebooks.providers.registry';

export const Extensions = {
	NotebookProviderDescriptionContribution: 'notebook.providers',
	NotebookLanguageMagicContribution: 'notebook.languagemagics'
};

export interface ProviderDescriptionRegistration {
	provider: string;
	fileExtensions: string | string[];
	standardKernels: azdata.nb.IStandardKernel | azdata.nb.IStandardKernel[];
}

let providerDescriptionType: IJSONSchema = {
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

let providerDescriptionContrib: IJSONSchema = {
	description: localize('vscode.extension.contributes.notebook.providersDescriptions', "Contributes notebook provider descriptions."),
	oneOf: [
		providerDescriptionType,
		{
			type: 'array',
			items: providerDescriptionType
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
	readonly providerDescriptions: ProviderDescriptionRegistration[];
	readonly languageMagics: NotebookLanguageMagicRegistration[];

	readonly onNewDescriptionRegistration: Event<{ id: string, registration: ProviderDescriptionRegistration }>;

	registerProviderDescription(provider: ProviderDescriptionRegistration): void;
	registerNotebookLanguageMagic(magic: NotebookLanguageMagicRegistration): void;
}

class NotebookProviderRegistry implements INotebookProviderRegistry {
	private _providerDescriptionRegistration = new Map<string, ProviderDescriptionRegistration>();
	private _magicToRegistration = new Map<string, NotebookLanguageMagicRegistration>();

	private _onNewDescriptionRegistration = new Emitter<{ id: string, registration: ProviderDescriptionRegistration }>();
	public readonly onNewDescriptionRegistration: Event<{ id: string, registration: ProviderDescriptionRegistration }> = this._onNewDescriptionRegistration.event;

	registerProviderDescription(registration: ProviderDescriptionRegistration): void {
		this._providerDescriptionRegistration.set(registration.provider, registration);
		this._onNewDescriptionRegistration.fire({ id: registration.provider, registration: registration });
	}

	public get providerDescriptions(): ProviderDescriptionRegistration[] {
		let registrationArray: ProviderDescriptionRegistration[] = [];
		this._providerDescriptionRegistration.forEach(p => registrationArray.push(p));
		return registrationArray;
	}

	registerNotebookLanguageMagic(magicRegistration: NotebookLanguageMagicRegistration): void {
		this._magicToRegistration.set(magicRegistration.magic, magicRegistration);
	}

	public get languageMagics(): NotebookLanguageMagicRegistration[] {
		let registrationArray: NotebookLanguageMagicRegistration[] = [];
		this._magicToRegistration.forEach(p => registrationArray.push(p));
		return registrationArray;
	}
}

const notebookProviderRegistry = new NotebookProviderRegistry();
platform.Registry.add(NotebookProviderRegistryId, notebookProviderRegistry);

ExtensionsRegistry.registerExtensionPoint<ProviderDescriptionRegistration | ProviderDescriptionRegistration[]>({ extensionPoint: Extensions.NotebookProviderDescriptionContribution, jsonSchema: providerDescriptionContrib }).setHandler(extensions => {
	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray(value)) {
			for (let command of value) {
				notebookProviderRegistry.registerProviderDescription(command);
			}
		} else {
			notebookProviderRegistry.registerProviderDescription(value);
		}
	}
});

ExtensionsRegistry.registerExtensionPoint<NotebookLanguageMagicRegistration | NotebookLanguageMagicRegistration[]>({ extensionPoint: Extensions.NotebookLanguageMagicContribution, jsonSchema: languageMagicContrib }).setHandler(extensions => {
	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray(value)) {
			for (let command of value) {
				notebookProviderRegistry.registerNotebookLanguageMagic(command);
			}
		} else {
			notebookProviderRegistry.registerNotebookLanguageMagic(value);
		}
	}
});
