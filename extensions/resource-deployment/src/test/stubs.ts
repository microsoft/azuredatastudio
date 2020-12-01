/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as events from 'events';
import * as cp from 'promisify-child-process';
import * as TypeMoq from 'typemoq';
import { Readable } from 'stream';

export class TestChildProcessPromise<T> implements cp.ChildProcessPromise {
	private _promise: Promise<T>;
	private _event: events.EventEmitter = new events.EventEmitter();

	constructor() {
		this._promise = new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}
	resolve!: (value?: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;
	then<TResult1 = T, TResult2 = never>(onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
		return this._promise.then(onFulfilled, onRejected);
	}
	catch<TResult = never>(onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult> {
		return this._promise.catch(onRejected);
	}
	[Symbol.toStringTag]: string;
	finally(onFinally?: (() => void) | null): Promise<T> {
		return this._promise.finally(onFinally);
	}
	stdin: any = this._event;
	stdout: Readable | null = <Readable>this._event;
	stderr: Readable | null = <Readable>this._event;
	channel?: any;
	stdio: [any, Readable | null, Readable | null, any, any] = [this.stdin, this.stdout, this.stderr, undefined, undefined];
	killed: boolean = false;
	pid: number = -1;
	connected: boolean = false;
	kill(signal?: number | 'SIGABRT' | 'SIGALRM' | 'SIGBUS' | 'SIGCHLD' | 'SIGCONT' | 'SIGFPE' | 'SIGHUP' | 'SIGILL' | 'SIGINT' | 'SIGIO' | 'SIGIOT' | 'SIGKILL' | 'SIGPIPE' | 'SIGPOLL' | 'SIGPROF' | 'SIGPWR' | 'SIGQUIT' | 'SIGSEGV' | 'SIGSTKFLT' | 'SIGSTOP' | 'SIGSYS' | 'SIGTERM' | 'SIGTRAP' | 'SIGTSTP' | 'SIGTTIN' | 'SIGTTOU' | 'SIGUNUSED' | 'SIGURG' | 'SIGUSR1' | 'SIGUSR2' | 'SIGVTALRM' | 'SIGWINCH' | 'SIGXCPU' | 'SIGXFSZ' | 'SIGBREAK' | 'SIGLOST' | 'SIGINFO'): void {
		throw new Error('Method not implemented.');
	}

	send(message: any, callback?: (error: Error | null) => void): boolean;
	send(message: any, sendHandle?: any, callback?: (error: Error | null) => void): boolean;
	send(message: any, sendHandle?: any, options?: any, callback?: (error: Error | null) => void): boolean;
	send(message: any, sendHandle?: any, options?: any, callback?: any): boolean {
		throw new Error('Method not implemented.');
	}
	disconnect(): void {
		throw new Error('Method not implemented.');
	}
	unref(): void {
		throw new Error('Method not implemented.');
	}
	ref(): void {
		throw new Error('Method not implemented.');
	}
	addListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		this._event.on(event, listener);
		return this;
	}
	once(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	off(event: string | symbol, listener: (...args: any[]) => void): this {
		throw new Error('Method not implemented.');
	}
	removeAllListeners(event?: string | symbol): this {
		throw new Error('Method not implemented.');
	}
	setMaxListeners(n: number): this {
		throw new Error('Method not implemented.');
	}
	getMaxListeners(): number {
		throw new Error('Method not implemented.');
	}
	listeners(event: string | symbol): Function[] {
		throw new Error('Method not implemented.');
	}
	rawListeners(event: string | symbol): Function[] {
		throw new Error('Method not implemented.');
	}
	emit(event: string | symbol, ...args: any[]): boolean {
		return this._event.emit(event, args);
	}
	eventNames(): (string | symbol)[] {
		throw new Error('Method not implemented.');
	}
	listenerCount(type: string | symbol): number {
		throw new Error('Method not implemented.');
	}
}

export type MockComponentAndComponentBuilder<C, B> = {
	component: C,
	builder: TypeMoq.IMock<B>
};

export function createModelViewMock(): {
	modelBuilder: TypeMoq.IMock<azdata.ModelBuilder>,
	modelView: TypeMoq.IMock<azdata.ModelView>
} {
	const mockModelView = TypeMoq.Mock.ofType<azdata.ModelView>();
	const mockModelBuilder = TypeMoq.Mock.ofType<azdata.ModelBuilder>();
	const mockTextBuilder = createMockComponentBuilder<azdata.TextComponent>();
	const mockGroupContainerBuilder = createMockContainerBuilder<azdata.GroupContainer>();
	const mockFormContainerBuilder = createMockFormContainerBuilder();
	mockModelBuilder.setup(b => b.text()).returns(() => mockTextBuilder.builder.object);
	mockModelBuilder.setup(b => b.groupContainer()).returns(() => mockGroupContainerBuilder.builder.object);
	mockModelBuilder.setup(b => b.formContainer()).returns(() => mockFormContainerBuilder.object);
	mockModelView.setup(mv => mv.modelBuilder).returns(() => mockModelBuilder.object);
	return {
		modelBuilder: mockModelBuilder,
		modelView: mockModelView
	};
}

export function createMockComponentBuilder<C extends azdata.Component, B extends azdata.ComponentBuilder<C, any> = azdata.ComponentBuilder<C, any>>(component?: C): MockComponentAndComponentBuilder<C, B> {
	const mockComponentBuilder = TypeMoq.Mock.ofType<B>();
	// Create a mocked dynamic component if we don't have a stub instance to use.
	// Note that we don't use ofInstance here for the component because there's some limitations around properties that I was
	// hitting preventing me from easily using TypeMoq. Passing in the stub instance lets users control the object being stubbed - which means
	// they can use things like sinon to then override specific functions if desired.
	if (!component) {
		const mockComponent = TypeMoq.Mock.ofType<C>();
		// Need to setup then for when a dynamic mocked object is resolved otherwise the test will hang : https://github.com/florinn/typemoq/issues/66
		mockComponent.setup((x: any) => x.then).returns(() => undefined);
		component = mockComponent.object;
	}
	// For now just have these be passthrough - can hook up additional functionality later if needed
	mockComponentBuilder.setup(b => b.withProperties(TypeMoq.It.isAny())).returns(() => mockComponentBuilder.object);
	mockComponentBuilder.setup(b => b.withValidation(TypeMoq.It.isAny())).returns(() => mockComponentBuilder.object);
	mockComponentBuilder.setup(b => b.component()).returns(() => component! /*mockComponent.object*/);
	return {
		component: component!,
		builder: mockComponentBuilder
	};
}

export function createMockContainerBuilder<C extends azdata.Container<any, any>, B extends azdata.ContainerBuilder<C, any, any, any> = azdata.ContainerBuilder<C, any, any, any>>(): MockComponentAndComponentBuilder<C, B> {
	const mockContainerBuilder = createMockComponentBuilder<C, B>();
	// For now just have these be passthrough - can hook up additional functionality later if needed
	mockContainerBuilder.builder.setup(b => b.withItems(TypeMoq.It.isAny(), undefined)).returns(() => mockContainerBuilder.builder.object);
	mockContainerBuilder.builder.setup(b => b.withLayout(TypeMoq.It.isAny())).returns(() => mockContainerBuilder.builder.object);
	return mockContainerBuilder;
}

export function createMockFormContainerBuilder(): TypeMoq.IMock<azdata.FormBuilder> {
	const mockContainerBuilder = createMockContainerBuilder<azdata.FormContainer, azdata.FormBuilder>();
	mockContainerBuilder.builder.setup(b => b.withFormItems(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => mockContainerBuilder.builder.object);
	return mockContainerBuilder.builder;
}

export class StubInputBox implements azdata.InputBoxComponent {
	readonly id = 'input-box';
	public enabled: boolean = false;

	onTextChanged: vscode.Event<any> = undefined!;
	onEnterKeyPressed: vscode.Event<string> = undefined!;

	updateProperties(properties: { [key: string]: any }): Thenable<void> { throw new Error('Not implemented'); }

	updateProperty(key: string, value: any): Thenable<void> { throw new Error('Not implemented'); }

	updateCssStyles(cssStyles: { [key: string]: string }): Thenable<void> { throw new Error('Not implemented'); }

	readonly onValidityChanged: vscode.Event<boolean> = undefined!;

	readonly valid: boolean = true;

	validate(): Thenable<boolean> { throw new Error('Not implemented'); }

	focus(): Thenable<void> { return Promise.resolve(); }
}

export class StubCheckbox implements azdata.CheckBoxComponent {
	private _onChanged = new vscode.EventEmitter<void>();
	private _checked = false;

	readonly id = 'stub-checkbox';
	public enabled: boolean = false;

	get checked(): boolean {
		return this._checked;
	}
	set checked(value: boolean) {
		this._checked = value;
		this._onChanged.fire();
	}

	onChanged: vscode.Event<any> = this._onChanged.event;

	updateProperties(properties: { [key: string]: any }): Thenable<void> { throw new Error('Not implemented'); }

	updateProperty(key: string, value: any): Thenable<void> { throw new Error('Not implemented'); }

	updateCssStyles(cssStyles: { [key: string]: string }): Thenable<void> { throw new Error('Not implemented'); }

	readonly onValidityChanged: vscode.Event<boolean> = undefined!;

	readonly valid: boolean = true;

	validate(): Thenable<boolean> { throw new Error('Not implemented'); }

	focus(): Thenable<void> { return Promise.resolve(); }
}
