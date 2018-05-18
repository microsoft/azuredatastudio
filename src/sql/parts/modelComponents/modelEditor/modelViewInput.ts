/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Builder } from 'vs/base/browser/builder';
import { Disposable } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import URI from 'vs/base/common/uri';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IEditorModel, IEditorOptions } from 'vs/platform/editor/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Dimension } from 'vs/workbench/services/part/common/partService';
import { EditorInput, EditorModel, EditorOptions } from 'vs/workbench/common/editor';
import { BaseTextEditorModel } from 'vs/workbench/common/editor/textEditorModel';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';

import { IModelViewService } from 'sql/services/modelComponents/modelViewService';
import { IModelView } from 'sql/services/model/modelViewService';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { Dialog } from 'sql/platform/dialog/dialogTypes';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';

export class ModelViewInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.ModelViewEditorInput';

	constructor(private _title: string, private _modelViewId: string) {
		super();
	}

	public get title(): string {
		return this._title;
	}

	public get modelViewId(): string {
		return this._modelViewId;
	}

	public getTypeId(): string {
		return 'ModelViewEditorInput';
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return this._title;
	}
}
