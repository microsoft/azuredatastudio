// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

// import * as vscode from 'vscode';

// declare var require: any;
// let vsls = require('vsls');

// import { SharedService }  from './liveshare';

// export class HostSessionManager {
// 	constructor(
// 		context: vscode.ExtensionContext,
// 	//	private readonly liveShare: LiveShare,
// 		private readonly sharedService: SharedService
// 	) {
// 		const vslsApi = vsls.getApi();

// 		if (!vslsApi) {
// 			return;
// 		}

// 		this.sharedService.onRequest('load', (args) => {
// 			// this.log.debug('Received adapters request');

// 			// const adapterIds = [ ...this.adapters.keys() ];
// 			// const response = adapterIds.map(adapterId => {
// 			// 	if (this.tests.has(adapterId)) {
// 			// 		return { adapterId, tests: this.tests.get(adapterId) || null }
// 			// 	} else {
// 			// 		return { adapterId };
// 			// 	}
// 			// });

// 			// this.log.debug(`Sending adapters response: ${JSON.stringify(response)}`);
// 			return args;
// 		});

// 		context.subscriptions.push(sharedService.onDidChangeIsServiceAvailable(available => {
// 		//	available ? this.startSession() : this.endSession();
// 		}));
// 	}
// }
