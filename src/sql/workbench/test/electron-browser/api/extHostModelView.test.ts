/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Mock, It, Times, MockBehavior } from 'typemoq';
import * as azdata from 'azdata';
import { ExtHostModelView } from 'sql/workbench/api/common/extHostModelView';
import { MainThreadModelViewShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { IComponentShape, IItemConfig, ComponentEventType, IComponentEventArgs, ModelComponentTypes, DeclarativeDataType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { TitledFormItemLayout } from 'sql/workbench/browser/modelComponents/formContainer.component';
import { assign } from 'vs/base/common/objects';

interface InternalItemConfig {
	toIItemConfig(): IItemConfig;
}
interface IWithItemConfig {
	itemConfigs?: InternalItemConfig[];
}

suite('ExtHostModelView Validation Tests', () => {
	let extHostModelView: ExtHostModelView;
	let mockProxy: Mock<MainThreadModelViewShape>;
	let modelView: azdata.ModelView;
	let inputBox: azdata.InputBoxComponent;
	let validText = 'valid';
	let widgetId = 'widget_id';
	let handle = 1;
	let mainContext: IMainContext;

	// Common setup for all extHostModelView tests
	setup(() => {
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
		mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$registerEvent(It.isAny(), It.isAny())).returns(() => Promise.resolve());
		mockProxy.setup(x => x.$setProperties(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

		extHostModelView = new ExtHostModelView(mainContext, undefined, undefined);
	});

	// Set of general tests using a couple of common components
	suite('Basic', () => {
		setup(done => {
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

		test('The custom validation output of a component gets set when it is initialized', () => {
			return extHostModelView.$runCustomValidations(handle, inputBox.id).then(valid => {
				assert.equal(valid, false, 'Empty input box did not validate as false');
			});
		});

		test('The custom validation output of a component changes if its value changes', () => {
			inputBox.value = validText;
			return extHostModelView.$runCustomValidations(handle, inputBox.id).then(valid => {
				assert.equal(valid, true, 'Valid input box did not validate as valid');
			});
		});

		test('The custom validation output of a component changes after a PropertiesChanged event', () => {
			extHostModelView.$handleEvent(handle, inputBox.id, {
				args: {
					'value': validText
				},
				eventType: ComponentEventType.PropertiesChanged
			} as IComponentEventArgs);
			return extHostModelView.$runCustomValidations(handle, inputBox.id).then(valid => {
				assert.equal(valid, true, 'Valid input box did not validate as valid after PropertiesChanged event');
			});
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
			let inputFormComponent: azdata.FormComponent = {
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

			let topLevelInputFormComponent: azdata.FormComponent = { component: topLevelList, title: 'top_level_input' };
			let groupInputFormComponent: azdata.FormComponent = { component: groupInput, title: 'group_input' };
			let groupDropdownFormComponent: azdata.FormComponent = { component: groupDropdown, title: 'group_dropdown' };

			let groupTitle = 'group_title';

			// Give the group a default layout and add one just for the input component too
			let defaultLayout: azdata.FormItemLayout = {
				horizontal: true
			};
			let groupInputLayout: azdata.FormItemLayout = {
				horizontal: false
			};

			// If I build a form that has a group with a default layout where one item in the group has its own layout
			let formContainer = modelView.modelBuilder.formContainer().withFormItems([
				topLevelInputFormComponent,
				{
					components: [
						assign(groupInputFormComponent, { layout: groupInputLayout }),
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
			assert.equal(listBoxConfig.componentShape.type, ModelComponentTypes.ListBox, `Unexpected ModelComponentType. Expected ListBox but got ${ModelComponentTypes[listBoxConfig.componentShape.type]}`);
			assert.equal(groupLabelConfig.componentShape.type, ModelComponentTypes.Text, `Unexpected ModelComponentType. Expected Text but got ${ModelComponentTypes[groupLabelConfig.componentShape.type]}`);
			assert.equal(inputBoxConfig.componentShape.type, ModelComponentTypes.InputBox, `Unexpected ModelComponentType. Expected InputBox but got ${ModelComponentTypes[inputBoxConfig.componentShape.type]}`);
			assert.equal(dropdownConfig.componentShape.type, ModelComponentTypes.DropDown, `Unexpected ModelComponentType. Expected DropDown but got ${ModelComponentTypes[dropdownConfig.componentShape.type]}`);

			// Verify that the group title was set up correctly
			assert.equal(groupLabelConfig.componentShape.properties['value'], groupTitle, `Unexpected title. Expected ${groupTitle} but got ${groupLabelConfig.componentShape.properties['value']}`);
			assert.equal((groupLabelConfig.config as TitledFormItemLayout).isGroupLabel, true, `Unexpected value for isGroupLabel. Expected true but got ${(groupLabelConfig.config as TitledFormItemLayout).isGroupLabel}`);

			// Verify that the components' layouts are correct
			assert.equal((listBoxConfig.config as azdata.FormItemLayout).horizontal, defaultLayout.horizontal, `Unexpected layout for listBoxConfig. Expected defaultLayout.horizontal but got ${(listBoxConfig.config as azdata.FormItemLayout).horizontal}`);
			assert.equal((inputBoxConfig.config as azdata.FormItemLayout).horizontal, groupInputLayout.horizontal, `Unexpected layout for inputBoxConfig. Expected groupInputLayout.horizontal but got ${(inputBoxConfig.config as azdata.FormItemLayout).horizontal}`);
			assert.equal((dropdownConfig.config as azdata.FormItemLayout).horizontal, defaultLayout.horizontal, `Unexpected layout for dropdownConfig. Expected defaultLayout.horizontal but got ${(dropdownConfig.config as azdata.FormItemLayout).horizontal}`);
		});

		test('Inserting and removing components from a container should work correctly', () => {
			mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny()));
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			// Set up the form with a top level component and a group
			let listBox = modelView.modelBuilder.listBox().component();
			let inputBox = modelView.modelBuilder.inputBox().component();
			let dropDown = modelView.modelBuilder.dropDown().component();

			let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
			modelView.initializeModel(flex);

			const itemConfigs: InternalItemConfig[] = (flex as IWithItemConfig).itemConfigs;
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			flex.insertItem(dropDown, 1);
			assert.equal(itemConfigs.length, 3, `Unexpected number of items in list. Expected 3, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.equal(itemConfigs[1].toIItemConfig().componentShape.type, ModelComponentTypes.DropDown, `Unexpected ModelComponentType. Expected DropDown but got ${ModelComponentTypes[itemConfigs[1].toIItemConfig().componentShape.type]}`);
			flex.removeItem(listBox);
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.equal(itemConfigs[0].toIItemConfig().componentShape.type, ModelComponentTypes.DropDown, `Unexpected ModelComponentType. Expected DropDown but got ${ModelComponentTypes[itemConfigs[0].toIItemConfig().componentShape.type]}`);
		});

		test('Inserting component give negative number fails', () => {
			mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => { });
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

			// Set up the form with a top level component and a group
			let listBox = modelView.modelBuilder.listBox().component();
			let inputBox = modelView.modelBuilder.inputBox().component();
			let dropDown = modelView.modelBuilder.dropDown().component();

			let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
			modelView.initializeModel(flex);

			const itemConfigs: InternalItemConfig[] = (flex as IWithItemConfig).itemConfigs;
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.throws(() => flex.insertItem(dropDown, -1), `Didn't get expected exception when calling insertItem with invalid index -1`);
		});

		test('Inserting component give wrong number fails', () => {
			mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => { });
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

			// Set up the form with a top level component and a group
			let listBox = modelView.modelBuilder.listBox().component();
			let inputBox = modelView.modelBuilder.inputBox().component();
			let dropDown = modelView.modelBuilder.dropDown().component();

			let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
			modelView.initializeModel(flex);

			const itemConfigs: InternalItemConfig[] = (flex as IWithItemConfig).itemConfigs;
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.throws(() => flex.insertItem(dropDown, 10), `Didn't get expected exception when calling insertItem with invalid index 10`);
		});

		test('Inserting component give end of the list succeeds', () => {
			mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => { });
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

			// Set up the form with a top level component and a group
			let listBox = modelView.modelBuilder.listBox().component();
			let inputBox = modelView.modelBuilder.inputBox().component();
			let dropDown = modelView.modelBuilder.dropDown().component();

			let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
			modelView.initializeModel(flex);

			const itemConfigs: InternalItemConfig[] = (flex as IWithItemConfig).itemConfigs;
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			flex.insertItem(dropDown, 2);
			assert.equal(itemConfigs.length, 3, `Unexpected number of items in list. Expected 3, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
		});

		test('Removing a component that does not exist does not fail', () => {
			// Set up the mock proxy to save the component that gets initialized so that it can be verified
			mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny()));
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

			// Set up the form with a top level component and a group
			let listBox = modelView.modelBuilder.listBox().component();
			let inputBox = modelView.modelBuilder.inputBox().component();
			let dropDown = modelView.modelBuilder.dropDown().component();

			let flex = modelView.modelBuilder.flexContainer().withItems([listBox, inputBox]).component();
			modelView.initializeModel(flex);

			const itemConfigs: InternalItemConfig[] = (flex as IWithItemConfig).itemConfigs;
			let result = flex.removeItem(dropDown);
			assert.equal(result, false);
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.equal(itemConfigs[0].toIItemConfig().componentShape.type, ModelComponentTypes.ListBox, `Unexpected ModelComponentType. Expected ListBox but got ${ModelComponentTypes[itemConfigs[0].toIItemConfig().componentShape.type]}`);
		});


		test('Inserting and removing component in a form should work correctly', () => {
			mockProxy.setup(x => x.$initializeModel(It.isAny(), It.isAny())).callback((handle, componentShape) => { });
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

			// Set up the form with a top level component and a group
			let listBox = modelView.modelBuilder.listBox().component();
			let inputBox = modelView.modelBuilder.inputBox().component();
			let dropDown = modelView.modelBuilder.dropDown().component();
			let checkBox = modelView.modelBuilder.checkBox().component();

			let groupItems: azdata.FormComponentGroup = {
				title: 'Group',
				components: [{
					title: 'Drop Down',
					component: dropDown
				}, {
					title: 'Check Box',
					component: checkBox
				}]
			};
			let listBoxFormItem: azdata.FormComponent = {
				title: 'List Box',
				component: listBox
			};
			let inputBoxFormItem: azdata.FormComponent = {
				title: 'Input Box',
				component: inputBox
			};

			let formBuilder = modelView.modelBuilder.formContainer();
			formBuilder.addFormItem(listBoxFormItem);
			let form = formBuilder.component();
			modelView.initializeModel(formBuilder.component());

			const itemConfigs: InternalItemConfig[] = (form as IWithItemConfig).itemConfigs;
			assert.equal(itemConfigs.length, 1);
			formBuilder.insertFormItem(inputBoxFormItem, 0);
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.equal(itemConfigs[0].toIItemConfig().componentShape.type, ModelComponentTypes.InputBox, `Unexpected ModelComponentType. Expected InputBox but got ${ModelComponentTypes[itemConfigs[0].toIItemConfig().componentShape.type]}`);
			formBuilder.insertFormItem(groupItems, 0);
			assert.equal(itemConfigs.length, 5, `Unexpected number of items in list. Expected 5, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			formBuilder.removeFormItem(listBoxFormItem);
			assert.equal(itemConfigs.length, 4, `Unexpected number of items in list. Expected 4, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			formBuilder.removeFormItem(groupItems);
			assert.equal(itemConfigs.length, 1, `Unexpected number of items in list. Expected 1, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			formBuilder.addFormItem(listBoxFormItem);
			assert.equal(itemConfigs.length, 2, `Unexpected number of items in list. Expected 2, got ${itemConfigs.length} ${JSON.stringify(itemConfigs)}`);
			assert.equal(itemConfigs[1].toIItemConfig().componentShape.type, ModelComponentTypes.ListBox, `Unexpected ModelComponentType. Expected ListBox but got ${ModelComponentTypes[itemConfigs[1].toIItemConfig().componentShape.type]}`);
		});
	});

	suite('Declarative table', () => {
		setup(done => {
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), undefined)).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$addToContainer(It.isAny(), It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());
			mockProxy.setup(x => x.$removeFromContainer(It.isAny(), It.isAny(), It.isAny())).returns(() => Promise.resolve());

			extHostModelView = new ExtHostModelView(mainContext, undefined, undefined);
			extHostModelView.$registerProvider(widgetId, async view => {
				modelView = view;
				done();
			}, undefined);

			extHostModelView.$registerWidget(handle, widgetId, undefined, undefined);
		});

		test('initialized with no data has correct properties', async () => {
			const declarativeTable = createDeclarativeTable(modelView, DeclarativeDataType.string, undefined);

			await modelView.initializeModel(declarativeTable);

			mockProxy.verify(x => x.$initializeModel(It.isAny(), It.is(rootComponent => {
				return rootComponent.id === declarativeTable.id &&
					rootComponent.properties &&
					rootComponent.properties.data &&
					rootComponent.properties.data.length === 0;
			})), Times.once());
		});

		test('initialized with string data has correct properties', async () => {
			const testData = 'myData';
			const declarativeTable = createDeclarativeTable(modelView, DeclarativeDataType.component, [testData]);

			await modelView.initializeModel(declarativeTable);

			mockProxy.verify(x => x.$initializeModel(It.isAny(), It.is(rootComponent => {
				return rootComponent.id === declarativeTable.id &&
					rootComponent.properties &&
					rootComponent.properties.data &&
					rootComponent.properties.data[0][0] === testData;
			})), Times.once());
		});

		test('initialized with component data converts to id', async () => {
			const button = modelView.modelBuilder.button().component();
			const declarativeTable = createDeclarativeTable(modelView, DeclarativeDataType.component, [button]);

			await modelView.initializeModel(declarativeTable);

			// Components are expected to be converted into their ID before being sent across the proxy
			mockProxy.verify(x => x.$initializeModel(It.isAny(), It.is(rootComponent => {
				return rootComponent.id === declarativeTable.id &&
					rootComponent.properties &&
					rootComponent.properties.data &&
					rootComponent.properties.data[0][0] === button.id;
			})), Times.once());
		});

		test('when added to container with component data converts to id', async () => {
			const button = modelView.modelBuilder.button().component();

			const declarativeTable = createDeclarativeTable(modelView, DeclarativeDataType.component, [button]);

			const container = modelView.modelBuilder.divContainer().component();
			container.addItem(declarativeTable);

			await modelView.initializeModel(declarativeTable);

			// Components are expected to be converted into their ID before being sent across the proxy
			mockProxy.verify(x => x.$initializeModel(It.isAny(), It.is(rootComponent => {
				return rootComponent.id === declarativeTable.id &&
					rootComponent.properties &&
					rootComponent.properties.data &&
					rootComponent.properties.data[0][0] === button.id;
			})), Times.once());
			mockProxy.verify(x => x.$addToContainer(It.isAny(), It.isAny(), It.is(item => {
				return item.componentShape.id === declarativeTable.id &&
					item.componentShape.properties &&
					item.componentShape.properties.data &&
					item.componentShape.properties.data[0][0] === button.id;
			}), undefined), Times.once());
		});
	});
});

/**
 * Helper function that creates a simple declarative table. Supports just a single column
 * of data.
 * @param modelView The ModelView used to create the component
 * @param data The rows of data
 */
function createDeclarativeTable(modelView: azdata.ModelView, dataType: DeclarativeDataType, data?: any[]): azdata.DeclarativeTableComponent {
	return modelView.modelBuilder.declarativeTable()
		.withProperties(
			{
				columns: [
					{
						displayName: 'TestColumn',
						valueType: dataType,
						isReadOnly: true,
						width: 25
					}
				],
				data: data ? [data] : []
			}
		).component();
}
