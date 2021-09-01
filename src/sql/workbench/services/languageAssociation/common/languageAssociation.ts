/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorInput } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { ServicesAccessor, IInstantiationService, BrandedService } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';

export type InputCreator = (servicesAccessor: ServicesAccessor, activeEditor: IEditorInput) => EditorInput | undefined;
export type BaseInputCreator = (activeEditor: IEditorInput) => IEditorInput;

export interface ILanguageAssociation {
	convertInput(activeEditor: IEditorInput): Promise<EditorInput | undefined> | EditorInput | undefined;
	syncConvertInput?(activeEditor: IEditorInput): EditorInput | undefined;
	createBase(activeEditor: IEditorInput): IEditorInput;
}

type ILanguageAssociationSignature<Services extends BrandedService[]> = new (...services: Services) => ILanguageAssociation;

export interface ILanguageAssociationRegistry {
	registerLanguageAssociation<Services extends BrandedService[]>(languages: string[], contribution: ILanguageAssociationSignature<Services>, isDefault?: boolean): IDisposable;
	/**
	 * Gets the registered association for a language if one is registered
	 * @param language The case-insensitive language ID to get the association for
	 */
	getAssociationForLanguage(language: string): ILanguageAssociation | undefined;
	readonly defaultAssociation: [string, ILanguageAssociation] | undefined;

	/**
	 * Starts the registry by providing the required services.
	 */
	start(accessor: ServicesAccessor): void;
}

const languageAssociationRegistry = new class implements ILanguageAssociationRegistry {
	private associationsInstances = new Map<string, ILanguageAssociation>();
	private associationContructors = new Map<string, ILanguageAssociationSignature<BrandedService[]>>();
	private defaultAssociationsInstance?: [string, ILanguageAssociation];
	private defaultAssociationsConstructor?: [string, ILanguageAssociationSignature<BrandedService[]>];

	start(accessor: ServicesAccessor): void {
		const instantiationService = accessor.get(IInstantiationService);

		for (const [language, ctor] of this.associationContructors) {
			const instance = instantiationService.createInstance(ctor);
			this.associationsInstances.set(language, instance);
		}

		if (this.defaultAssociationsConstructor) {
			this.defaultAssociationsInstance = [this.defaultAssociationsConstructor[0], instantiationService.createInstance(this.defaultAssociationsConstructor[1])];
		}
	}

	registerLanguageAssociation(languages: string[], contribution: ILanguageAssociationSignature<BrandedService[]>, isDefault?: boolean): IDisposable {
		languages = languages.map(lang => lang.toLowerCase());
		for (const language of languages) {
			this.associationContructors.set(language, contribution);
		}

		if (isDefault) {
			this.defaultAssociationsConstructor = [languages[0], contribution];
		}

		return toDisposable(() => {
			for (const language of languages) {
				this.associationContructors.delete(language);
				this.associationsInstances.delete(language);
			}
		});
	}

	getAssociationForLanguage(language: string): ILanguageAssociation | undefined {
		return this.associationsInstances.get(language.toLowerCase());
	}

	get defaultAssociation(): [string, ILanguageAssociation] | undefined {
		return this.defaultAssociationsInstance;
	}
};

export const Extensions = {
	LanguageAssociations: 'workbench.contributions.editor.languageAssociation'
};

Registry.add(Extensions.LanguageAssociations, languageAssociationRegistry);
