/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { coalesce } from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { registerModelAndPositionCommand } from 'vs/editor/browser/editorExtensions';
import { Position } from 'vs/editor/common/core/position';
import { LanguageFeatureRegistry } from 'vs/editor/common/languageFeatureRegistry';
import { DeclarationProvider, DefinitionProvider, ImplementationProvider, LocationLink, ProviderResult, ReferenceProvider, TypeDefinitionProvider } from 'vs/editor/common/languages';
import { ITextModel } from 'vs/editor/common/model';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { ReferencesModel } from 'vs/editor/contrib/gotoSymbol/browser/referencesModel';

async function getLocationLinks<T>(
	model: ITextModel,
	position: Position,
	registry: LanguageFeatureRegistry<T>,
	provide: (provider: T, model: ITextModel, position: Position) => ProviderResult<LocationLink | LocationLink[]>
): Promise<LocationLink[]> {
	const provider = registry.ordered(model);

	// get results
	const promises = provider.map((provider): Promise<LocationLink | LocationLink[] | undefined> => {
		return Promise.resolve(provide(provider, model, position)).then(undefined, err => {
			onUnexpectedExternalError(err);
			return undefined;
		});
	});

	const values = await Promise.all(promises);
	return coalesce(values.flat());
}

export function getDefinitionsAtPosition(registry: LanguageFeatureRegistry<DefinitionProvider>, model: ITextModel, position: Position, token: CancellationToken): Promise<LocationLink[]> {
	return getLocationLinks(model, position, registry, (provider, model, position) => {
		return provider.provideDefinition(model, position, token);
	});
}

export function getDeclarationsAtPosition(registry: LanguageFeatureRegistry<DeclarationProvider>, model: ITextModel, position: Position, token: CancellationToken): Promise<LocationLink[]> {
	return getLocationLinks(model, position, registry, (provider, model, position) => {
		return provider.provideDeclaration(model, position, token);
	});
}

export function getImplementationsAtPosition(registry: LanguageFeatureRegistry<ImplementationProvider>, model: ITextModel, position: Position, token: CancellationToken): Promise<LocationLink[]> {
	return getLocationLinks(model, position, registry, (provider, model, position) => {
		return provider.provideImplementation(model, position, token);
	});
}

export function getTypeDefinitionsAtPosition(registry: LanguageFeatureRegistry<TypeDefinitionProvider>, model: ITextModel, position: Position, token: CancellationToken): Promise<LocationLink[]> {
	return getLocationLinks(model, position, registry, (provider, model, position) => {
		return provider.provideTypeDefinition(model, position, token);
	});
}

export function getReferencesAtPosition(registry: LanguageFeatureRegistry<ReferenceProvider>, model: ITextModel, position: Position, compact: boolean, token: CancellationToken): Promise<LocationLink[]> {
	return getLocationLinks(model, position, registry, async (provider, model, position) => {
		const result = await provider.provideReferences(model, position, { includeDeclaration: true }, token);
		if (!compact || !result || result.length !== 2) {
			return result;
		}
		const resultWithoutDeclaration = await provider.provideReferences(model, position, { includeDeclaration: false }, token);
		if (resultWithoutDeclaration && resultWithoutDeclaration.length === 1) {
			return resultWithoutDeclaration;
		}
		return result;
	});
}

// -- API commands ----

async function _sortedAndDeduped(callback: () => Promise<LocationLink[]>): Promise<LocationLink[]> {
	const rawLinks = await callback();
	const model = new ReferencesModel(rawLinks, '');
	const modelLinks = model.references.map(ref => ref.link);
	model.dispose();
	return modelLinks;
}

registerModelAndPositionCommand('_executeDefinitionProvider', (accessor, model, position) => {
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const promise = getDefinitionsAtPosition(languageFeaturesService.definitionProvider, model, position, CancellationToken.None);
	return _sortedAndDeduped(() => promise);
});

registerModelAndPositionCommand('_executeTypeDefinitionProvider', (accessor, model, position) => {
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const promise = getTypeDefinitionsAtPosition(languageFeaturesService.typeDefinitionProvider, model, position, CancellationToken.None);
	return _sortedAndDeduped(() => promise);
});

registerModelAndPositionCommand('_executeDeclarationProvider', (accessor, model, position) => {
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const promise = getDeclarationsAtPosition(languageFeaturesService.declarationProvider, model, position, CancellationToken.None);
	return _sortedAndDeduped(() => promise);
});

registerModelAndPositionCommand('_executeReferenceProvider', (accessor, model, position) => {
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const promise = getReferencesAtPosition(languageFeaturesService.referenceProvider, model, position, false, CancellationToken.None);
	return _sortedAndDeduped(() => promise);
});

registerModelAndPositionCommand('_executeImplementationProvider', (accessor, model, position) => {
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const promise = getImplementationsAtPosition(languageFeaturesService.implementationProvider, model, position, CancellationToken.None);
	return _sortedAndDeduped(() => promise);
});
