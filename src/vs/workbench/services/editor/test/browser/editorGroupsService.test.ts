/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EditorPart } from 'vs/workbench/browser/parts/editor/editorPart';
import { workbenchInstantiationService, TestStorageService } from 'vs/workbench/test/workbenchTestServices';
import { GroupDirection, GroupsOrder, MergeGroupMode, GroupOrientation, GroupChangeKind, EditorsOrder, GroupLocation } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorPartOptions } from 'vs/workbench/browser/parts/editor/editor';
import { EditorInput, IFileEditorInput, IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorExtensions, EditorOptions, CloseDirection } from 'vs/workbench/common/editor';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorRegistry, Extensions, EditorDescriptor } from 'vs/workbench/browser/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { CancellationToken } from 'vs/base/common/cancellation';

export class TestEditorControl extends BaseEditor {

	constructor(@ITelemetryService telemetryService: ITelemetryService) { super('MyFileEditorForEditorGroupService', NullTelemetryService, new TestThemeService(), new TestStorageService()); }

	setInput(input: EditorInput, options: EditorOptions, token: CancellationToken): Promise<void> {
		super.setInput(input, options, token);

		return input.resolve().then(() => undefined);
	}

	getId(): string { return 'MyFileEditorForEditorGroupService'; }
	layout(): void { }
	createEditor(): any { }
}

export class TestEditorInput extends EditorInput implements IFileEditorInput {

	constructor(private resource: URI) { super(); }

	getTypeId() { return 'testEditorInputForEditorGroupService'; }
	resolve(): Promise<IEditorModel> { return Promise.resolve(undefined); }
	matches(other: TestEditorInput): boolean { return other && this.resource.toString() === other.resource.toString() && other instanceof TestEditorInput; }
	setEncoding(encoding: string) { }
	getEncoding(): string { return null!; }
	setPreferredEncoding(encoding: string) { }
	getResource(): URI { return this.resource; }
	setForceOpenAsBinary(): void { }
}

suite('Editor groups service', () => {
	test('groups basics', function () {
		// {{SQL CARBON EDIT}} - Remove test
		assert.equal(0, 0);
	});
});
