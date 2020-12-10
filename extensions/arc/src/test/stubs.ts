/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';

interface ModelViewMocks {
	mockModelView: TypeMoq.IMock<azdata.ModelView>,
	mockModelBuilder: TypeMoq.IMock<azdata.ModelBuilder>,
	mockTextBuilder: TypeMoq.IMock<azdata.ComponentBuilder<azdata.TextComponent, azdata.TextComponentProperties>>,
	mockInputBoxBuilder: TypeMoq.IMock<azdata.ComponentBuilder<azdata.InputBoxComponent, azdata.InputBoxProperties>>,
	mockButtonBuilder: TypeMoq.IMock<azdata.ComponentBuilder<azdata.ButtonComponent, azdata.ButtonProperties>>,
	mockRadioButtonBuilder: TypeMoq.IMock<azdata.ComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties>>,
	mockDivBuilder: TypeMoq.IMock<azdata.DivBuilder>,
	mockFlexBuilder: TypeMoq.IMock<azdata.FlexBuilder>,
	mockLoadingBuilder: TypeMoq.IMock<azdata.LoadingComponentBuilder>
}

export function createModelViewMock(buttonClickEmitter?: vscode.EventEmitter<any>): ModelViewMocks {
	const mockModelBuilder = TypeMoq.Mock.ofType<azdata.ModelBuilder>();
	const mockTextBuilder = setupMockComponentBuilder<azdata.TextComponent, azdata.TextComponentProperties>();
	const mockInputBoxBuilder = setupMockComponentBuilder<azdata.InputBoxComponent, azdata.InputBoxProperties>();
	buttonClickEmitter = buttonClickEmitter ?? new vscode.EventEmitter<any>();
	const mockButtonBuilder = setupMockButtonBuilderWithClickEmitter(buttonClickEmitter);
	const mockRadioButtonBuilder = setupMockComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties>();
	const mockDivBuilder = setupMockContainerBuilder<azdata.DivContainer, azdata.DivContainerProperties, azdata.DivBuilder>();
	const mockFlexBuilder = setupMockContainerBuilder<azdata.FlexContainer, azdata.ComponentProperties, azdata.FlexBuilder>();
	const mockLoadingBuilder = setupMockLoadingBuilder();
	mockModelBuilder.setup(b => b.loadingComponent()).returns(() => mockLoadingBuilder.object);
	mockModelBuilder.setup(b => b.text()).returns(() => mockTextBuilder.object);
	mockModelBuilder.setup(b => b.inputBox()).returns(() => mockInputBoxBuilder.object);
	mockModelBuilder.setup(b => b.button()).returns(() => mockButtonBuilder.object);
	mockModelBuilder.setup(b => b.radioButton()).returns(() => mockRadioButtonBuilder.object);
	mockModelBuilder.setup(b => b.divContainer()).returns(() => mockDivBuilder.object);
	mockModelBuilder.setup(b => b.flexContainer()).returns(() => mockFlexBuilder.object);
	const mockModelView = TypeMoq.Mock.ofType<azdata.ModelView>();
	mockModelView.setup(mv => mv.modelBuilder).returns(() => mockModelBuilder.object);
	return { mockModelView, mockModelBuilder, mockTextBuilder, mockInputBoxBuilder, mockButtonBuilder, mockRadioButtonBuilder, mockDivBuilder, mockFlexBuilder, mockLoadingBuilder };
}

function setupMockButtonBuilderWithClickEmitter(buttonClickEmitter: vscode.EventEmitter<any>): TypeMoq.IMock<azdata.ComponentBuilder<azdata.ButtonComponent, azdata.ButtonProperties>> {
	const { mockComponentBuilder: mockButtonBuilder, mockComponent: mockButtonComponent } = setupMockComponentBuilderAndComponent<azdata.ButtonComponent, azdata.ButtonProperties>();
	mockButtonComponent.setup(b => b.onDidClick(TypeMoq.It.isAny())).returns(buttonClickEmitter.event);
	return mockButtonBuilder;
}

function setupMockLoadingBuilder(
	loadingBuilderGetter?: (item: azdata.Component) => azdata.LoadingComponentBuilder,
	mockLoadingBuilder?: TypeMoq.IMock<azdata.LoadingComponentBuilder>
): TypeMoq.IMock<azdata.LoadingComponentBuilder> {
	mockLoadingBuilder = mockLoadingBuilder ?? setupMockComponentBuilder<azdata.LoadingComponent, azdata.LoadingComponentProperties, azdata.LoadingComponentBuilder>();
	let item: azdata.Component;
	mockLoadingBuilder.setup(b => b.withItem(TypeMoq.It.isAny())).callback((_item) => item = _item).returns(() => loadingBuilderGetter ? loadingBuilderGetter(item) : mockLoadingBuilder!.object);
	return mockLoadingBuilder;
}

export function setupMockComponentBuilder<T extends azdata.Component, P extends azdata.ComponentProperties, B extends azdata.ComponentBuilder<T, P> = azdata.ComponentBuilder<T, P>>(
	componentGetter?: (props: P) => T,
	mockComponentBuilder?: TypeMoq.IMock<B>,
): TypeMoq.IMock<B> {
	mockComponentBuilder = mockComponentBuilder ?? TypeMoq.Mock.ofType<B>();
	setupMockComponentBuilderAndComponent<T, P, B>(mockComponentBuilder, componentGetter);
	return mockComponentBuilder;
}

function setupMockComponentBuilderAndComponent<T extends azdata.Component, P extends azdata.ComponentProperties, B extends azdata.ComponentBuilder<T, P> = azdata.ComponentBuilder<T, P>>(
	mockComponentBuilder?: TypeMoq.IMock<B>,
	componentGetter?: ((props: P) => T)
): { mockComponentBuilder: TypeMoq.IMock<B>, mockComponent: TypeMoq.IMock<T> } {
	mockComponentBuilder = mockComponentBuilder ?? TypeMoq.Mock.ofType<B>();
	const mockComponent = createComponentMock<T>();
	let compProps: P;
	mockComponentBuilder.setup(b => b.withProperties(TypeMoq.It.isAny())).callback((props: P) => compProps = props).returns(() => mockComponentBuilder!.object);
	mockComponentBuilder.setup(b => b.component()).returns(() => {
		return componentGetter ? componentGetter(compProps) : Object.assign<T, P>(Object.assign({}, mockComponent.object), compProps);
	});

	// For now just have these be passthrough - can hook up additional functionality later if needed
	mockComponentBuilder.setup(b => b.withValidation(TypeMoq.It.isAny())).returns(() => mockComponentBuilder!.object);
	return { mockComponentBuilder, mockComponent };
}

function createComponentMock<T extends azdata.Component>(): TypeMoq.IMock<T> {
	const mockComponent = TypeMoq.Mock.ofType<T>();
	// Need to setup 'then' for when a mocked object is resolved otherwise the test will hang : https://github.com/florinn/typemoq/issues/66
	mockComponent.setup((x: any) => x.then).returns(() => { });
	return mockComponent;
}

export function setupMockContainerBuilder<T extends azdata.Container<any, any>, P extends azdata.ComponentProperties, B extends azdata.ContainerBuilder<T, any, any, any> = azdata.ContainerBuilder<T, any, any, any>>(
	mockContainerBuilder?: TypeMoq.IMock<B>
): TypeMoq.IMock<B> {
	const items: azdata.Component[] = [];
	const mockContainer = createComponentMock<T>(); // T is azdata.Container type so this creates a azdata.Container mock
	mockContainer.setup(c => c.items).returns(() => items);
	mockContainerBuilder = mockContainerBuilder ?? setupMockComponentBuilder<T, P, B>((_props) => mockContainer.object);
	mockContainerBuilder.setup(b => b.withItems(TypeMoq.It.isAny(), TypeMoq.It.isAny())).callback((_items, _itemsStyle) => items.push(..._items)).returns(() => mockContainerBuilder!.object);
	// For now just have these be passthrough - can hook up additional functionality later if needed
	mockContainerBuilder.setup(b => b.withLayout(TypeMoq.It.isAny())).returns(() => mockContainerBuilder!.object);
	return mockContainerBuilder;
}

export class MockInputBox implements vscode.InputBox {
	private _value: string = '';
	public get value(): string {
		return this._value;
	}
	public set value(newValue: string) {
		this._value = newValue;
		if (this._onDidChangeValueCallback) {
			this._onDidChangeValueCallback(this._value);
		}
	}
	placeholder: string | undefined;
	password: boolean = false;
	private _onDidChangeValueCallback: ((e: string) => any) | undefined = undefined;
	onDidChangeValue: vscode.Event<string> = (listener) => {
		this._onDidChangeValueCallback = listener;
		return new vscode.Disposable(() => { });
	};
	private _onDidAcceptCallback: ((e: void) => any) | undefined = undefined;
	public onDidAccept: vscode.Event<void> = (listener) => {
		this._onDidAcceptCallback = listener;
		return new vscode.Disposable(() => { });
	};
	buttons: readonly vscode.QuickInputButton[] = [];
	onDidTriggerButton: vscode.Event<vscode.QuickInputButton> = (_) => { return new vscode.Disposable(() => { }); };
	prompt: string | undefined;
	validationMessage: string | undefined;
	title: string | undefined;
	step: number | undefined;
	totalSteps: number | undefined;
	enabled: boolean = false;
	busy: boolean = false;
	ignoreFocusOut: boolean = false;
	show(): void { }

	hide(): void {
		if (this._onDidHideCallback) {
			this._onDidHideCallback();
		}
	}
	private _onDidHideCallback: ((e: void) => any) | undefined = undefined;
	onDidHide: vscode.Event<void> = (listener) => {
		this._onDidHideCallback = listener;
		return new vscode.Disposable(() => { });
	};
	dispose(): void { }

	public async triggerAccept(): Promise<any> {
		if (this._onDidAcceptCallback) {
			return await this._onDidAcceptCallback();
		}
		return undefined;
	}
}
