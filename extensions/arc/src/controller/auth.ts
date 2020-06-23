/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as vscode from 'vscode';

export interface Authentication {
	applyToRequest(requestOptions: request.Options): Promise<void> | void;
}

class SslAuth implements Authentication {
	constructor() { }

	applyToRequest(requestOptions: request.Options): void {
		requestOptions['agentOptions'] = {
			rejectUnauthorized: !getIgnoreSslVerificationConfigSetting()
		};
	}
}

export class BasicAuth extends SslAuth implements Authentication {
	constructor(public username: string, public password: string) {
		super();
	}

	applyToRequest(requestOptions: request.Options): void {
		super.applyToRequest(requestOptions);
		requestOptions.auth = {
			username: this.username, password: this.password
		};
	}
}

/* Retrieves the current setting for whether to ignore SSL verification errors */
export function getIgnoreSslVerificationConfigSetting(): boolean {
	const arcConfigSectionName = 'arc';
	const ignoreSslConfigName = 'ignoreSslVerification';

	try {
		const config = vscode.workspace.getConfiguration(arcConfigSectionName);
		return config.get<boolean>(ignoreSslConfigName, true);
	} catch (error) {
		console.error(`Unexpected error retrieving ${arcConfigSectionName}.${ignoreSslConfigName} setting : ${error}`);
	}
	return true;
}
