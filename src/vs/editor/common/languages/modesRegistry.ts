/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Emitter, Event } from 'vs/base/common/event';
import { ILanguageExtensionPoint } from 'vs/editor/common/languages/language';
import { Registry } from 'vs/platform/registry/common/platform';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Mimes } from 'vs/base/common/mime';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';

// Define extension point ids
export const Extensions = {
	ModesRegistry: 'editor.modesRegistry'
};

export class EditorModesRegistry {

	private readonly _languages: ILanguageExtensionPoint[];

	private readonly _onDidChangeLanguages = new Emitter<void>();
	public readonly onDidChangeLanguages: Event<void> = this._onDidChangeLanguages.event;

	constructor() {
		this._languages = [];
	}

	public registerLanguage(def: ILanguageExtensionPoint): IDisposable {
		this._languages.push(def);
		this._onDidChangeLanguages.fire(undefined);
		return {
			dispose: () => {
				for (let i = 0, len = this._languages.length; i < len; i++) {
					if (this._languages[i] === def) {
						this._languages.splice(i, 1);
						return;
					}
				}
			}
		};
	}

	public getLanguages(): ReadonlyArray<ILanguageExtensionPoint> {
		return this._languages;
	}
}

export const ModesRegistry = new EditorModesRegistry();
Registry.add(Extensions.ModesRegistry, ModesRegistry);

export const PLAINTEXT_LANGUAGE_ID = 'plaintext';
export const PLAINTEXT_EXTENSION = '.txt';

ModesRegistry.registerLanguage({
	id: PLAINTEXT_LANGUAGE_ID,
	extensions: [PLAINTEXT_EXTENSION],
	aliases: [nls.localize('plainText.alias', "Plain Text"), 'text'],
	mimetypes: [Mimes.text]
});

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerDefaultConfigurations([{
		overrides: {
			'[plaintext]': {
				'editor.unicodeHighlight.ambiguousCharacters': false,
				'editor.unicodeHighlight.invisibleCharacters': false
			}
		}
	}]);
