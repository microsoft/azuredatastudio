/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { Disposable } from 'vs/base/common/lifecycle';
import { IBaseResourceEditorInput, IEditorModel } from 'vs/platform/editor/common/editor';
import { firstOrDefault } from 'vs/base/common/arrays';
import { IEditorInput, EditorInputCapabilities, Verbosity, GroupIdentifier, ISaveOptions, IRevertOptions, IMoveResult, IEditorDescriptor, IEditorPane } from 'vs/workbench/common/editor';

/**
 * Editor inputs are lightweight objects that can be passed to the workbench API to open inside the editor part.
 * Each editor input is mapped to an editor that is capable of opening it through the Platform facade.
 */
export abstract class EditorInput extends Disposable implements IEditorInput {

	protected readonly _onDidChangeDirty = this._register(new Emitter<void>());
	readonly onDidChangeDirty = this._onDidChangeDirty.event;

	protected readonly _onDidChangeLabel = this._register(new Emitter<void>());
	readonly onDidChangeLabel = this._onDidChangeLabel.event;

	protected readonly _onDidChangeCapabilities = this._register(new Emitter<void>());
	readonly onDidChangeCapabilities = this._onDidChangeCapabilities.event;

	private readonly _onWillDispose = this._register(new Emitter<void>());
	readonly onWillDispose = this._onWillDispose.event;

	private disposed: boolean = false;

	abstract get typeId(): string;

	abstract get resource(): URI | undefined;

	get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly;
	}

	hasCapability(capability: EditorInputCapabilities): boolean {
		if (capability === EditorInputCapabilities.None) {
			return this.capabilities === EditorInputCapabilities.None;
		}

		return (this.capabilities & capability) !== 0;
	}

	getName(): string {
		return `Editor ${this.typeId}`;
	}

	getDescription(verbosity?: Verbosity): string | undefined {
		return undefined;
	}

	getTitle(verbosity?: Verbosity): string {
		return this.getName();
	}

	getAriaLabel(): string {
		return this.getTitle(Verbosity.SHORT);
	}

	/**
	* Returns a descriptor suitable for telemetry events.
	*
	* Subclasses should extend if they can contribute.
	*/
	getTelemetryDescriptor(): { [key: string]: unknown } {
		/* __GDPR__FRAGMENT__
			"EditorTelemetryDescriptor" : {
				"typeId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		return { typeId: this.typeId };
	}

	isDirty(): boolean {
		return false;
	}

	isSaving(): boolean {
		return false;
	}

	async resolve(): Promise<IEditorModel | null> {
		return null;
	}

	async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		return this;
	}

	async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		return this;
	}

	async revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> { }

	rename(group: GroupIdentifier, target: URI): IMoveResult | undefined {
		return undefined;
	}

	copy(): IEditorInput {
		return this;
	}

	matches(otherInput: unknown): boolean {
		return this === otherInput;
	}

	/**
	 * If a input was registered onto multiple editors, this method
	 * will be asked to return the preferred one to use.
	 *
	 * @param editors a list of editor descriptors that are candidates
	 * for the editor input to open in.
	 */
	prefersEditor<T extends IEditorDescriptor<IEditorPane>>(editors: T[]): T | undefined {
		return firstOrDefault(editors);
	}

	asResourceEditorInput(groupId: GroupIdentifier): IBaseResourceEditorInput | undefined {
		return undefined;
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	override dispose(): void {
		if (!this.disposed) {
			this.disposed = true;
			this._onWillDispose.fire();
		}

		super.dispose();
	}
}
