/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';
import { clone } from 'vs/base/common/objects';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';

export interface AdminProviderProperties {
	providerId: string;
	displayName: string;
}

export const Extensions = {
	AdminProviderContributions: 'admin.providers'
};

export interface IAdminProviderRegistry {
	registerSerializationProvider(id: string, properties: AdminProviderProperties): void;
	getProperties(id: string): AdminProviderProperties;
	readonly onNewProvider: Event<{ id: string, properties: AdminProviderProperties }>;
	readonly providers: { [id: string]: AdminProviderProperties};
}

class AdminProviderRegistryImpl implements IAdminProviderRegistry {
	private _providers = new Map<string, AdminProviderProperties>();
	private _onNewProvider = new Emitter<{ id: string, properties: AdminProviderProperties }>();
	public readonly onNewProvider: Event<{ id: string, properties: AdminProviderProperties }> = this._onNewProvider.event;

	public registerSerializationProvider(id: string, properties: AdminProviderProperties): void {
		this._providers.set(id, properties);
		this._onNewProvider.fire({ id, properties });
	}

	public getProperties(id: string): AdminProviderProperties {
		return this._providers.get(id);
	}

	public get providers(): { [id: string]: AdminProviderProperties} {
		let rt: { [id: string]: AdminProviderProperties} = {};
		this._providers.forEach((v, k) => {
			rt[k] = clone(v);
		});
		return rt;
	}
}

const adminRegistry = new AdminProviderRegistryImpl();
Registry.add(Extensions.AdminProviderContributions, adminRegistry);

const AdminProviderContrib: IJSONSchema = {
	type: 'object',
	properties: {
		providerId: {
			type: 'string',
			description: localize('schema.providerId', "Common id for the provider")
		},
		displayName: {
			type: 'string',
			description: localize('schema.displayName', "Display Name for the provider")
		}
	},
	required: ['providerId']
};

ExtensionsRegistry.registerExtensionPoint<AdminProviderProperties | AdminProviderProperties[]>('adminProvider', [], AdminProviderContrib).setHandler(extensions => {

	function handleCommand(contrib: AdminProviderProperties, extension: IExtensionPointUser<any>) {
		adminRegistry.registerSerializationProvider(contrib.providerId, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<AdminProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
