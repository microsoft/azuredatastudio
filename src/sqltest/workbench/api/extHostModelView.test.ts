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
	let dropDownBox: sqlops.DropDownComponent;
	let formContainer: sqlops.FormContainer;
	let flexContainer: sqlops.FlexContainer;
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
			$notifyValidation: (handle: number, componentId: string, valid: boolean) => undefined,
			dispose: () => undefined
		}, MockBehavior.Loose);
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$registerEvent(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$setProperties(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$notifyValidation(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Register a model view of an input box and drop down box inside a form container inside a flex container
		extHostModelView = new ExtHostModelView(mainContext);
		extHostModelView.$registerProvider(widgetId, async view => {
			modelView = view;
			inputBox = view.modelBuilder.inputBox()
				.withValidation(component => component.value === validText)
				.component();
			dropDownBox = view.modelBuilder.dropDown().component();
			formContainer = view.modelBuilder.formContainer()
				.withItems([inputBox, dropDownBox])
				.component();
			flexContainer = view.modelBuilder.flexContainer()
				.withItems([formContainer])
				.component();
			await view.initializeModel(flexContainer);
			done();
		});

		extHostModelView.$registerWidget(handle, widgetId, undefined, undefined);
	});

	test('The validity of a component and its containers gets set when it is initialized', done => {
		try {
			assert.equal(modelView.valid, false, 'modelView was not marked as invalid');
			assert.equal(inputBox.valid, false, 'inputBox was not marked as invalid');
			assert.equal(formContainer.valid, false, 'formContainer was not marked as invalid');
			assert.equal(flexContainer.valid, false, 'flexContainer was not marked as invalid');
			assert.equal(dropDownBox.valid, true, 'dropDownBox was marked as invalid');
			done();
		} catch (err) {
			done(err);
		}
	});

	test('Containers reflect validity changes of contained components', done => {
		try {
			inputBox.value = validText;
			assert.equal(modelView.valid, true, 'modelView was not marked as valid');
			assert.equal(inputBox.valid, true, 'inputBox was not marked as valid');
			assert.equal(formContainer.valid, true, 'formContainer was not marked as valid');
			assert.equal(flexContainer.valid, true, 'flexContainer was not marked as valid');
			done();
		} catch (err) {
			done(err);
		}
	});

	test('PropertiesChanged events cause validation', done => {
		try {
			extHostModelView.$handleEvent(handle, inputBox.id, {
				args: {
					'value': validText
				},
				eventType: ComponentEventType.PropertiesChanged
			} as IComponentEventArgs);
			assert.equal(modelView.valid, true, 'modelView was not marked as valid');
			assert.equal(inputBox.valid, true, 'inputBox was not marked as valid');
			assert.equal(formContainer.valid, true, 'formContainer was not marked as valid');
			assert.equal(flexContainer.valid, true, 'flexContainer was not marked as valid');
			done();
		} catch (err) {
			done(err);
		}
	});
});