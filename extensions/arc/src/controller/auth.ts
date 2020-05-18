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

export class KerberosAuth extends SslAuth implements Authentication {

	constructor(public kerberosToken: string) {
		super();
	}

	applyToRequest(requestOptions: request.Options): void {
		super.applyToRequest(requestOptions);
		if (requestOptions && requestOptions.headers) {
			requestOptions.headers['Authorization'] = `Negotiate ${this.kerberosToken}`;
		}
		requestOptions.auth = undefined;
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

export class OAuthWithSsl extends SslAuth implements Authentication {
	constructor(public accessToken: string) {
		super();
	}

	applyToRequest(requestOptions: request.Options): void {
		super.applyToRequest(requestOptions);
		if (requestOptions && requestOptions.headers) {
			requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
		}
		requestOptions.auth = undefined;
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
