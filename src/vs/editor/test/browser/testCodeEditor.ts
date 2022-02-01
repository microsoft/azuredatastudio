/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditor, IActiveCodeEditor, IEditorConstructionOptions } from 'vs/editor/browser/editorBrowser';
import { IEditorContributionCtor } from 'vs/editor/browser/editorExtensions';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { View } from 'vs/editor/browser/view/viewImpl';
import { CodeEditorWidget, ICodeEditorWidgetOptions } from 'vs/editor/browser/widget/codeEditorWidget';
import * as editorOptions from 'vs/editor/common/config/editorOptions';
import { IConfiguration, IEditorContribution } from 'vs/editor/common/editorCommon';
import { ITextModel } from 'vs/editor/common/model';
import { TextModel } from 'vs/editor/common/model/textModel';
import { ViewModel } from 'vs/editor/common/viewModel/viewModelImpl';
import { TestCodeEditorService, TestCommandService } from 'vs/editor/test/browser/editorTestServices';
import { createTextModel } from 'vs/editor/test/common/editorTestUtils';
import { TestConfiguration } from 'vs/editor/test/common/mocks/testConfiguration';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextKeyService, IContextKeyServiceTarget } from 'vs/platform/contextkey/common/contextkey';
import { BrandedService, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';

export interface ITestCodeEditor extends IActiveCodeEditor {
	getViewModel(): ViewModel | undefined;
	registerAndInstantiateContribution<T extends IEditorContribution, Services extends BrandedService[]>(id: string, ctor: new (editor: ICodeEditor, ...services: Services) => T): T;
}

export class TestCodeEditor extends CodeEditorWidget implements ICodeEditor {

	//#region testing overrides
	protected override _createConfiguration(options: Readonly<IEditorConstructionOptions>): IConfiguration {
		return new TestConfiguration(options);
	}
	protected override _createView(viewModel: ViewModel): [View, boolean] {
		// Never create a view
		return [null! as View, false];
	}
	private _hasTextFocus = false;
	public setHasTextFocus(hasTextFocus: boolean): void {
		this._hasTextFocus = hasTextFocus;
	}
	public override hasTextFocus(): boolean {
		return this._hasTextFocus;
	}
	//#endregion

	//#region Testing utils
	public getViewModel(): ViewModel | undefined {
		return this._modelData ? this._modelData.viewModel : undefined;
	}
	public registerAndInstantiateContribution<T extends IEditorContribution, Services extends BrandedService[]>(id: string, ctor: new (editor: ICodeEditor, ...services: Services) => T): T {
		const r: T = this._instantiationService.createInstance(ctor as IEditorContributionCtor, this);
		this._contributions[id] = r;
		return r;
	}
}

class TestCodeEditorWithAutoModelDisposal extends TestCodeEditor {
	public override dispose() {
		super.dispose();
		if (this._modelData) {
			this._modelData.model.dispose();
		}
	}
}

class TestEditorDomElement {
	parentElement: IContextKeyServiceTarget | null = null;
	setAttribute(attr: string, value: string): void { }
	removeAttribute(attr: string): void { }
	hasAttribute(attr: string): boolean { return false; }
	getAttribute(attr: string): string | undefined { return undefined; }
	addEventListener(event: string): void { }
	removeEventListener(event: string): void { }
}

export interface TestCodeEditorCreationOptions extends editorOptions.IEditorOptions {
	/**
	 * The initial model associated with this code editor.
	 */
	model?: ITextModel;
	serviceCollection?: ServiceCollection;
	/**
	 * If the editor has text focus.
	 * Defaults to true.
	 */
	hasTextFocus?: boolean;
}

export function withTestCodeEditor(text: string | string[] | null, options: TestCodeEditorCreationOptions, callback: (editor: ITestCodeEditor, viewModel: ViewModel) => void): void {
	// create a model if necessary and remember it in order to dispose it.
	if (!options.model) {
		if (typeof text === 'string') {
			options.model = createTextModel(text);
		} else if (text) {
			options.model = createTextModel(text.join('\n'));
		}
	}

	const editor = createTestCodeEditor(options);
	const viewModel = editor.getViewModel()!;
	viewModel.setHasFocus(true);
	callback(<ITestCodeEditor>editor, editor.getViewModel()!);

	editor.dispose();
}

export async function withAsyncTestCodeEditor(text: string | string[] | null, options: TestCodeEditorCreationOptions, callback: (editor: ITestCodeEditor, viewModel: ViewModel, instantiationService: IInstantiationService) => Promise<void>): Promise<void> {
	// create a model if necessary and remember it in order to dispose it.
	let model: TextModel | undefined;
	if (!options.model) {
		if (typeof text === 'string') {
			model = options.model = createTextModel(text);
		} else if (text) {
			model = options.model = createTextModel(text.join('\n'));
		}
	}

	const [instantiationService, editor, disposable] = doCreateTestCodeEditor(options);
	const viewModel = editor.getViewModel()!;
	viewModel.setHasFocus(true);
	await callback(<ITestCodeEditor>editor, editor.getViewModel()!, instantiationService);

	editor.dispose();
	model?.dispose();
	disposable.dispose();
}

export function createTestCodeEditor(options: TestCodeEditorCreationOptions): ITestCodeEditor {
	const [, editor] = doCreateTestCodeEditor(options);
	return editor;
}

function doCreateTestCodeEditor(options: TestCodeEditorCreationOptions): [IInstantiationService, ITestCodeEditor, IDisposable] {
	const store = new DisposableStore();

	const model = options.model;
	delete options.model;

	const services: ServiceCollection = options.serviceCollection || new ServiceCollection();
	delete options.serviceCollection;

	const instantiationService: IInstantiationService = new InstantiationService(services);

	if (!services.has(ICodeEditorService)) {
		services.set(ICodeEditorService, store.add(new TestCodeEditorService()));
	}
	if (!services.has(IContextKeyService)) {
		services.set(IContextKeyService, store.add(new MockContextKeyService()));
	}
	if (!services.has(INotificationService)) {
		services.set(INotificationService, new TestNotificationService());
	}
	if (!services.has(ICommandService)) {
		services.set(ICommandService, new TestCommandService(instantiationService));
	}
	if (!services.has(IThemeService)) {
		services.set(IThemeService, new TestThemeService());
	}
	if (!services.has(ITelemetryService)) {
		services.set(ITelemetryService, NullTelemetryService);
	}

	const codeEditorWidgetOptions: ICodeEditorWidgetOptions = {
		contributions: []
	};
	const editor = instantiationService.createInstance(
		TestCodeEditorWithAutoModelDisposal,
		<HTMLElement><any>new TestEditorDomElement(),
		options,
		codeEditorWidgetOptions
	);
	if (typeof options.hasTextFocus === 'undefined') {
		options.hasTextFocus = true;
	}
	editor.setHasTextFocus(options.hasTextFocus);
	editor.setModel(model);
	return [instantiationService, <ITestCodeEditor>editor, store];
}
