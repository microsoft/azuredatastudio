/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ComponentBase, ContainerBase, ItemDescriptor } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/workbench/browser/modelComponents/interfaces';
import { ModelStore } from 'sql/workbench/browser/modelComponents/modelStore';
import { ChangeDetectorRef } from '@angular/core';


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

	test('Component validation runs external validations stored in the model store', done => {
		assert.equal(testComponent.valid, true, 'Test component validity did not default to true');
		let validationCalls = 0;
		modelStore.registerValidationCallback(componentId => {
			validationCalls += 1;
			return Promise.resolve(false);
		});

		testComponent.validate().then(valid => {
			try {
				assert.equal(validationCalls, 1, 'External validation was not called once');
				assert.equal(valid, false, 'Validate call did not return correct value from the external validation');
				assert.equal(testComponent.valid, false, 'Validate call did not update the component valid property');
				done();
			} catch (err) {
				done(err);
			}
		}, err => done(err));
	});

	test('Component validation runs default component validations', done => {
		assert.equal(testComponent.valid, true, 'Test component validity did not default to true');
		let validationCalls = 0;
		testComponent.addValidation(() => {
			validationCalls += 1;
			return false;
		});

		testComponent.validate().then(valid => {
			try {
				assert.equal(validationCalls, 1, 'Default validation was not called once');
				assert.equal(valid, false, 'Validate call did not return correct value from the default validation');
				assert.equal(testComponent.valid, false, 'Validate call did not update the component valid property');
				done();
			} catch (err) {
				done(err);
			}
		}, err => done(err));
	});

	test('Container validation reflects child component validity', done => {
		assert.equal(testContainer.valid, true, 'Test container validity did not default to true');
		testContainer.addToContainer(testComponent.descriptor, undefined);
		testComponent.addValidation(() => false);
		testComponent.validate().then(() => {
			testContainer.validate().then(valid => {
				assert.equal(valid, false, 'Validate call did not return correct value for container child validation');
				assert.equal(testContainer.valid, false, 'Validate call did not update the container valid property');
				done();
			}, err => done(err));
		}, err => done(err));
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


	test('Component convert size should add px', () => {
		const expected = '100px';
		const actual = testComponent.convertSize(100);
		assert.equal(expected, actual);
	});

	test('Component convert size should not add px if it already has it', () => {
		const expected = '100px';
		const actual = testComponent.convertSize('100px');
		assert.equal(expected, actual);
	});

	test('Component convert size should not add px if it is a percent value', () => {
		const expected = '100%';
		const actual = testComponent.convertSize('100%');
		assert.equal(expected, actual);
	});

	test('Component convert size should keep value if ends with %', () => {
		const expected = '100%';
		const actual = testComponent.convertSize('100%');
		assert.equal(expected, actual);
	});

	test('Component convert size should return the default value given undefined value %', () => {
		const expected = '200';
		const actual = testComponent.convertSize(undefined, '200');
		assert.equal(expected, actual);
	});

	test('Component convert to number should return size without px', () => {
		const expected = 200;
		const actual = testComponent.convertSizeToNumber('200px');
		assert.equal(expected, actual);
	});

	test('Component convert to number should return same value if already plain number', () => {
		const expected = 200;
		const actual = testComponent.convertSizeToNumber('200');
		assert.equal(expected, actual);
	});

	test('Component convert to number should return 0 given undefined', () => {
		const expected = 0;
		const actual = testComponent.convertSizeToNumber(undefined);
		assert.equal(expected, actual);
	});

});
