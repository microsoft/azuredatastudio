/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IExtensionService, IResponsiveStateChangeEvent, ICpuProfilerTarget, IExtensionHostProfile, ProfileSession } from 'vs/workbench/services/extensions/common/extensions';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { onUnexpectedError } from 'vs/base/common/errors';
import * as os from 'os';
import { join } from 'vs/base/common/path';
import { writeFile } from 'vs/base/node/pfs';
import { IExtensionHostProfileService } from 'vs/workbench/contrib/extensions/electron-browser/runtimeExtensionsEditor';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { RuntimeExtensionsInput } from 'vs/workbench/contrib/extensions/electron-browser/runtimeExtensionsInput';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { createSlowExtensionAction } from 'vs/workbench/contrib/extensions/electron-browser/extensionsSlowActions';

export class ExtensionsAutoProfiler extends Disposable implements IWorkbenchContribution {

	private readonly _session = new Map<ICpuProfilerTarget, CancellationTokenSource>();
	private readonly _blame = new Set<string>();

	constructor(
		@IExtensionService private readonly _extensionService: IExtensionService,
		@IExtensionHostProfileService private readonly _extensionProfileService: IExtensionHostProfileService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IEditorService private readonly _editorService: IEditorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();
		this._register(_extensionService.onDidChangeResponsiveChange(this._onDidChangeResponsiveChange, this));
	}

	private async _onDidChangeResponsiveChange(event: IResponsiveStateChangeEvent): Promise<void> {
		const { target } = event;

		if (!target.canProfileExtensionHost()) {
			return;
		}

		if (event.isResponsive && this._session.has(target)) {
			// stop profiling when responsive again
			this._session.get(target)!.cancel();

		} else if (!event.isResponsive && !this._session.has(target)) {
			// start profiling if not yet profiling
			const token = new CancellationTokenSource();
			this._session.set(target, token);

			let session: ProfileSession;
			try {
				session = await target.startExtensionHostProfile();
			} catch (err) {
				this._session.delete(target);
				// fail silent as this is often
				// caused by another party being
				// connected already
				return;
			}

			// wait 5 seconds or until responsive again
			await new Promise(resolve => {
				token.token.onCancellationRequested(resolve);
				setTimeout(resolve, 5e3);
			});

			try {
				// stop profiling and analyse results
				this._processCpuProfile(await session.stop());
			} catch (err) {
				onUnexpectedError(err);
			} finally {
				this._session.delete(target);
			}
		}
	}

	private async _processCpuProfile(profile: IExtensionHostProfile) {

		interface NamedSlice {
			id: string;
			total: number;
			percentage: number;
		}

		let data: NamedSlice[] = [];
		for (let i = 0; i < profile.ids.length; i++) {
			let id = profile.ids[i];
			let total = profile.deltas[i];
			data.push({ id, total, percentage: 0 });
		}

		// merge data by identifier
		let anchor = 0;
		data.sort((a, b) => a.id.localeCompare(b.id));
		for (let i = 1; i < data.length; i++) {
			if (data[anchor].id === data[i].id) {
				data[anchor].total += data[i].total;
			} else {
				anchor += 1;
				data[anchor] = data[i];
			}
		}
		data = data.slice(0, anchor + 1);

		const duration = profile.endTime - profile.startTime;
		const percentage = duration / 100;
		let top: NamedSlice | undefined;
		for (const slice of data) {
			slice.percentage = Math.round(slice.total / percentage);
			if (!top || top.percentage < slice.percentage) {
				top = slice;
			}
		}

		if (!top) {
			return;
		}

		const extension = await this._extensionService.getExtension(top.id);
		if (!extension) {
			// not an extension => idle, gc, self?
			return;
		}


		// print message to log
		const path = join(os.tmpdir(), `exthost-${Math.random().toString(16).slice(2, 8)}.cpuprofile`);
		await writeFile(path, JSON.stringify(profile.data));
		this._logService.warn(`UNRESPONSIVE extension host, '${top.id}' took ${top!.percentage}% of ${duration / 1e3}ms, saved PROFILE here: '${path}'`, data);


		/* __GDPR__
			"exthostunresponsive" : {
				"id" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" },
				"duration" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
				"data": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
			}
		*/
		this._telemetryService.publicLog('exthostunresponsive', {
			duration,
			data,
		});

		// add to running extensions view
		this._extensionProfileService.setUnresponsiveProfile(extension.identifier, profile);

		// prompt: when really slow/greedy
		if (!(top.percentage >= 99 && top.total >= 5e6)) {
			return;
		}

		const action = await this._instantiationService.invokeFunction(createSlowExtensionAction, extension, profile);

		if (!action) {
			// cannot report issues against this extension...
			return;
		}

		// only blame once per extension, don't blame too often
		if (this._blame.has(ExtensionIdentifier.toKey(extension.identifier)) || this._blame.size >= 3) {
			return;
		}
		this._blame.add(ExtensionIdentifier.toKey(extension.identifier));

		// user-facing message when very bad...
		this._notificationService.prompt(
			Severity.Warning,
			localize(
				'unresponsive-exthost',
				"The extension '{0}' took a very long time to complete its last operation and it has prevented other extensions from running.",
				extension.displayName || extension.name
			),
			[{
				label: localize('show', 'Show Extensions'),
				run: () => this._editorService.openEditor(new RuntimeExtensionsInput())
			},
				action
			],
			{ silent: true }
		);
	}
}
