/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { ManagePackagesDialog } from '../../dialog/managePackages/managePackagesDialog';
import { ManagePackagesDialogModel } from '../../dialog/managePackages/managePackagesDialogModel';
import { IPackageManageProvider, IPackageLocation } from '../../types';
import { LocalCondaPackageManageProvider } from '../../jupyter/localCondaPackageManageProvider';
import { InstalledPackagesTab } from '../../dialog/managePackages/installedPackagesTab';

interface TestContext {
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
	dialog: TypeMoq.IMock<ManagePackagesDialog>;
	model: TypeMoq.IMock<ManagePackagesDialogModel>;
}

describe('Manage Package Dialog', () => {

	it('getLocationComponent should create text component for one location', async function (): Promise<void> {
		let testContext = createViewContext();
		let locations = [
			{
				displayName: 'dl1',
				name: 'nl1'
			}
		];
		testContext.model.setup(x => x.getLocations()).returns(() => Promise.resolve(locations));
		testContext.model.setup(x => x.changeLocation('nl1'));
		testContext.dialog.setup(x => x.changeLocation('nl1'));

		let actual = await InstalledPackagesTab.getLocationComponent(testContext.view, testContext.dialog.object);
		should.equal('onTextChanged' in actual, true);
		testContext.dialog.verify(x => x.changeLocation('nl1'), TypeMoq.Times.once());
	});

	it('getLocationComponent should create text component for undefined location', async function (): Promise<void> {
		let testContext = createViewContext();
		let locations: IPackageLocation[] | undefined  = undefined;
		testContext.model.setup(x => x.getLocations()).returns(() => Promise.resolve(locations));

		let actual = await InstalledPackagesTab.getLocationComponent(testContext.view, testContext.dialog.object);
		should.equal('onTextChanged' in actual, true);
	});

	it('getLocationComponent should create drop down component for more than one location', async function (): Promise<void> {
		let testContext = createViewContext();
		let locations = [
			{
				displayName: 'dl1',
				name: 'nl1'
			},
			{
				displayName: 'dl2',
				name: 'nl2'
			}
		];
		testContext.model.setup(x => x.getLocations()).returns(() => Promise.resolve(locations));
		testContext.dialog.setup(x => x.changeLocation('nl1'));
		testContext.dialog.setup(x => x.resetPages()).returns(() => Promise.resolve());

		let actual = await InstalledPackagesTab.getLocationComponent(testContext.view, testContext.dialog.object);
		should.equal('onValueChanged' in actual, true);
		testContext.dialog.verify(x => x.changeLocation('nl1'), TypeMoq.Times.once());
		(<azdata.DropDownComponent>actual).value = {
			displayName: 'dl2',
			name: 'nl2'
		};
		testContext.onClick.fire(undefined);
		testContext.dialog.verify(x => x.changeLocation('nl2'), TypeMoq.Times.once());
		testContext.dialog.verify(x => x.resetPages(), TypeMoq.Times.once());

	});

	it('getLocationComponent should show error if reset pages fails', async function (): Promise<void> {
		let testContext = createViewContext();
		let locations = [
			{
				displayName: 'dl1',
				name: 'nl1'
			},
			{
				displayName: 'dl2',
				name: 'nl2'
			}
		];
		testContext.model.setup(x => x.getLocations()).returns(() => Promise.resolve(locations));
		testContext.dialog.setup(x => x.changeLocation('nl1'));
		testContext.dialog.setup(x => x.resetPages()).throws(new Error('failed'));
		testContext.dialog.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve());

		let actual = await InstalledPackagesTab.getLocationComponent(testContext.view, testContext.dialog.object);
		should.equal('onValueChanged' in actual, true);
		testContext.dialog.verify(x => x.changeLocation('nl1'), TypeMoq.Times.once());
		(<azdata.DropDownComponent>actual).value = {
			displayName: 'dl2',
			name: 'nl2'
		};
		testContext.onClick.fire(undefined);
		testContext.dialog.verify(x => x.changeLocation('nl2'), TypeMoq.Times.once());
		testContext.dialog.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

	});

	function createViewContext(): TestContext {
		let packageManageProviders = new Map<string, IPackageManageProvider>();
		packageManageProviders.set(LocalCondaPackageManageProvider.ProviderId, new LocalCondaPackageManageProvider(undefined));
		let model = TypeMoq.Mock.ofInstance(new ManagePackagesDialogModel(undefined, packageManageProviders));
		const mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.asAbsolutePath(TypeMoq.It.isAny())).returns(() => '');

		let dialog = TypeMoq.Mock.ofInstance(new ManagePackagesDialog(model.object, mockExtensionContext.object));
		dialog.setup(x => x.model).returns(() => model.object);

		let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

		let componentBase: azdata.Component = {
			id: '',
			updateProperties: () => Promise.resolve(),
			updateProperty: () => Promise.resolve(),
			updateCssStyles: undefined!,
			onValidityChanged: undefined!,
			valid: true,
			validate: undefined!,
			focus: undefined!
		};
		let button: azdata.ButtonComponent = Object.assign({}, componentBase, {
			onDidClick: onClick.event
		});
		let radioButton: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
			onDidClick: onClick.event
		});
		const components: azdata.Component[] = [];
		let container = {
			clearItems: () => { },
			addItems: () => { },
			addItem: () => { },
			removeItem: () => true,
			insertItem: () => { },
			items: components,
			setLayout: () => { },
			setItemLayout: () => { }
		};
		let form: azdata.FormContainer = Object.assign({}, componentBase, container, {
		});
		let flex: azdata.FlexContainer = Object.assign({}, componentBase, container, {
		});

		let buttonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent> = {
			component: () => button,
			withProperties: () => buttonBuilder,
			withValidation: () => buttonBuilder
		};
		let radioButtonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent> = {
			component: () => radioButton,
			withProperties: () => radioButtonBuilder,
			withValidation: () => radioButtonBuilder
		};
		let inputBox: () => azdata.InputBoxComponent = () => Object.assign({}, componentBase, {
			onTextChanged: undefined!,
			onEnterKeyPressed: undefined!,
			value: ''
		});
		let image: () => azdata.ImageComponent = () => Object.assign({}, componentBase, {

		});
		let dropdown: () => azdata.DropDownComponent = () => Object.assign({}, componentBase, {
			onValueChanged: onClick.event,
			value: {
				name: '',
				displayName: ''
			},
			values: []
		});
		let declarativeTable: () => azdata.DeclarativeTableComponent = () => Object.assign({}, componentBase, {
			onDataChanged: undefined!,
			data: [],
			columns: []
		});

		let loadingComponent: () => azdata.LoadingComponent = () => Object.assign({}, componentBase, {
			loading: false,
			component: undefined!
		});

		let declarativeTableBuilder: azdata.ComponentBuilder<azdata.DeclarativeTableComponent> = {
			component: () => declarativeTable(),
			withProperties: () => declarativeTableBuilder,
			withValidation: () => declarativeTableBuilder
		};

		let loadingBuilder: azdata.LoadingComponentBuilder = {
			component: () => loadingComponent(),
			withProperties: () => loadingBuilder,
			withValidation: () => loadingBuilder,
			withItem: () => loadingBuilder
		};

		let formBuilder: azdata.FormBuilder = Object.assign({}, {
			component: () => form,
			addFormItem: () => { },
			insertFormItem: () => { },
			removeFormItem: () => true,
			addFormItems: () => { },
			withFormItems: () => formBuilder,
			withProperties: () => formBuilder,
			withValidation: () => formBuilder,
			withItems: () => formBuilder,
			withLayout: () => formBuilder
		});

		let flexBuilder: azdata.FlexBuilder = Object.assign({}, {
			component: () => flex,
			withProperties: () => flexBuilder,
			withValidation: () => flexBuilder,
			withItems: () => flexBuilder,
			withLayout: () => flexBuilder
		});

		let inputBoxBuilder: azdata.ComponentBuilder<azdata.InputBoxComponent> = {
			component: () => {
				let r = inputBox();
				return r;
			},
			withProperties: () => inputBoxBuilder,
			withValidation: () => inputBoxBuilder
		};
		let imageBuilder: azdata.ComponentBuilder<azdata.ImageComponent> = {
			component: () => {
				let r = image();
				return r;
			},
			withProperties: () => imageBuilder,
			withValidation: () => imageBuilder
		};
		let dropdownBuilder: azdata.ComponentBuilder<azdata.DropDownComponent> = {
			component: () => {
				let r = dropdown();
				return r;
			},
			withProperties: () => dropdownBuilder,
			withValidation: () => dropdownBuilder
		};

		let view: azdata.ModelView = {
			onClosed: undefined!,
			connection: undefined!,
			serverInfo: undefined!,
			valid: true,
			onValidityChanged: undefined!,
			validate: undefined!,
			initializeModel: () => { return Promise.resolve(); },
			modelBuilder: {
				radioCardGroup: undefined!,
				navContainer: undefined!,
				divContainer: undefined!,
				flexContainer: () => flexBuilder,
				splitViewContainer: undefined!,
				dom: undefined!,
				card: undefined!,
				inputBox: () => inputBoxBuilder,
				checkBox: undefined!,
				radioButton: () => radioButtonBuilder,
				webView: undefined!,
				editor: undefined!,
				diffeditor: undefined!,
				text: () => inputBoxBuilder,
				image: () => imageBuilder,
				button: () => buttonBuilder,
				dropDown: () => dropdownBuilder,
				tree: undefined!,
				listBox: undefined!,
				table: undefined!,
				declarativeTable: () => declarativeTableBuilder,
				dashboardWidget: undefined!,
				dashboardWebview: undefined!,
				formContainer: () => formBuilder,
				groupContainer: undefined!,
				toolbarContainer: undefined!,
				loadingComponent: () => loadingBuilder,
				fileBrowserTree: undefined!,
				hyperlink: undefined!,
				tabbedPanel: undefined!,
				separator: undefined!,
				propertiesContainer: undefined!
			}
		};

		return {
			dialog: dialog,
			model: model,
			view: view,
			onClick: onClick,
		};
	}
});
