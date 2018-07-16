/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import * as Platform from 'vs/platform/registry/common/platform';
import { ViewletDescriptor, Extensions, Viewlet } from 'vs/workbench/browser/viewlet';
import * as Types from 'vs/base/common/types';

suite('Workbench Viewlet', () => {

	class TestViewlet extends Viewlet {

		constructor() {
			super('id', null, null, null);
		}

		public layout(dimension: any): void {
			throw new Error('Method not implemented.');
		}
	}

	test('ViewletDescriptor API', function () {
		let d = new ViewletDescriptor(TestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
		assert.strictEqual(d.cssClass, 'class');
		assert.strictEqual(d.order, 5);
	});

	test('Editor Aware ViewletDescriptor API', function () {
		let d = new ViewletDescriptor(TestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');

		d = new ViewletDescriptor(TestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
	});

	test('Viewlet extension point and registration', function () {
		assert(Types.isFunction(Platform.Registry.as(Extensions.Viewlets).registerViewlet));
		assert(Types.isFunction(Platform.Registry.as(Extensions.Viewlets).getViewlet));
		assert(Types.isFunction(Platform.Registry.as(Extensions.Viewlets).getViewlets));

		let oldCount = Platform.Registry.as(Extensions.Viewlets).getViewlets().length;
		let d = new ViewletDescriptor(TestViewlet, 'reg-test-id', 'name');
		Platform.Registry.as(Extensions.Viewlets).registerViewlet(d);

		assert(d === Platform.Registry.as(Extensions.Viewlets).getViewlet('reg-test-id'));
		assert.equal(oldCount + 1, Platform.Registry.as(Extensions.Viewlets).getViewlets().length);
	});
});