/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as Platform from 'vs/platform/registry/common/platform';
//import { ViewletDescriptor, Extensions, Viewlet, ViewletRegistry } from 'vs/workbench/browser/viewlet';
import * as Types from 'vs/base/common/types';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { Extensions, PaneComposite, PaneCompositeDescriptor, PaneCompositeRegistry } from 'vs/workbench/browser/panecomposite';

suite('Data Explorer Viewlet', () => {

	class DataExplorerTestViewlet extends PaneComposite {
		constructor() {
			super('dataExplorer', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
		}

		public override layout(dimension: any): void {
			throw new Error('Method not implemented.');
		}

		protected createViewPaneContainer(parent: HTMLElement): ViewPaneContainer {
			throw new Error('Method not implemented.');
		}
	}

	test('ViewletDescriptor API', function () {
		let d = PaneCompositeDescriptor.create(DataExplorerTestViewlet, 'id', 'name', 'class', 1);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
		assert.strictEqual(d.cssClass, 'class');
		assert.strictEqual(d.order, 1);
	});

	test('Editor Aware ViewletDescriptor API', function () {
		let d = PaneCompositeDescriptor.create(DataExplorerTestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');

		d = PaneCompositeDescriptor.create(DataExplorerTestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
	});

	test('Data Explorer Viewlet extension point and registration', function () {
		assert(Types.isFunction(Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).registerPaneComposite));
		assert(Types.isFunction(Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).getPaneComposite));
		assert(Types.isFunction(Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).getPaneComposites));

		let oldCount = Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).getPaneComposites().length;
		let d = PaneCompositeDescriptor.create(DataExplorerTestViewlet, 'dataExplorer-test-id', 'name');
		Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).registerPaneComposite(d);
		let retrieved = Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).getComposite('dataExplorer-test-id');
		assert(d === retrieved);
		let newCount = Platform.Registry.as<PaneCompositeRegistry>(Extensions.Viewlets).getPaneComposites().length;
		assert.strictEqual(oldCount + 1, newCount);
	});
});
