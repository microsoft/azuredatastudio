/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { sha1Hex } from 'vs/base/browser/hash';
import { onUnexpectedError } from 'vs/base/common/errors';
import { URI } from 'vs/base/common/uri';
import { IFileService, IFileStat } from 'vs/platform/files/common/files';
import { ITelemetryService, TelemetryLevel } from 'vs/platform/telemetry/common/telemetry';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { ITextFileService, } from 'vs/workbench/services/textfile/common/textfiles';
import { IWorkspaceTagsService, Tags } from 'vs/workbench/contrib/tags/common/workspaceTags';
import { IDiagnosticsService, IWorkspaceInformation } from 'vs/platform/diagnostics/common/diagnostics';
import { IRequestService } from 'vs/platform/request/common/request';
import { isWindows } from 'vs/base/common/platform';
import { getRemotes, AllowedSecondLevelDomains, getDomainsOfRemotes } from 'vs/platform/extensionManagement/common/configRemotes';
import { INativeHostService } from 'vs/platform/native/electron-sandbox/native';
import { IProductService } from 'vs/platform/product/common/productService';

export async function getHashedRemotesFromConfig(text: string, stripEndingDotGit: boolean = false): Promise<string[]> {
	return Promise.all(getRemotes(text, stripEndingDotGit).map(remote => sha1Hex(remote)));
}

export class WorkspaceTags implements IWorkbenchContribution {

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IRequestService private readonly requestService: IRequestService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IWorkspaceTagsService private readonly workspaceTagsService: IWorkspaceTagsService,
		@IDiagnosticsService private readonly diagnosticsService: IDiagnosticsService,
		@IProductService private readonly productService: IProductService,
		@INativeHostService private readonly nativeHostService: INativeHostService
	) {
		if (this.telemetryService.telemetryLevel.value === TelemetryLevel.USAGE) {
			this.report();
		}
	}

	private async report(): Promise<void> {
		// Windows-only Edition Event
		this.reportWindowsEdition();

		// Workspace Tags
		this.workspaceTagsService.getTags()
			.then(tags => this.reportWorkspaceTags(tags), error => onUnexpectedError(error));

		// Cloud Stats
		this.reportCloudStats();

		this.reportProxyStats();

		this.getWorkspaceInformation().then(stats => this.diagnosticsService.reportWorkspaceStats(stats));
	}

	private async reportWindowsEdition(): Promise<void> {
		if (!isWindows) {
			return;
		}

		let value = await this.nativeHostService.windowsGetStringRegKey('HKEY_LOCAL_MACHINE', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'EditionID');
		if (value === undefined) {
			value = 'Unknown';
		}

		this.telemetryService.publicLog2<{ edition: string }, { edition: { classification: 'SystemMetaData'; purpose: 'BusinessInsight' } }>('windowsEdition', { edition: value });
	}

	private async getWorkspaceInformation(): Promise<IWorkspaceInformation> {
		const workspace = this.contextService.getWorkspace();
		const state = this.contextService.getWorkbenchState();
		const telemetryId = await this.workspaceTagsService.getTelemetryWorkspaceId(workspace, state);
		return this.telemetryService.getTelemetryInfo().then(info => {
			return {
				id: workspace.id,
				telemetryId,
				rendererSessionId: info.sessionId,
				folders: workspace.folders,
				transient: workspace.transient,
				configuration: workspace.configuration
			};
		});
	}

	private reportWorkspaceTags(tags: Tags): void {
		/* __GDPR__
			"workspce.tags" : {
				"${include}": [
					"${WorkspaceTags}"
				]
			}
		*/
		// this.telemetryService.publicLog('workspce.tags', tags); {{SQL CARBON EDIT}} We don't need this event
	}

	private reportRemoteDomains(workspaceUris: URI[]): void {
		Promise.all<string[]>(workspaceUris.map(workspaceUri => {
			const path = workspaceUri.path;
			const uri = workspaceUri.with({ path: `${path !== '/' ? path : ''}/.git/config` });
			return this.fileService.exists(uri).then(exists => {
				if (!exists) {
					return [];
				}
				return this.textFileService.read(uri, { acceptTextOnly: true }).then(
					content => getDomainsOfRemotes(content.value, AllowedSecondLevelDomains),
					err => [] // ignore missing or binary file
				);
			});
		})).then(domains => {
			const set = domains.reduce((set, list) => list.reduce((set, item) => set.add(item), set), new Set<string>());
			const list: string[] = [];
			set.forEach(item => list.push(item));
			/* __GDPR__
				"workspace.remotes" : {
					"domains" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
				}
			*/
			this.telemetryService.publicLog('workspace.remotes', { domains: list.sort() });
		}, onUnexpectedError);
	}

	private reportRemotes(workspaceUris: URI[]): void {
		Promise.all<string[]>(workspaceUris.map(workspaceUri => {
			return this.workspaceTagsService.getHashedRemotesFromUri(workspaceUri, true);
		})).then(() => { }, onUnexpectedError);
	}

	/* __GDPR__FRAGMENT__
		"AzureTags" : {
			"node" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
		}
	*/
	private reportAzureNode(workspaceUris: URI[], tags: Tags): Promise<Tags> {
		// TODO: should also work for `node_modules` folders several levels down
		const uris = workspaceUris.map(workspaceUri => {
			const path = workspaceUri.path;
			return workspaceUri.with({ path: `${path !== '/' ? path : ''}/node_modules` });
		});
		return this.fileService.resolveAll(uris.map(resource => ({ resource }))).then(
			results => {
				const names = (<IFileStat[]>[]).concat(...results.map(result => result.success ? (result.stat!.children || []) : [])).map(c => c.name);
				const referencesAzure = WorkspaceTags.searchArray(names, /azure/i);
				if (referencesAzure) {
					tags['node'] = true;
				}
				return tags;
			},
			err => {
				return tags;
			});
	}

	private static searchArray(arr: string[], regEx: RegExp): boolean | undefined {
		return arr.some(v => v.search(regEx) > -1) || undefined;
	}

	/* __GDPR__FRAGMENT__
		"AzureTags" : {
			"java" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
		}
	*/
	private reportAzureJava(workspaceUris: URI[], tags: Tags): Promise<Tags> {
		return Promise.all(workspaceUris.map(workspaceUri => {
			const path = workspaceUri.path;
			const uri = workspaceUri.with({ path: `${path !== '/' ? path : ''}/pom.xml` });
			return this.fileService.exists(uri).then(exists => {
				if (!exists) {
					return false;
				}
				return this.textFileService.read(uri, { acceptTextOnly: true }).then(
					content => !!content.value.match(/azure/i),
					err => false
				);
			});
		})).then(javas => {
			if (javas.indexOf(true) !== -1) {
				tags['java'] = true;
			}
			return tags;
		});
	}

	private reportAzure(uris: URI[]) {
		const tags: Tags = Object.create(null);
		this.reportAzureNode(uris, tags).then((tags) => {
			return this.reportAzureJava(uris, tags);
		}).then((tags) => {
			if (Object.keys(tags).length) {
				/* __GDPR__
					"workspace.azure" : {
						"${include}": [
							"${AzureTags}"
						]
					}
				*/
				this.telemetryService.publicLog('workspace.azure', tags);
			}
		}).then(undefined, onUnexpectedError);
	}

	private reportCloudStats(): void {
		const uris = this.contextService.getWorkspace().folders.map(folder => folder.uri);
		if (uris.length && this.fileService) {
			this.reportRemoteDomains(uris);
			this.reportRemotes(uris);
			this.reportAzure(uris);
		}
	}

	private reportProxyStats() {
		const downloadUrl = this.productService.downloadUrl;
		if (!downloadUrl) {
			return;
		}
		this.requestService.resolveProxy(downloadUrl)
			.then(proxy => {
				let type = proxy ? String(proxy).trim().split(/\s+/, 1)[0] : 'EMPTY';
				if (['DIRECT', 'PROXY', 'HTTPS', 'SOCKS', 'EMPTY'].indexOf(type) === -1) {
					type = 'UNKNOWN';
				}
			}).then(undefined, onUnexpectedError);
	}
}
