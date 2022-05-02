/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import minimist = require('minimist');
import { Suite, Context } from 'mocha';
import { Application, ApplicationOptions } from '../../automation';

export function describeRepeat(n: number, description: string, callback: (this: Suite) => void): void {
	for (let i = 0; i < n; i++) {
		describe(`${description} (iteration ${i})`, callback);
	}
}

export function itRepeat(n: number, description: string, callback: (this: Context) => any): void {
	for (let i = 0; i < n; i++) {
		it(`${description} (iteration ${i})`, callback);
	}
}

export function beforeSuite(opts: minimist.ParsedArgs, optionsTransform?: (opts: ApplicationOptions) => Promise<ApplicationOptions>) {
	before(async function () {
		try {
			let options: ApplicationOptions = { ...this.defaultOptions };
			console.log('executed options');
			if (optionsTransform) {
				options = await optionsTransform(options);
			}
			console.log('option transform');
			// https://github.com/microsoft/vscode/issues/34988
			const userDataPathSuffix = [...Array(8)].map(() => Math.random().toString(36)[3]).join('');
			const userDataDir = options.userDataDir.concat(`-${userDataPathSuffix}`);
			console.log('user data');
			console.log(userDataDir);
			console.log(options);
			const app = new Application({ ...options, userDataDir });
			await app.start();
			this.app = app;
			console.log('app');
			if (opts.log) {
				const title = this.currentTest!.fullTitle();
				app.logger.log('*** Test start:', title);
			}
			console.log('opt log');
		} catch (e) {
			console.trace(e);
		}
	});
}

export function afterSuite(opts: minimist.ParsedArgs) {
	afterEach(async function () {
		const app = this.app as Application;

		if (this.currentTest?.state === 'failed' && opts.screenshots) {
			const name = this.currentTest!.fullTitle().replace(/[^a-z0-9\-]/ig, '_');
			await app.captureScreenshot(name);
		}
	});

	after(async function () {
		const app = this.app as Application;

		if (app) {
			await app.stop();
		}
	});
}

export function timeout(i: number) {
	return new Promise<void>(resolve => {
		setTimeout(() => {
			resolve();
		}, i);
	});
}
