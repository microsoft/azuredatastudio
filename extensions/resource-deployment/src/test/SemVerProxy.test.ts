/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert = require('assert');
import { SemVerProxy } from '../services/tools/SemVerProxy';

interface Expected {
	[index: string]: string | number | undefined | Error
	major?: number;
	minor?: number;
	patch?: number;
	build?: string;
	raw?: string;
	prerelease?: string;
	version?: string | Error
}

interface TestDefinition {
	testName: string;
	inputVersion: string;
	expected: Expected;

}


class SymVerProxyTest extends SemVerProxy {
	[index: string]: any;
	constructor(version: string | SemVerProxy, loose?: boolean) {
		super(version, loose);
	}
}

const testDefinitions: TestDefinition[] = [
	{
		testName: 'SemVerProxyTest: canonical 3 part version - Pre-existing common SymVers work as before', inputVersion: '1.2.3', expected: {
			major: 1,
			minor: 2,
			patch: 3,
			raw: '1.2.3',
			version: '1.2.3'
		}
	},
	{
		testName: 'SemVerProxyTest: canonical 4 part version', inputVersion: '1.2.3.4', expected: {
			major: 1,
			minor: 2,
			patch: 3,
			build: '4',
			raw: '1.2.3+4',
			version: '1.2.3.4'
		}
	},
	{
		testName: 'SemVerProxyTest: canonical 8 part version', inputVersion: '1.2.3.4.5.6.7.8', expected: {
			major: 1,
			minor: 2,
			patch: 3,
			build: '4,5,6,7,8',
			raw: '1.2.3+4.5.6.7.8',
			version: '1.2.3.4.5.6.7.8'
		}
	},
	{
		testName: 'SemVerProxyTest: canonical pre-rel version', inputVersion: '1.2.3-rc1.22.33.44+55.66.77', expected: {
			major: 1,
			minor: 2,
			patch: 3,
			build: '55,66,77',
			prerelease: 'rc1,22,33,44',
			raw: '1.2.3-rc1.22.33.44+55.66.77',
			version: '1.2.3-rc1.22.33.44+55.66.77'
		}
	}
];

function validate(test: TestDefinition, semVerProxy: SymVerProxyTest) {
	for (const key in test.expected) {
		const expected = test.expected[key];
		if (expected) {
			assert.equal(semVerProxy[key].toString(), expected.toString(), `validation for property ${key} failed.`);
		}
	}
}

suite('SemVeryProxy Tests', function (): void {
	testDefinitions.forEach((semVerTest: TestDefinition) => {
		test(semVerTest.testName, () => {
			const semVerProxy = new SymVerProxyTest(semVerTest.inputVersion);
			validate(semVerTest, semVerProxy);
		});
	});
});
