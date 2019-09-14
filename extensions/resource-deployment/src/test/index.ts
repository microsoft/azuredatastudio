/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Mocha from 'mocha';
import * as path from 'path';
import * as glob from 'glob';

const suite = 'Resource Deployment Unit Tests';

export function run(): Promise<void> {
	const options: Mocha.MochaOptions = {
		ui: 'tdd',
		timeout: 600000,
		grep: process.env.ADS_TEST_GREP
	};

	if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
		options.reporter = 'mocha-multi-reporters';
		options.reporterOptions = {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				testsuitesTitle: `${suite} ${process.platform}`,
				mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
			}
		};
	}

	const mocha = new Mocha(options);
	mocha.useColors(true);

	if (process.env.ADS_TEST_INVERT_GREP) {
		mocha.invert();
	}

	const testsRoot = path.resolve(__dirname, '.');

	return new Promise((c, e) => {
		glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
			if (err) {
				return e(err);
			}

			// Add files to the test suite
			files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				// Run the mocha test
				mocha.run(failures => {
					if (failures > 0) {
						e(new Error(`${failures} tests failed.`));
					} else {
						c();
					}
				});
			} catch (err) {
				e(err);
			}
		});
	});
}
