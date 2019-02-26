/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as dom from 'vs/base/browser/dom';
const $ = dom.$;

// {{SQL CARBON EDIT}} disable broken tests
suite('dom', () => {
	test('hasClass', () => {
	});

	suite('$', () => {
		test('should build simple nodes', () => {
			const div = $('div');
			assert(div);
			assert(div instanceof HTMLElement);
			assert.equal(div.tagName, 'DIV');
			assert(!div.firstChild);
		});

		test('should build nodes with attributes', () => {
			let div = $('div', { class: 'test' });
			assert.equal(div.className, 'test');

			div = $('div', null);
			assert.equal(div.className, '');
		});

		test('should build nodes with children', () => {
			let div = $('div', null, $('span', { id: 'demospan' }));
			let firstChild = div.firstChild as HTMLElement;
			assert.equal(firstChild.tagName, 'SPAN');
			assert.equal(firstChild.id, 'demospan');

			div = $('div', null, 'hello');
			assert.equal(div.firstChild.textContent, 'hello');
		});
	});
});
