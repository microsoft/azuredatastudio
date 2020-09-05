/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as arc from 'arc';
import * as vscode from 'vscode';
import * as should from 'should';
import { ArcService } from '../services/arcService';

suite.skip('arc service Tests', function (): void {
	before(async () => {
		const arcExtension = vscode.extensions.getExtension<arc.IExtension>(arc.extension.name);
		if (arcExtension) {
			if (!arcExtension.isActive) {
				arcExtension.activate();
			} else {
				console.log(`arc extension was already activated when the tests started`);
			}
		}
	});

	const arcService = new ArcService();
	test('arc service fetches registered arc data controllers() successfully', () => {
		should(arcService.getRegisteredDataControllers()).not.be.undefined();
	});
});
