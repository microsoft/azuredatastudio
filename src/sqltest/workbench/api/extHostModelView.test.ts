/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { Mock, It, Times, MockBehavior } from 'typemoq';
import * as sqlops from 'sqlops';
import { ExtHostModelView } from 'sql/workbench/api/node/extHostModelView';
import { MainThreadModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { IComponentShape, IItemConfig, ComponentEventType, IComponentEventArgs, ModelComponentTypes } from 'sql/workbench/api/common/sqlExtHostTypes';
import { TitledFormItemLayout } from 'sql/parts/modelComponents/formContainer.component';

interface InternalItemConfig {
	toIItemConfig(): IItemConfig;
}
interface IWithItemConfig {
	itemConfigs?: InternalItemConfig[];
}

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
			$removeFromContainer: (handle: number, containerId: string, item: IItemConfig) => undefined,
			$setLayout: (handle: number, componentId: string, layout: any) => undefined,
			$setProperties: (handle: number, componentId: string, properties: { [key: string]: any }) => undefined,
			$registerEvent: (handle: number, componentId: string) => undefined,
			dispose: () => undefined,
			$validate: (handle: number, componentId: string) => undefined
		}, MockBehavior.Loose);
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$registerEvent(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$setProperties(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Register a model view of an input box and drop down box inside a form container inside a flex container
		extHostModelView = new ExtHostModelView(mainContext, undefined);
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
		}, undefined);

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

	test('Main thread validityChanged events cause component to fire validity changed events', () => {
		let validityFromEvent: boolean = undefined;
		inputBox.onValidityChanged(valid => validityFromEvent = valid);
		extHostModelView.$handleEvent(handle, inputBox.id, {
			eventType: ComponentEventType.validityChanged,
			args: false
		});
		assert.equal(validityFromEvent, false, 'Main thread validityChanged event did not cause component to fire its own event');
	});

	test('Setting a form component as required initializes the model with the component required', () => {
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());

		// Set up the input component with required initially set to false
		let inputComponent = modelView.modelBuilder.inputBox().component();
		inputComponent.required = false;

		// If I build a form that sets the input component as required
		let inputFormComponent: sqlops.FormComponent = {
			component: inputComponent,
			title: 'test_input',
			required: true
		};
		let requiredFormContainer = modelView.modelBuilder.formContainer().withFormItems([inputFormComponent]).component();
		modelView.initializeModel(requiredFormContainer);

		// Then the input component is sent to the main thread with required set to true
		mockProxy.verify(x => x.$initializeModel(It.isAny(), It.is(rootComponent => {
			return rootComponent.itemConfigs.length === 1 && rootComponent.itemConfigs[0].componentShape.id === inputComponent.id && rootComponent.itemConfigs[0].componentShape.properties['required'] === true;
		})), Times.once());
	});

	test('Form component groups are handled correctly by adding each item in the group and a label to the form', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let topLevelList = modelView.modelBuilder.listBox().component();
		let groupInput = modelView.modelBuilder.inputBox().component();
		let groupDropdown = modelView.modelBuilder.dropDown().component();

		let topLevelInputFormComponent: sqlops.FormComponent = { component: topLevelList, title: 'top_level_input' };
		let groupInputFormComponent: sqlops.FormComponent = { component: groupInput, title: 'group_input' };
		let groupDropdownFormComponent: sqlops.FormComponent = { component: groupDropdown, title: 'group_dropdown' };

		let groupTitle = 'group_title';

		// Give the group a default layout and add one just for the input component too
		let defaultLayout: sqlops.FormItemLayout = {
			horizontal: true
		};
		let groupInputLayout: sqlops.FormItemLayout = {
			horizontal: false
		};

		// If I build a form that has a group with a default layout where one item in the group has its own layout
		let formContainer = modelView.modelBuilder.formContainer().withFormItems([
			topLevelInputFormComponent,
			{
				components: [
					Object.assign(groupInputFormComponent, { layout: groupInputLayout }),
					groupDropdownFormComponent
				],
				title: groupTitle
			}
		], defaultLayout).component();
		modelView.initializeModel(formContainer);

		// Then all the items plus a group label are added and have the correct layouts
		assert.equal(rootComponent.itemConfigs.length, 4);
		let listBoxConfig = rootComponent.itemConfigs[0];
		let groupLabelConfig = rootComponent.itemConfigs[1];
		let inputBoxConfig = rootComponent.itemConfigs[2];
		let dropdownConfig = rootComponent.itemConfigs[3];

		// Verify that the correct items were added
		assert.equal(listBoxConfig.componentShape.type, ModelComponentTypes.ListBox);
		assert.equal(groupLabelConfig.componentShape.type, ModelComponentTypes.Text);
		assert.equal(inputBoxConfig.componentShape.type, ModelComponentTypes.InputBox);
		assert.equal(dropdownConfig.componentShape.type, ModelComponentTypes.DropDown);

		// Verify that the group title was set up correctly
		assert.equal(groupLabelConfig.componentShape.properties['value'], groupTitle);
		assert.equal((groupLabelConfig.config as TitledFormItemLayout).isGroupLabel, true);

		// Verify that the components' layouts are correct
		assert.equal((listBoxConfig.config as sqlops.FormItemLayout).horizontal, defaultLayout.horizontal);
		assert.equal((inputBoxConfig.config as sqlops.FormItemLayout).horizontal, groupInputLayout.horizontal);
		assert.equal((dropdownConfig.config as sqlops.FormItemLayout).horizontal, defaultLayout.horizontal);
	});

	test('Inserting and removing components from a container should work correctly', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let listBox = modelView.modelBuilder.listBox().component();
		let inputBox = modelView.modelBuilder.inputBox().component();
		let dropDown = modelView.modelBuilder.dropDown().component();

		let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
		modelView.initializeModel(flex);

		assert.equal((flex as IWithItemConfig).itemConfigs.length, 2);
		flex.insertItem(dropDown, 1);
		assert.equal((flex as IWithItemConfig).itemConfigs.length, 3);
		assert.equal((flex as IWithItemConfig).itemConfigs[1].toIItemConfig().componentShape.type, ModelComponentTypes.DropDown);
		flex.removeItem(listBox);
		assert.equal((flex as IWithItemConfig).itemConfigs.length, 2);
		assert.equal((flex as IWithItemConfig).itemConfigs[0].toIItemConfig().componentShape.type, ModelComponentTypes.DropDown);
	});

	test('Inserting component give negative number fails', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let listBox = modelView.modelBuilder.listBox().component();
		let inputBox = modelView.modelBuilder.inputBox().component();
		let dropDown = modelView.modelBuilder.dropDown().component();

		let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
		modelView.initializeModel(flex);

		assert.equal((flex as IWithItemConfig).itemConfigs.length, 2);
		assert.throws(() => flex.insertItem(dropDown, -1));
	});

	test('Inserting component give wrong number fails', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let listBox = modelView.modelBuilder.listBox().component();
		let inputBox = modelView.modelBuilder.inputBox().component();
		let dropDown = modelView.modelBuilder.dropDown().component();

		let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
		modelView.initializeModel(flex);

		assert.equal((flex as IWithItemConfig).itemConfigs.length, 2);
		assert.throws(() => flex.insertItem(dropDown, 10));
	});

	test('Inserting component give end of the list fails', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let listBox = modelView.modelBuilder.listBox().component();
		let inputBox = modelView.modelBuilder.inputBox().component();
		let dropDown = modelView.modelBuilder.dropDown().component();

		let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
		modelView.initializeModel(flex);

		assert.equal((flex as IWithItemConfig).itemConfigs.length, 2);
		assert.throws(() => flex.insertItem(dropDown, 2));
	});

	test('Removing a component that does not exist does not fail', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let listBox = modelView.modelBuilder.listBox().component();
		let inputBox = modelView.modelBuilder.inputBox().component();
		let dropDown = modelView.modelBuilder.dropDown().component();

		let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
		modelView.initializeModel(flex);

		let result = flex.removeItem(dropDown);
		assert.equal(result, false);
		assert.equal((flex as IWithItemConfig).itemConfigs.length, 2);
		assert.equal((flex as IWithItemConfig).itemConfigs[0].toIItemConfig().componentShape.type, ModelComponentTypes.ListBox);
	});


	test('Inserting and removing component in a form should work correctly', () => {
		// Set up the mock proxy to save the component that gets initialized so that it can be verified
		let rootComponent: IComponentShape;
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => rootComponent = componentShape);
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		// Set up the form with a top level component and a group
		let listBox = modelView.modelBuilder.listBox().component();
		let inputBox = modelView.modelBuilder.inputBox().component();
		let dropDown = modelView.modelBuilder.dropDown().component();
		let checkBox = modelView.modelBuilder.checkBox().component();

		let groupItems: sqlops.FormComponentGroup = {
			title: 'Group',
			components: [{
				title: 'Drop Down',
				component: dropDown
			}, {
				title: 'Check Box',
				component: checkBox
			}]
		};
		let listBoxFormItem: sqlops.FormComponent = {
			title: 'List Box',
			component: listBox
		};
		let inputBoxFormItem: sqlops.FormComponent = {
			title: 'Input Box',
			component: inputBox
		};

		let formBuilder = modelView.modelBuilder.formContainer();
		formBuilder.addFormItem(listBoxFormItem);
		let form = formBuilder.component();
		modelView.initializeModel(formBuilder.component());

		assert.equal((form as IWithItemConfig).itemConfigs.length, 1);
		formBuilder.insertFormItem(inputBoxFormItem, 0);
		assert.equal((form as IWithItemConfig).itemConfigs.length, 2);
		assert.equal((form as IWithItemConfig).itemConfigs[0].toIItemConfig().componentShape.type, ModelComponentTypes.InputBox);
		formBuilder.insertFormItem(groupItems, 0);
		assert.equal((form as IWithItemConfig).itemConfigs.length, 5);
		formBuilder.removeFormItem(listBoxFormItem);
		assert.equal((form as IWithItemConfig).itemConfigs.length, 4);
		formBuilder.removeFormItem(groupItems);
		assert.equal((form as IWithItemConfig).itemConfigs.length, 1);
		formBuilder.addFormItem(listBoxFormItem);
		assert.equal((form as IWithItemConfig).itemConfigs.length, 2);
		assert.equal((form as IWithItemConfig).itemConfigs[1].toIItemConfig().componentShape.type, ModelComponentTypes.ListBox);
	});
});