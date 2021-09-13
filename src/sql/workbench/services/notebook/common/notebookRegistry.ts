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
	NotebookSerializationProviderContribution: 'notebook.serializationProviders',
	NotebookExecuteProviderContribution: 'notebook.executeProviders',
	NotebookLanguageMagicContribution: 'notebook.languagemagics'
};

export interface SerializationProviderRegistration {
	provider: string;
	fileExtensions: string | string[];
}

export interface ExecuteProviderRegistration {
	provider: string;
	fileExtensions: string | string[];
	standardKernels: azdata.nb.IStandardKernel | azdata.nb.IStandardKernel[];
}

let serializationProviderType: IJSONSchema = {
	type: 'object',
	default: { provider: '', fileExtensions: [] },
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
		}
	}
};

let executeProviderType: IJSONSchema = {
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

let notebookSerializationContrib: IJSONSchema = {
	description: localize('vscode.extension.contributes.notebook.serializationProviders', "Contributes notebook serialization providers."),
	oneOf: [
		serializationProviderType,
		{
			type: 'array',
			items: serializationProviderType
		}
	]
};
let notebookExecuteContrib: IJSONSchema = {
	description: localize('vscode.extension.contributes.notebook.executeProviders', "Contributes notebook execute providers."),
	oneOf: [
		executeProviderType,
		{
			type: 'array',
			items: executeProviderType
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
	readonly executeProviders: ExecuteProviderRegistration[];
	readonly serializationProviders: SerializationProviderRegistration[];
	readonly languageMagics: NotebookLanguageMagicRegistration[];
	readonly onNewSerializationRegistration: Event<{ id: string, registration: SerializationProviderRegistration }>;
	readonly onNewExecuteRegistration: Event<{ id: string, registration: ExecuteProviderRegistration }>;

	registerSerializationProvider(provider: SerializationProviderRegistration): void;
	registerExecuteProvider(provider: ExecuteProviderRegistration): void;
	registerNotebookLanguageMagic(magic: NotebookLanguageMagicRegistration): void;
}

class NotebookProviderRegistry implements INotebookProviderRegistry {
	private _serializationProviderRegistration = new Map<string, SerializationProviderRegistration>();
	private _executeProviderRegistration = new Map<string, ExecuteProviderRegistration>();
	private _magicToRegistration = new Map<string, NotebookLanguageMagicRegistration>();
	private _onNewSerializationRegistration = new Emitter<{ id: string, registration: SerializationProviderRegistration }>();
	private _onNewExecuteRegistration = new Emitter<{ id: string, registration: ExecuteProviderRegistration }>();
	public readonly onNewSerializationRegistration: Event<{ id: string, registration: SerializationProviderRegistration }> = this._onNewSerializationRegistration.event;
	public readonly onNewExecuteRegistration: Event<{ id: string, registration: ExecuteProviderRegistration }> = this._onNewExecuteRegistration.event;

	registerSerializationProvider(registration: SerializationProviderRegistration): void {
		// Note: this method intentionally overrides default provider for a file type.
		// This means that any built-in provider will be overridden by registered extensions
		this._serializationProviderRegistration.set(registration.provider, registration);
		this._onNewSerializationRegistration.fire({ id: registration.provider, registration: registration });
	}

	registerExecuteProvider(registration: ExecuteProviderRegistration): void {
		// Note: this method intentionally overrides default provider for a file type.
		// This means that any built-in provider will be overridden by registered extensions
		this._executeProviderRegistration.set(registration.provider, registration);
		this._onNewExecuteRegistration.fire({ id: registration.provider, registration: registration });
	}

	public get serializationProviders(): SerializationProviderRegistration[] {
		let registrationArray: SerializationProviderRegistration[] = [];
		this._executeProviderRegistration.forEach(p => registrationArray.push(p));
		return registrationArray;
	}

	public get executeProviders(): ExecuteProviderRegistration[] {
		let registrationArray: ExecuteProviderRegistration[] = [];
		this._executeProviderRegistration.forEach(p => registrationArray.push(p));
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
platform.Registry.add(Extensions.NotebookSerializationProviderContribution, notebookProviderRegistry);
platform.Registry.add(Extensions.NotebookExecuteProviderContribution, notebookProviderRegistry);

ExtensionsRegistry.registerExtensionPoint<SerializationProviderRegistration | SerializationProviderRegistration[]>({ extensionPoint: Extensions.NotebookSerializationProviderContribution, jsonSchema: notebookSerializationContrib }).setHandler(extensions => {

	function handleExtension(contrib: SerializationProviderRegistration, extension: IExtensionPointUser<any>) {
		notebookProviderRegistry.registerSerializationProvider(contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray(value)) {
			for (let command of value) {
				handleExtension(command, extension);
			}
		} else {
			handleExtension(value, extension);
		}
	}
});

ExtensionsRegistry.registerExtensionPoint<ExecuteProviderRegistration | ExecuteProviderRegistration[]>({ extensionPoint: Extensions.NotebookExecuteProviderContribution, jsonSchema: notebookExecuteContrib }).setHandler(extensions => {

	function handleExtension(contrib: ExecuteProviderRegistration, extension: IExtensionPointUser<any>) {
		notebookProviderRegistry.registerExecuteProvider(contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray(value)) {
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
		if (Array.isArray(value)) {
			for (let command of value) {
				handleExtension(command, extension);
			}
		} else {
			handleExtension(value, extension);
		}
	}
});
