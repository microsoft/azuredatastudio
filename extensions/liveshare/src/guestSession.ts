/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

// declare var require: any;
// let vsls = require('vsls');

import { SharedServiceProxy }  from './liveshare';

export class GuestSessionManager {


	constructor(
		context: vscode.ExtensionContext,
		sharedServiceProxy: SharedServiceProxy
	) {

		sharedServiceProxy.request('load', [ 1000 ]);

		sharedServiceProxy.onNotify('onload', (args: any) => {
			return args;
		});

		if (sharedServiceProxy.isServiceAvailable) {
		}
		context.subscriptions.push(sharedServiceProxy.onDidChangeIsServiceAvailable(available => {
		}));
	}
}
