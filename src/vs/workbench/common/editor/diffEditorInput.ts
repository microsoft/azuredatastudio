/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbstractSideBySideEditorInputSerializer, SideBySideEditorInput } from 'vs/workbench/common/editor/sideBySideEditorInput';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { EditorModel } from 'vs/workbench/common/editor/editorModel';
import { TEXT_DIFF_EDITOR_ID, BINARY_DIFF_EDITOR_ID, Verbosity, IEditorDescriptor, IEditorPane, GroupIdentifier, IResourceDiffEditorInput } from 'vs/workbench/common/editor';
import { BaseTextEditorModel } from 'vs/workbench/common/editor/textEditorModel';
import { DiffEditorModel } from 'vs/workbench/common/editor/diffEditorModel';
import { TextDiffEditorModel } from 'vs/workbench/common/editor/textDiffEditorModel';
import { localize } from 'vs/nls';
import { AbstractTextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';
import { dirname } from 'vs/base/common/resources';
import { ILabelService } from 'vs/platform/label/common/label';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { withNullAsUndefined } from 'vs/base/common/types';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * The base editor input for the diff editor. It is made up of two editor inputs, the original version
 * and the modified version.
 */
export class DiffEditorInput extends SideBySideEditorInput {

	static override readonly ID = 'workbench.editors.diffEditorInput';

	override get typeId(): string {
		return DiffEditorInput.ID;
	}

	private cachedModel: DiffEditorModel | undefined = undefined;

	constructor(
		name: string | undefined,
		description: string | undefined,
		readonly originalInput: EditorInput,
		readonly modifiedInput: EditorInput,
		private readonly forceOpenAsBinary: boolean | undefined,
		@ILabelService private readonly labelService: ILabelService,
		@IFileService private readonly fileService: IFileService
	) {
		super(name, description, originalInput, modifiedInput);
	}

	override getName(): string {
		if (!this.name) {

			// Craft a name from original and modified input that includes the
			// relative path in case both sides have different parents and we
			// compare file resources.
			const fileResources = this.asFileResources();
			if (fileResources && dirname(fileResources.original).path !== dirname(fileResources.modified).path) {
				return `${this.labelService.getUriLabel(fileResources.original, { relative: true })} ↔ ${this.labelService.getUriLabel(fileResources.modified, { relative: true })}`;
			}

			return localize('sideBySideLabels', "{0} ↔ {1}", this.originalInput.getName(), this.modifiedInput.getName());
		}

		return this.name;
	}

	override getDescription(verbosity = Verbosity.MEDIUM): string | undefined {
		if (typeof this.description !== 'string') {

			// Pass the description of the modified side in case both original
			// and modified input have the same parent and we compare file resources.
			const fileResources = this.asFileResources();
			if (fileResources && dirname(fileResources.original).path === dirname(fileResources.modified).path) {
				return this.modifiedInput.getDescription(verbosity);
			}
		}

		return this.description;
	}

	private asFileResources(): { original: URI, modified: URI } | undefined {
		if (
			this.originalInput instanceof AbstractTextResourceEditorInput &&
			this.modifiedInput instanceof AbstractTextResourceEditorInput &&
			this.fileService.canHandleResource(this.originalInput.preferredResource) &&
			this.fileService.canHandleResource(this.modifiedInput.preferredResource)
		) {
			return {
				original: this.originalInput.preferredResource,
				modified: this.modifiedInput.preferredResource
			};
		}

		return undefined;
	}

	override async resolve(): Promise<EditorModel> {

		// Create Model - we never reuse our cached model if refresh is true because we cannot
		// decide for the inputs within if the cached model can be reused or not. There may be
		// inputs that need to be loaded again and thus we always recreate the model and dispose
		// the previous one - if any.
		const resolvedModel = await this.createModel();
		if (this.cachedModel) {
			this.cachedModel.dispose();
		}

		this.cachedModel = resolvedModel;

		return this.cachedModel;
	}

	override prefersEditor<T extends IEditorDescriptor<IEditorPane>>(editors: T[]): T | undefined {
		if (this.forceOpenAsBinary) {
			return editors.find(editor => editor.typeId === BINARY_DIFF_EDITOR_ID);
		}

		return editors.find(editor => editor.typeId === TEXT_DIFF_EDITOR_ID);
	}

	private async createModel(): Promise<DiffEditorModel> {

		// Join resolve call over two inputs and build diff editor model
		const [originalEditorModel, modifiedEditorModel] = await Promise.all([
			this.originalInput.resolve(),
			this.modifiedInput.resolve()
		]);

		// If both are text models, return textdiffeditor model
		if (modifiedEditorModel instanceof BaseTextEditorModel && originalEditorModel instanceof BaseTextEditorModel) {
			return new TextDiffEditorModel(originalEditorModel, modifiedEditorModel);
		}

		// Otherwise return normal diff model
		return new DiffEditorModel(withNullAsUndefined(originalEditorModel), withNullAsUndefined(modifiedEditorModel));
	}

	override asResourceEditorInput(groupId: GroupIdentifier): IResourceDiffEditorInput | undefined {
		const originalResourceEditorInput = this.secondary.asResourceEditorInput(groupId);
		const modifiedResourceEditorInput = this.primary.asResourceEditorInput(groupId);

		if (originalResourceEditorInput && modifiedResourceEditorInput) {
			return {
				label: this.name,
				description: this.description,
				originalInput: originalResourceEditorInput,
				modifiedInput: modifiedResourceEditorInput
			};
		}

		return undefined;
	}

	override matches(otherInput: unknown): boolean {
		if (!super.matches(otherInput)) {
			return false;
		}

		return otherInput instanceof DiffEditorInput && otherInput.forceOpenAsBinary === this.forceOpenAsBinary;
	}

	override dispose(): void {

		// Free the diff editor model but do not propagate the dispose() call to the two inputs
		// We never created the two inputs (original and modified) so we can not dispose
		// them without sideeffects.
		if (this.cachedModel) {
			this.cachedModel.dispose();
			this.cachedModel = undefined;
		}

		super.dispose();
	}
}

export class DiffEditorInputSerializer extends AbstractSideBySideEditorInputSerializer {

	protected createEditorInput(instantiationService: IInstantiationService, name: string, description: string | undefined, secondaryInput: EditorInput, primaryInput: EditorInput): EditorInput {
		return instantiationService.createInstance(DiffEditorInput, name, description, secondaryInput, primaryInput, undefined);
	}
}
