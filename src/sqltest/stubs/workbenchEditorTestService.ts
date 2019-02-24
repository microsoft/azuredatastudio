/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { IEditorService, SIDE_GROUP_TYPE, ACTIVE_GROUP_TYPE, IResourceEditor, IResourceEditorReplacement, IOpenEditorOverrideHandler } from 'vs/workbench/services/editor/common/editorService';
import { ServiceIdentifier, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IEditorOptions, IResourceInput, ITextEditorOptions  } from 'vs/platform/editor/common/editor';
import { IEditor, IEditorInput, IResourceDiffInput, IResourceSideBySideInput, GroupIdentifier, ITextEditor, IUntitledResourceInput, ITextDiffEditor, ITextSideBySideEditor, IEditorInputWithOptions } from 'vs/workbench/common/editor';
import { TPromise } from 'vs/base/common/winjs.base';
import { Event } from 'vs/base/common/event';
import { Position } from 'vs/editor/common/core/position';
import { IEditorGroup, IEditorReplacement } from 'vs/workbench/services/group/common/editorGroupsService';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IDisposable } from 'vs/base/common/lifecycle';

export class WorkbenchEditorTestService implements IEditorService {
	_serviceBrand: ServiceIdentifier<any>;

	readonly onDidActiveEditorChange: Event<void>;

	readonly onDidVisibleEditorsChange: Event<void>;

	readonly activeEditor: IEditorInput;

	readonly activeControl: IEditor;

	readonly activeTextEditorWidget: ICodeEditor;

	readonly visibleEditors: ReadonlyArray<IEditorInput>;

	readonly visibleControls: ReadonlyArray<IEditor>;

	readonly visibleTextEditorWidgets: ReadonlyArray<ICodeEditor>;

	readonly editors: ReadonlyArray<IEditorInput>;


	/**
	 * Returns iff the provided input is currently visible.
	 *
	 * @param includeDiff iff set to true, will also consider diff editors to find out if the provided
	 * input is opened either on the left or right hand side of the diff editor.
	 */
	isVisible(input: IEditorInput, includeDiff: boolean): boolean {
		return undefined;
	}

	public openEditor(editor: IEditorInput, options?: IEditorOptions | ITextEditorOptions, group?: IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE): TPromise<IEditor>;
	public openEditor(editor: IResourceInput | IUntitledResourceInput, group?: IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE): TPromise<ITextEditor>;
	public openEditor(editor: IResourceDiffInput, group?: IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE): TPromise<ITextDiffEditor>;
	public openEditor(editor: IResourceSideBySideInput, group?: IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE): TPromise<ITextSideBySideEditor>;
	public openEditor(input: any, arg2?: any, arg3?: any): TPromise<IEditor>  {
		return undefined;
	}

	public openEditors(editors: IEditorInputWithOptions[], group?: IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE): TPromise<ReadonlyArray<IEditor>>;
	public openEditors(editors: IResourceEditor[], group?: IEditorGroup | GroupIdentifier | SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE): TPromise<ReadonlyArray<IEditor>>;
	public openEditors(editors: any[]): TPromise<IEditor[]> {
		return undefined;
	}

	public replaceEditors(editors: IResourceEditorReplacement[], group: IEditorGroup | GroupIdentifier): TPromise<void>;
	public replaceEditors(editors: IEditorReplacement[], group: IEditorGroup | GroupIdentifier): TPromise<void>;
	public replaceEditors(editors: any[], group: any): TPromise<void> {
		return undefined;
	}

	/**
	 * Closes the editor at the provided position.
	 */
	closeEditor(position: Position, input: IEditorInput): TPromise<void> {
		return undefined;
	}

	/**
	 * Closes editors of a specific group at the provided position. If the optional editor is provided to exclude, it
	 * will not be closed. The direction can be used in that case to control if all other editors should get closed,
	 * or towards a specific direction.
	 */
	closeEditors(p1?: any, p2?: any, p3?: any): TPromise<void> {
		return undefined;
	}

	/**
	 * Closes all editors across all groups. The optional position allows to keep one group alive.
	 */
	closeAllEditors(except?: Position): TPromise<void> {
		return undefined;
	}


	createInput(input: IResourceInput | IResourceDiffInput | IResourceSideBySideInput): IEditorInput {
		return undefined;
	}


	isOpen(editor: IEditorInput | IResourceInput | IUntitledResourceInput, group?: IEditorGroup | GroupIdentifier): boolean {
		return true;
	}

	overrideOpenEditor(handler: IOpenEditorOverrideHandler): IDisposable {
		return undefined;
	}

	invokeWithinEditorContext<T>(fn: (accessor: ServicesAccessor) => T): T {
		return undefined;
	}

	getOpened(editor: IResourceInput | IUntitledResourceInput, group?: IEditorGroup | GroupIdentifier): IEditorInput {
		return undefined;
	}
}