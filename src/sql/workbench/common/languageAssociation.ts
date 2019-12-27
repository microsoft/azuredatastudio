/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorInput, EditorInput } from 'vs/workbench/common/editor';
import { ServicesAccessor, IInstantiationService, BrandedService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import { ILogService } from 'vs/platform/log/common/log';

export type InputCreator = (servicesAccessor: ServicesAccessor, activeEditor: IEditorInput) => EditorInput | undefined;
export type BaseInputCreator = (activeEditor: IEditorInput) => IEditorInput;

export interface ILanguageAssociation {
	readonly isDefault?: boolean;
	readonly languages: Array<string>;
	convertInput(activeEditor: IEditorInput): EditorInput | undefined;
	createBase(activeEditor: IEditorInput): IEditorInput;
}

type ILanguageAssociationSignature<Services extends BrandedService[]> = new (...services: Services) => ILanguageAssociation;

export interface ILanguageAssociationRegistry {
	registerLanguageAssociation<Services extends BrandedService[]>(contribution: ILanguageAssociationSignature<Services>): void;
	getAssociationForLanguage(language: string): ILanguageAssociation;
	readonly defaultAssociation: ILanguageAssociation;

	/**
	 * Starts the registry by providing the required services.
	 */
	start(accessor: ServicesAccessor): void;
}

const languageAssociationRegistery = new class implements ILanguageAssociationRegistry {
	private associationsInstances = new Array<ILanguageAssociation>();
	private associationContructors = new Array<ILanguageAssociationSignature<BrandedService[]>>();
	private defaultAssociationsInstance?: ILanguageAssociation;

	start(accessor: ServicesAccessor): void {
		const instantiationService = accessor.get(IInstantiationService);
		for (const ctor of this.associationContructors) {
			const instance = instantiationService.createInstance(ctor);
			this.associationsInstances.push(instance);
			if (instance.isDefault) {
				if (this.defaultAssociationsInstance) {
					const logService = accessor.get(ILogService);
					logService.warn('Multiple attempts to register default language association');
				} else {
					this.defaultAssociationsInstance = instance;
				}
			}
		}
	}

	registerLanguageAssociation<Services extends BrandedService[]>(contribution: ILanguageAssociationSignature<Services>): void {
		this.associationContructors.push(contribution);
	}

	getAssociationForLanguage(language: string): ILanguageAssociation | undefined {
		return this.associationsInstances.find(v => v.languages.includes(language));
	}

	get defaultAssociation(): ILanguageAssociation | undefined {
		return this.defaultAssociationsInstance;
	}
};

export const Extensions = {
	LanguageAssociations: 'workbench.contributions.editor.languageAssociation'
};

Registry.add(Extensions.LanguageAssociations, languageAssociationRegistery);

export function doHandleUpgrade(editor: EditorInput): EditorInput {
	if (editor instanceof UntitledTextEditorInput || editor instanceof FileEditorInput) {
		const activeWidget = getCodeEditor(editor);
		const textModel = activeWidget.getModel();
		const oldLanguage = textModel.getLanguageIdentifier().language;
		const association = languageAssociationRegistery.getAssociationForLanguage(oldLanguage);
		if (association) {
			return association.convertInput(editor);
		}
	}
	return editor;
}
