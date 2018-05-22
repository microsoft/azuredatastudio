/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Mock, It, Times, MockBehavior } from 'typemoq';
import * as sqlops from 'sqlops';
import { ExtHostModelView } from 'sql/workbench/api/node/extHostModelView';
import { MainThreadModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Deferred } from 'sql/base/common/promise';
import { IComponentShape, IItemConfig, ComponentEventType, IComponentEventArgs } from 'sql/workbench/api/common/sqlExtHostTypes';

'use strict';

suite('ExtHostModelView Validation Tests', () => {
	let extHostModelView: ExtHostModelView;
	let mockProxy: Mock<MainThreadModelViewShape>;
	let modelView: sqlops.ModelView;
	let inputBox: sqlops.InputBoxComponent;
	let validText = 'valid';
	let widgetId = 'widget_id';
	let handle = 1;
	// let viewInitialized: Deferred<void>;
	let initializedModels: IComponentShape[];

	setup(done => {
		// Set up the MainThreadModelViewShape proxy
		mockProxy = Mock.ofInstance(<MainThreadModelViewShape>{
			$registerProvider: (id: string) => undefined,
			$initializeModel: (handle: number, rootComponent: IComponentShape) => undefined,
			$clearContainer: (handle: number, componentId: string) => undefined,
			$addToContainer: (handle: number, containerId: string, item: IItemConfig) => undefined,
			$setLayout: (handle: number, componentId: string, layout: any) => undefined,
			$setProperties: (handle: number, componentId: string, properties: { [key: string]: any }) => undefined,
			$registerEvent: (handle: number, componentId: string) => undefined,
			dispose: () => undefined
		}, MockBehavior.Loose);
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$registerEvent(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$setProperties(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Register a model view of an input box and drop down box inside a form container inside a flex container
		extHostModelView = new ExtHostModelView(mainContext);
		extHostModelView.$registerProvider(widgetId, async view => {
			modelView = view;
			inputBox = view.modelBuilder.inputBox()
				.withValidation(component => component.value === validText)
				.component();
			let dropDownBox = view.modelBuilder.dropDown().component();
			let formContainer = view.modelBuilder.formContainer()
				.withItems([inputBox, dropDownBox])
				.component();
			let flexContainer = view.modelBuilder.flexContainer()
				.withItems([formContainer])
				.component();
			await view.initializeModel(flexContainer);
			done();
		});

		extHostModelView.$registerWidget(handle, widgetId, undefined, undefined);
	});

	test('The custom validation output of a component gets set when it is initialized', done => {
		extHostModelView.$runCustomValidations(handle, inputBox.id).then(valid => {
			try {
				assert.equal(valid, false, 'Empty input box did not validate as false');
				done();
			} catch (err) {
				done(err);
			}
		}, err => done(err));
	});

	test('The custom validation output of a component changes if its value changes', done => {
		inputBox.value = validText;
		extHostModelView.$runCustomValidations(handle, inputBox.id).then(valid => {
			try {
				assert.equal(valid, true, 'Valid input box did not validate as valid');
				done();
			} catch (err) {
				done(err);
			}
		}, err => done(err));
	});

	test('The custom validation output of a component changes after a PropertiesChanged event', done => {
		extHostModelView.$handleEvent(handle, inputBox.id, {
			args: {
				'value': validText
			},
			eventType: ComponentEventType.PropertiesChanged
		} as IComponentEventArgs);
		extHostModelView.$runCustomValidations(handle, inputBox.id).then(valid => {
			try {
				assert.equal(valid, true, 'Valid input box did not validate as valid after PropertiesChanged event');
				done();
			} catch (err) {
				done(err);
			}
		}, err => done(err));
	});

	test('The validity of a component is set by main thread validationChanged events', () => {
		assert.equal(inputBox.valid, true, 'Component validity is true by default');
		extHostModelView.$handleEvent(handle, inputBox.id, {
			eventType: ComponentEventType.validityChanged,
			args: false
		});
		assert.equal(inputBox.valid, false, 'Input box did not update validity to false based on the validityChanged event');
		extHostModelView.$handleEvent(handle, inputBox.id, {
			eventType: ComponentEventType.validityChanged,
			args: true
		});
		assert.equal(inputBox.valid, true, 'Input box did not update validity to true based on the validityChanged event');
	});
});