/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';

export function createModelViewMock() {
	const mockModelBuilder = TypeMoq.Mock.ofType<azdata.ModelBuilder>();
	const mockTextBuilder = setupMockComponentBuilder<azdata.TextComponent, azdata.TextComponentProperties>();
	const mockInputBoxBuilder = setupMockComponentBuilder<azdata.InputBoxComponent, azdata.InputBoxProperties>();
	const mockRadioButtonBuilder = setupMockComponentBuilder<azdata.RadioButtonComponent, azdata.RadioButtonProperties>();
	const mockDivBuilder = setupMockContainerBuilder<azdata.DivContainer, azdata.DivContainerProperties, azdata.DivBuilder>();
	const mockLoadingBuilder = setupMockLoadingBuilder();
	mockModelBuilder.setup(b => b.loadingComponent()).returns(() => mockLoadingBuilder.object);
	mockModelBuilder.setup(b => b.text()).returns(() => mockTextBuilder.object);
	mockModelBuilder.setup(b => b.inputBox()).returns(() => mockInputBoxBuilder.object);
	mockModelBuilder.setup(b => b.radioButton()).returns(() => mockRadioButtonBuilder.object);
	mockModelBuilder.setup(b => b.divContainer()).returns(() => mockDivBuilder.object);
	const mockModelView = TypeMoq.Mock.ofType<azdata.ModelView>();
	mockModelView.setup(mv => mv.modelBuilder).returns(() => mockModelBuilder.object);
	return { mockModelView, mockModelBuilder, mockTextBuilder, mockInputBoxBuilder, mockRadioButtonBuilder, mockDivBuilder };
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
	const returnComponent = TypeMoq.Mock.ofType<T>();
	// Need to setup 'then' for when a mocked object is resolved otherwise the test will hang : https://github.com/florinn/typemoq/issues/66
	returnComponent.setup((x: any) => x.then).returns(() => { });
	let compProps: P;
	mockComponentBuilder.setup(b => b.withProperties(TypeMoq.It.isAny())).callback((props: P) => compProps = props).returns(() => mockComponentBuilder!.object);
	mockComponentBuilder.setup(b => b.component()).returns(() => {
		return componentGetter ? componentGetter(compProps) : Object.assign<T, P>(Object.assign({}, returnComponent.object), compProps);
	});

	// For now just have these be passthrough - can hook up additional functionality later if needed
	mockComponentBuilder.setup(b => b.withValidation(TypeMoq.It.isAny())).returns(() => mockComponentBuilder!.object);
	return mockComponentBuilder;
}

export function setupMockContainerBuilder<T extends azdata.Container<any, any>, P extends azdata.ComponentProperties, B extends azdata.ContainerBuilder<T, any, any, any> = azdata.ContainerBuilder<T, any, any, any>>(
	mockContainerBuilder?: TypeMoq.IMock<B>
): TypeMoq.IMock<B> {
	mockContainerBuilder = mockContainerBuilder ?? setupMockComponentBuilder<T, P, B>();
	// For now just have these be passthrough - can hook up additional functionality later if needed
	mockContainerBuilder.setup(b => b.withItems(TypeMoq.It.isAny(), undefined)).returns(() => mockContainerBuilder!.object);
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
