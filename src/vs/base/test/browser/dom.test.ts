/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as dom from 'vs/base/browser/dom';
const $ = dom.$;

suite('dom', () => {
	test.skip('hasClass', () => { //{{SQL CARBON EDIT}} skip test

		let element = document.createElement('div');
		element.className = 'foobar boo far';

		assert(dom.hasClass(element, 'foobar'));
		assert(dom.hasClass(element, 'boo'));
		assert(dom.hasClass(element, 'far'));
		assert(!dom.hasClass(element, 'bar'));
		assert(!dom.hasClass(element, 'foo'));
		assert(!dom.hasClass(element, ''));
	});

	test.skip('removeClass', () => { //{{SQL CARBON EDIT}} skip test

		let element = document.createElement('div');
		element.className = 'foobar boo far';

		dom.removeClass(element, 'boo');
		assert(dom.hasClass(element, 'far'));
		assert(!dom.hasClass(element, 'boo'));
		assert(dom.hasClass(element, 'foobar'));
		assert.equal(element.className, 'foobar far');

		element = document.createElement('div');
		element.className = 'foobar boo far';

		dom.removeClass(element, 'far');
		assert(!dom.hasClass(element, 'far'));
		assert(dom.hasClass(element, 'boo'));
		assert(dom.hasClass(element, 'foobar'));
		assert.equal(element.className, 'foobar boo');

		dom.removeClass(element, 'boo');
		assert(!dom.hasClass(element, 'far'));
		assert(!dom.hasClass(element, 'boo'));
		assert(dom.hasClass(element, 'foobar'));
		assert.equal(element.className, 'foobar');

		dom.removeClass(element, 'foobar');
		assert(!dom.hasClass(element, 'far'));
		assert(!dom.hasClass(element, 'boo'));
		assert(!dom.hasClass(element, 'foobar'));
		assert.equal(element.className, '');
	});

	test.skip('removeClass should consider hyphens', function () { //{{SQL CARBON EDIT}} skip test
		let element = document.createElement('div');

		dom.addClass(element, 'foo-bar');
		dom.addClass(element, 'bar');

		assert(dom.hasClass(element, 'foo-bar'));
		assert(dom.hasClass(element, 'bar'));

		dom.removeClass(element, 'bar');
		assert(dom.hasClass(element, 'foo-bar'));
		assert(!dom.hasClass(element, 'bar'));

		dom.removeClass(element, 'foo-bar');
		assert(!dom.hasClass(element, 'foo-bar'));
		assert(!dom.hasClass(element, 'bar'));
	});

	//test('[perf] hasClass * 100000', () => {
	//
	//	for (let i = 0; i < 100000; i++) {
	//		let element = document.createElement('div');
	//		element.className = 'foobar boo far';
	//
	//		assert(dom.hasClass(element, 'far'));
	//		assert(dom.hasClass(element, 'boo'));
	//		assert(dom.hasClass(element, 'foobar'));
	//	}
	//});

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

			div = $('div', undefined);
			assert.equal(div.className, '');
		});

		test('should build nodes with children', () => {
			let div = $('div', undefined, $('span', { id: 'demospan' }));
			let firstChild = div.firstChild as HTMLElement;
			assert.equal(firstChild.tagName, 'SPAN');
			assert.equal(firstChild.id, 'demospan');

			div = $('div', undefined, 'hello');

			assert.equal(div.firstChild && div.firstChild.textContent, 'hello');
		});
	});
});
