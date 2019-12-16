/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as Platform from 'vs/platform/registry/common/platform';
import { ViewletDescriptor, Extensions, Viewlet, ViewletRegistry } from 'vs/workbench/browser/viewlet';
import * as Types from 'vs/base/common/types';

suite('Data Explorer Viewlet', () => {

	class DataExplorerTestViewlet extends Viewlet {

		constructor() {
			super('dataExplorer', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
		}

		public layout(dimension: any): void {
			throw new Error('Method not implemented.');
		}
	}

	test('ViewletDescriptor API', function () {
		let d = ViewletDescriptor.create(DataExplorerTestViewlet, 'id', 'name', 'class', 1);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
		assert.strictEqual(d.cssClass, 'class');
		assert.strictEqual(d.order, 1);
	});

	test('Editor Aware ViewletDescriptor API', function () {
		let d = ViewletDescriptor.create(DataExplorerTestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');

		d = ViewletDescriptor.create(DataExplorerTestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
	});

	test('Data Explorer Viewlet extension point and registration', function () {
		assert(Types.isFunction(Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).registerViewlet));
		assert(Types.isFunction(Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlet));
		assert(Types.isFunction(Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets));

		let oldCount = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets().length;
		let d = ViewletDescriptor.create(DataExplorerTestViewlet, 'dataExplorer-test-id', 'name');
		Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).registerViewlet(d);
		let retrieved = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlet('dataExplorer-test-id');
		assert(d === retrieved);
		let newCount = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets().length;
		assert.equal(oldCount + 1, newCount);
	});
});
