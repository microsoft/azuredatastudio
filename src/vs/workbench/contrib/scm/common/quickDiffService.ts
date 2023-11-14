/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IQuickDiffService, QuickDiff, QuickDiffProvider } from 'vs/workbench/contrib/scm/common/quickDiff';
import { isEqualOrParent } from 'vs/base/common/resources';
import { score } from 'vs/editor/common/languageSelector';
import { Emitter } from 'vs/base/common/event';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';

function createProviderComparer(uri: URI): (a: QuickDiffProvider, b: QuickDiffProvider) => number {
	return (a, b) => {
		if (a.rootUri && !b.rootUri) {
			return -1;
		} else if (!a.rootUri && b.rootUri) {
			return 1;
		} else if (!a.rootUri && !b.rootUri) {
			return 0;
		}

		const aIsParent = isEqualOrParent(uri, a.rootUri!);
		const bIsParent = isEqualOrParent(uri, b.rootUri!);

		if (aIsParent && bIsParent) {
			return a.rootUri!.fsPath.length - b.rootUri!.fsPath.length;
		} else if (aIsParent) {
			return -1;
		} else if (bIsParent) {
			return 1;
		} else {
			return 0;
		}
	};
}

export class QuickDiffService extends Disposable implements IQuickDiffService {
	declare readonly _serviceBrand: undefined;

	private quickDiffProviders: Set<QuickDiffProvider> = new Set();
	private readonly _onDidChangeQuickDiffProviders = this._register(new Emitter<void>());
	readonly onDidChangeQuickDiffProviders = this._onDidChangeQuickDiffProviders.event;

	constructor(@IUriIdentityService private readonly uriIdentityService: IUriIdentityService) {
		super();
	}

	addQuickDiffProvider(quickDiff: QuickDiffProvider): IDisposable {
		this.quickDiffProviders.add(quickDiff);
		this._onDidChangeQuickDiffProviders.fire();
		return {
			dispose: () => {
				this.quickDiffProviders.delete(quickDiff);
				this._onDidChangeQuickDiffProviders.fire();
			}
		};
	}

	private isQuickDiff(diff: { originalResource?: URI; label?: string; isSCM?: boolean }): diff is QuickDiff {
		return !!diff.originalResource && (typeof diff.label === 'string') && (typeof diff.isSCM === 'boolean');
	}

	async getQuickDiffs(uri: URI, language: string = '', isSynchronized: boolean = false): Promise<QuickDiff[]> {
		const providers = Array.from(this.quickDiffProviders)
			.filter(provider => !provider.rootUri || this.uriIdentityService.extUri.isEqualOrParent(uri, provider.rootUri))
			.sort(createProviderComparer(uri));

		const diffs = await Promise.all(providers.map(async provider => {
			const scoreValue = provider.selector ? score(provider.selector, uri, language, isSynchronized, undefined, undefined) : 10;
			const diff: Partial<QuickDiff> = {
				originalResource: scoreValue > 0 ? await provider.getOriginalResource(uri) ?? undefined : undefined,
				label: provider.label,
				isSCM: provider.isSCM
			};
			return diff;
		}));
		return diffs.filter<QuickDiff>(this.isQuickDiff);
	}
}
