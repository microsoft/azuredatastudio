/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ComponentBase, ContainerBase, ItemDescriptor } from 'sql/workbench/browser/modelComponents/componentBase';
import { ModelStore } from 'sql/workbench/browser/modelComponents/modelStore';
import { ChangeDetectorRef } from '@angular/core';
import { IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';


class TestComponent extends ComponentBase {
	public descriptor: IComponentDescriptor;

	constructor(public modelStore: IModelStore, id: string) {
		super(undefined, undefined);
		this.descriptor = modelStore.createComponentDescriptor('TestComponent', id);
		this.baseInit();
	}

	ngOnInit() { }
	setLayout() { }

	public addValidation(validation: () => boolean | Thenable<boolean>) {
		this._validations.push(validation);
	}
}

class TestContainer extends ContainerBase<TestComponent> {
	public descriptor: IComponentDescriptor;

	constructor(public modelStore: IModelStore, id: string) {
		super(undefined, undefined);
		this.descriptor = modelStore.createComponentDescriptor('TestContainer', id);
		this._changeRef = {
			detectChanges: () => undefined
		} as ChangeDetectorRef;
		this.baseInit();
	}

	public get TestItems(): ItemDescriptor<TestComponent>[] {
		return this.items;
	}

	ngOnInit() { }
	setLayout() { }

	public addValidation(validation: () => boolean | Thenable<boolean>) {
		this._validations.push(validation);
	}
}

suite('ComponentBase Tests', () => {
	let testComponent: TestComponent;
	let testComponent2: TestComponent;
	let testContainer: TestContainer;
	let modelStore: IModelStore;

	setup(() => {
		modelStore = new ModelStore();
		testComponent = new TestComponent(modelStore, 'testComponent');
		testComponent2 = new TestComponent(modelStore, 'testComponent2');
		testContainer = new TestContainer(modelStore, 'testContainer');
	});

	test('Component validation runs external validations stored in the model store', () => {
		assert.equal(testComponent.valid, true, 'Test component validity did not default to true');
		let validationCalls = 0;
		modelStore.registerValidationCallback(componentId => {
			validationCalls += 1;
			return Promise.resolve(false);
		});

		return testComponent.validate().then(valid => {
			assert.equal(validationCalls, 1, 'External validation was not called once');
			assert.equal(valid, false, 'Validate call did not return correct value from the external validation');
			assert.equal(testComponent.valid, false, 'Validate call did not update the component valid property');
		});
	});

	test('Component validation runs default component validations', () => {
		assert.equal(testComponent.valid, true, 'Test component validity did not default to true');
		let validationCalls = 0;
		testComponent.addValidation(() => {
			validationCalls += 1;
			return false;
		});

		return testComponent.validate().then(valid => {
			assert.equal(validationCalls, 1, 'Default validation was not called once');
			assert.equal(valid, false, 'Validate call did not return correct value from the default validation');
			assert.equal(testComponent.valid, false, 'Validate call did not update the component valid property');
		});
	});

	test('Container validation reflects child component validity', () => {
		assert.equal(testContainer.valid, true, 'Test container validity did not default to true');
		testContainer.addToContainer(testComponent.descriptor, undefined);
		testComponent.addValidation(() => false);
		return testComponent.validate().then(() => {
			return testContainer.validate().then(valid => {
				assert.equal(valid, false, 'Validate call did not return correct value for container child validation');
				assert.equal(testContainer.valid, false, 'Validate call did not update the container valid property');
			});
		});
	});

	test('Container child validity changes cause the parent container validity to change', done => {
		testContainer.registerEventHandler(event => {
			try {
				if (event.eventType === ComponentEventType.validityChanged) {
					assert.equal(testContainer.valid, false, 'Test container validity did not change to false when child validity changed');
					assert.equal(event.args, false, 'ValidityChanged event did not contain the updated container validity');
					done();
				}
			} catch (err) {
				done(err);
			}
		});
		testComponent.addValidation(() => false);
		testContainer.addToContainer(testComponent.descriptor, undefined);
		testComponent.validate();
	});

	test('Inserting a component to a container adds the component to the right place', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		testContainer.addToContainer(testComponent2.descriptor, undefined, 0);
		assert.equal(testContainer.TestItems.length, 2, `Unexpected number of items. Expected 2 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		assert.equal(testContainer.TestItems[0].descriptor.id, testComponent2.descriptor.id);
	});

	test('Inserting a component to a container given negative index fails', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		assert.throws(() => testContainer.addToContainer(testComponent2.descriptor, undefined, -1));
	});

	test('Inserting a component to a container given wrong index fails', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		assert.throws(() => testContainer.addToContainer(testComponent2.descriptor, undefined, 10));
	});

	test('Inserting a component to a container given end of list succeeds', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		testContainer.addToContainer(testComponent2.descriptor, undefined, 1);
		assert.equal(testContainer.TestItems.length, 2, `Unexpected number of items. Expected 2 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
	});

	test('Removing a component the does not exist does not make change in the items', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		testContainer.removeFromContainer(testComponent2.descriptor);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
	});

	test('Removing a component removes it from items', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		testContainer.addToContainer(testComponent2.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 2, `Unexpected number of items. Expected 2 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		testContainer.removeFromContainer(testComponent.descriptor);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		assert.equal(testContainer.TestItems[0].descriptor.id, testComponent2.descriptor.id);
	});

	test('Container dost not add same component twice', () => {
		testContainer.addToContainer(testComponent.descriptor, undefined);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
		testContainer.addToContainer(testComponent.descriptor, 0);
		assert.equal(testContainer.TestItems.length, 1, `Unexpected number of items. Expected 1 got ${testContainer.TestItems.length} : ${JSON.stringify(testContainer.TestItems)}`);
	});
});
