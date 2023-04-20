/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Connection, Emitter } from 'vscode-languageserver';
import { Disposable } from './util/dispose';

export type ValidateEnabled = 'ignore' | 'warning' | 'error';

interface Settings {
	readonly markdown: {
		readonly suggest: {
			readonly paths: {
				readonly enabled: boolean;
			};
		};

		readonly experimental: {
			readonly validate: {
				readonly enabled: true;
				readonly referenceLinks: {
					readonly enabled: ValidateEnabled;
				};
				readonly fragmentLinks: {
					readonly enabled: ValidateEnabled;
				};
				readonly fileLinks: {
					readonly enabled: ValidateEnabled;
					readonly markdownFragmentLinks: ValidateEnabled;
				};
				readonly ignoreLinks: readonly string[];
			};
		};
	};
}


export class ConfigurationManager extends Disposable {

	private readonly _onDidChangeConfiguration = this._register(new Emitter<Settings>());
	public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

	private _settings?: Settings;

	constructor(connection: Connection) {
		super();

		// The settings have changed. Is send on server activation as well.
		this._register(connection.onDidChangeConfiguration((change) => {
			this._settings = change.settings;
			this._onDidChangeConfiguration.fire(this._settings!);
		}));
	}

	public getSettings(): Settings | undefined {
		return this._settings;
	}
}
