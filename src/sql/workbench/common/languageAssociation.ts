/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IEditorInput } from 'vs/workbench/common/editor';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

export type InputCreator = (servicesAccessor: ServicesAccessor, activeEditor: IEditorInput) => IEditorInput | undefined;
export type BaseInputCreator = (activeEditor: IEditorInput) => IEditorInput;

export interface ILanguageAssociationRegistry {
	registerLanguageAssociation(language: string, creator: InputCreator, baseInputCreator: BaseInputCreator, isDefault?: boolean): void;
	getAssociations(): Array<{ language: string, creator: InputCreator, baseInputCreator: BaseInputCreator, isDefault: boolean }>;
}

class LanguageAssociationRegistry implements ILanguageAssociationRegistry {
	private associations = new Array<{ language: string, creator: InputCreator, baseInputCreator: BaseInputCreator, isDefault: boolean }>();

	registerLanguageAssociation(language: string, creator: InputCreator, baseInputCreator: BaseInputCreator, isDefault: boolean = false): void {
		this.associations.push({ language, creator, baseInputCreator, isDefault });
	}

	getAssociations(): Array<{ language: string, creator: InputCreator, baseInputCreator: BaseInputCreator, isDefault: boolean }> {
		return this.associations.slice();
	}
}

export const Extensions = {
	LanguageAssociations: 'workbench.contributions.editor.languageAssociation'
};

Registry.add(Extensions.LanguageAssociations, new LanguageAssociationRegistry());