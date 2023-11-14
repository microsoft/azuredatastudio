/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { TextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';
import { ITextModelService, ITextModelContentProvider } from 'vs/editor/common/services/resolverService';
import { ITextModel } from 'vs/editor/common/model';
import { ILifecycleService, LifecyclePhase, StartupKindToString } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IModelService } from 'vs/editor/common/services/model';
import { ITimerService } from 'vs/workbench/services/timer/browser/timerService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { writeTransientState } from 'vs/workbench/contrib/codeEditor/browser/toggleWordWrap';
import { LoaderStats, isESM } from 'vs/base/common/amd';
import { IProductService } from 'vs/platform/product/common/productService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ByteSize, IFileService } from 'vs/platform/files/common/files';
import { ILabelService } from 'vs/platform/label/common/label';
import { isWeb } from 'vs/base/common/platform';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { ITerminalService } from 'vs/workbench/contrib/terminal/browser/terminal';
import * as perf from 'vs/base/common/performance';

export class PerfviewContrib {

	private readonly _registration: IDisposable;

	constructor(
		@IInstantiationService instaService: IInstantiationService,
		@ITextModelService textModelResolverService: ITextModelService
	) {
		this._registration = textModelResolverService.registerTextModelContentProvider('perf', instaService.createInstance(PerfModelContentProvider));
	}

	dispose(): void {
		this._registration.dispose();
	}
}

export class PerfviewInput extends TextResourceEditorInput {

	static readonly Id = 'PerfviewInput';
	static readonly Uri = URI.from({ scheme: 'perf', path: 'Startup Performance' });

	override get typeId(): string {
		return PerfviewInput.Id;
	}

	constructor(
		@ITextModelService textModelResolverService: ITextModelService,
		@ITextFileService textFileService: ITextFileService,
		@IEditorService editorService: IEditorService,
		@IFileService fileService: IFileService,
		@ILabelService labelService: ILabelService,
		@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService
	) {
		super(
			PerfviewInput.Uri,
			localize('name', "Startup Performance"),
			undefined,
			undefined,
			undefined,
			textModelResolverService,
			textFileService,
			editorService,
			fileService,
			labelService,
			filesConfigurationService
		);
	}
}

class PerfModelContentProvider implements ITextModelContentProvider {

	private _model: ITextModel | undefined;
	private _modelDisposables: IDisposable[] = [];

	constructor(
		@IModelService private readonly _modelService: IModelService,
		@ILanguageService private readonly _languageService: ILanguageService,
		@ICodeEditorService private readonly _editorService: ICodeEditorService,
		@ILifecycleService private readonly _lifecycleService: ILifecycleService,
		@ITimerService private readonly _timerService: ITimerService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@IProductService private readonly _productService: IProductService,
		@ITerminalService private readonly _terminalService: ITerminalService
	) { }

	provideTextContent(resource: URI): Promise<ITextModel> {

		if (!this._model || this._model.isDisposed()) {
			dispose(this._modelDisposables);
			const langId = this._languageService.createById('markdown');
			this._model = this._modelService.getModel(resource) || this._modelService.createModel('Loading...', langId, resource);

			this._modelDisposables.push(langId.onDidChange(e => {
				this._model?.setLanguage(e);
			}));
			this._modelDisposables.push(this._extensionService.onDidChangeExtensionsStatus(this._updateModel, this));

			writeTransientState(this._model, { wordWrapOverride: 'off' }, this._editorService);
		}
		this._updateModel();
		return Promise.resolve(this._model);
	}

	private _updateModel(): void {

		Promise.all([
			this._timerService.whenReady(),
			this._lifecycleService.when(LifecyclePhase.Eventually),
			this._extensionService.whenInstalledExtensionsRegistered(),
			this._terminalService.whenConnected
		]).then(() => {
			if (this._model && !this._model.isDisposed()) {

				const stats = LoaderStats.get();
				const md = new MarkdownBuilder();
				this._addSummary(md);
				md.blank();
				this._addSummaryTable(md, stats);
				md.blank();
				this._addExtensionsTable(md);
				md.blank();
				this._addPerfMarksTable('Terminal Stats', md, this._timerService.getPerformanceMarks().find(e => e[0] === 'renderer')?.[1].filter(e => e.name.startsWith('code/terminal/')));
				md.blank();
				this._addRawPerfMarks(md);
				if (!isESM) {
					md.blank();
					this._addLoaderStats(md, stats);
					md.blank();
					this._addCachedDataStats(md);
				}
				md.blank();
				this._addResourceTimingStats(md);

				this._model.setValue(md.value);
			}
		});

	}

	private _addSummary(md: MarkdownBuilder): void {
		const metrics = this._timerService.startupMetrics;
		md.heading(2, 'System Info');
		md.li(`${this._productService.nameShort}: ${this._productService.version} (${this._productService.commit || '0000000'})`);
		md.li(`OS: ${metrics.platform}(${metrics.release})`);
		if (metrics.cpus) {
			md.li(`CPUs: ${metrics.cpus.model}(${metrics.cpus.count} x ${metrics.cpus.speed})`);
		}
		if (typeof metrics.totalmem === 'number' && typeof metrics.freemem === 'number') {
			md.li(`Memory(System): ${(metrics.totalmem / (ByteSize.GB)).toFixed(2)} GB(${(metrics.freemem / (ByteSize.GB)).toFixed(2)}GB free)`);
		}
		if (metrics.meminfo) {
			md.li(`Memory(Process): ${(metrics.meminfo.workingSetSize / ByteSize.KB).toFixed(2)} MB working set(${(metrics.meminfo.privateBytes / ByteSize.KB).toFixed(2)}MB private, ${(metrics.meminfo.sharedBytes / ByteSize.KB).toFixed(2)}MB shared)`);
		}
		md.li(`VM(likelihood): ${metrics.isVMLikelyhood}%`);
		md.li(`Initial Startup: ${metrics.initialStartup}`);
		md.li(`Has ${metrics.windowCount - 1} other windows`);
		md.li(`Screen Reader Active: ${metrics.hasAccessibilitySupport}`);
		md.li(`Empty Workspace: ${metrics.emptyWorkbench}`);
	}

	private _addSummaryTable(md: MarkdownBuilder, stats?: LoaderStats): void {

		const metrics = this._timerService.startupMetrics;
		const table: Array<Array<string | number | undefined>> = [];
		table.push(['start => app.isReady', metrics.timers.ellapsedAppReady, '[main]', `initial startup: ${metrics.initialStartup}`]);
		table.push(['nls:start => nls:end', metrics.timers.ellapsedNlsGeneration, '[main]', `initial startup: ${metrics.initialStartup}`]);
		table.push(['require(main.bundle.js)', metrics.timers.ellapsedLoadMainBundle, '[main]', `initial startup: ${metrics.initialStartup}`]);
		table.push(['start crash reporter', metrics.timers.ellapsedCrashReporter, '[main]', `initial startup: ${metrics.initialStartup}`]);
		table.push(['serve main IPC handle', metrics.timers.ellapsedMainServer, '[main]', `initial startup: ${metrics.initialStartup}`]);
		table.push(['create window', metrics.timers.ellapsedWindowCreate, '[main]', `initial startup: ${metrics.initialStartup}, ${metrics.initialStartup ? `state: ${metrics.timers.ellapsedWindowRestoreState}ms, widget: ${metrics.timers.ellapsedBrowserWindowCreate}ms, show: ${metrics.timers.ellapsedWindowMaximize}ms` : ''}`]);
		table.push(['app.isReady => window.loadUrl()', metrics.timers.ellapsedWindowLoad, '[main]', `initial startup: ${metrics.initialStartup}`]);
		table.push(['window.loadUrl() => begin to require(workbench.desktop.main.js)', metrics.timers.ellapsedWindowLoadToRequire, '[main->renderer]', StartupKindToString(metrics.windowKind)]);
		table.push(['require(workbench.desktop.main.js)', metrics.timers.ellapsedRequire, '[renderer]', `cached data: ${(metrics.didUseCachedData ? 'YES' : 'NO')}${stats ? `, node_modules took ${stats.nodeRequireTotal}ms` : ''}`]);
		table.push(['wait for window config', metrics.timers.ellapsedWaitForWindowConfig, '[renderer]', undefined]);
		table.push(['init storage (global & workspace)', metrics.timers.ellapsedStorageInit, '[renderer]', undefined]);
		table.push(['init workspace service', metrics.timers.ellapsedWorkspaceServiceInit, '[renderer]', undefined]);
		if (isWeb) {
			table.push(['init settings and global state from settings sync service', metrics.timers.ellapsedRequiredUserDataInit, '[renderer]', undefined]);
			table.push(['init keybindings, snippets & extensions from settings sync service', metrics.timers.ellapsedOtherUserDataInit, '[renderer]', undefined]);
		}
		table.push(['register extensions & spawn extension host', metrics.timers.ellapsedExtensions, '[renderer]', undefined]);
		table.push(['restore viewlet', metrics.timers.ellapsedViewletRestore, '[renderer]', metrics.viewletId]);
		table.push(['restore panel', metrics.timers.ellapsedPanelRestore, '[renderer]', metrics.panelId]);
		table.push(['restore & resolve visible editors', metrics.timers.ellapsedEditorRestore, '[renderer]', `${metrics.editorIds.length}: ${metrics.editorIds.join(', ')}`]);
		table.push(['overall workbench load', metrics.timers.ellapsedWorkbench, '[renderer]', undefined]);
		table.push(['workbench ready', metrics.ellapsed, '[main->renderer]', undefined]);
		table.push(['renderer ready', metrics.timers.ellapsedRenderer, '[renderer]', undefined]);
		table.push(['shared process connection ready', metrics.timers.ellapsedSharedProcesConnected, '[renderer->sharedprocess]', undefined]);
		table.push(['extensions registered', metrics.timers.ellapsedExtensionsReady, '[renderer]', undefined]);

		md.heading(2, 'Performance Marks');
		md.table(['What', 'Duration', 'Process', 'Info'], table);
	}

	private _addExtensionsTable(md: MarkdownBuilder): void {

		const eager: ({ toString(): string })[][] = [];
		const normal: ({ toString(): string })[][] = [];
		const extensionsStatus = this._extensionService.getExtensionsStatus();
		for (const id in extensionsStatus) {
			const { activationTimes: times } = extensionsStatus[id];
			if (!times) {
				continue;
			}
			if (times.activationReason.startup) {
				eager.push([id, times.activationReason.startup, times.codeLoadingTime, times.activateCallTime, times.activateResolvedTime, times.activationReason.activationEvent, times.activationReason.extensionId.value]);
			} else {
				normal.push([id, times.activationReason.startup, times.codeLoadingTime, times.activateCallTime, times.activateResolvedTime, times.activationReason.activationEvent, times.activationReason.extensionId.value]);
			}
		}

		const table = eager.concat(normal);
		if (table.length > 0) {
			md.heading(2, 'Extension Activation Stats');
			md.table(
				['Extension', 'Eager', 'Load Code', 'Call Activate', 'Finish Activate', 'Event', 'By'],
				table
			);
		}
	}

	private _addPerfMarksTable(name: string, md: MarkdownBuilder, marks: readonly perf.PerformanceMark[] | undefined): void {
		if (!marks) {
			return;
		}
		const table: Array<Array<string | number | undefined>> = [];
		let lastStartTime = -1;
		let total = 0;
		for (const { name, startTime } of marks) {
			const delta = lastStartTime !== -1 ? startTime - lastStartTime : 0;
			total += delta;
			table.push([name, Math.round(startTime), Math.round(delta), Math.round(total)]);
			lastStartTime = startTime;
		}
		md.heading(2, name);
		md.table(['Name', 'Timestamp', 'Delta', 'Total'], table);
	}

	private _addRawPerfMarks(md: MarkdownBuilder): void {

		for (const [source, marks] of this._timerService.getPerformanceMarks()) {
			md.heading(2, `Raw Perf Marks: ${source}`);
			md.value += '```\n';
			md.value += `Name\tTimestamp\tDelta\tTotal\n`;
			let lastStartTime = -1;
			let total = 0;
			for (const { name, startTime } of marks) {
				const delta = lastStartTime !== -1 ? startTime - lastStartTime : 0;
				total += delta;
				md.value += `${name}\t${startTime}\t${delta}\t${total}\n`;
				lastStartTime = startTime;
			}
			md.value += '```\n';
		}
	}

	private _addLoaderStats(md: MarkdownBuilder, stats: LoaderStats): void {
		md.heading(2, 'Loader Stats');
		md.heading(3, 'Load AMD-module');
		md.table(['Module', 'Duration'], stats.amdLoad);
		md.blank();
		md.heading(3, 'Load commonjs-module');
		md.table(['Module', 'Duration'], stats.nodeRequire);
		md.blank();
		md.heading(3, 'Invoke AMD-module factory');
		md.table(['Module', 'Duration'], stats.amdInvoke);
		md.blank();
		md.heading(3, 'Invoke commonjs-module');
		md.table(['Module', 'Duration'], stats.nodeEval);
	}

	private _addCachedDataStats(md: MarkdownBuilder): void {

		const map = new Map<LoaderEventType, string[]>();
		map.set(LoaderEventType.CachedDataCreated, []);
		map.set(LoaderEventType.CachedDataFound, []);
		map.set(LoaderEventType.CachedDataMissed, []);
		map.set(LoaderEventType.CachedDataRejected, []);
		if (typeof require.getStats === 'function') {
			for (const stat of require.getStats()) {
				if (map.has(stat.type)) {
					map.get(stat.type)!.push(stat.detail);
				}
			}
		}

		const printLists = (arr?: string[]) => {
			if (arr) {
				arr.sort();
				for (const e of arr) {
					md.li(`${e}`);
				}
				md.blank();
			}
		};

		md.heading(2, 'Node Cached Data Stats');
		md.blank();
		md.heading(3, 'cached data used');
		printLists(map.get(LoaderEventType.CachedDataFound));
		md.heading(3, 'cached data missed');
		printLists(map.get(LoaderEventType.CachedDataMissed));
		md.heading(3, 'cached data rejected');
		printLists(map.get(LoaderEventType.CachedDataRejected));
		md.heading(3, 'cached data created (lazy, might need refreshes)');
		printLists(map.get(LoaderEventType.CachedDataCreated));
	}

	private _addResourceTimingStats(md: MarkdownBuilder) {
		const stats = performance.getEntriesByType('resource').map(entry => {
			return [entry.name, entry.duration];
		});
		if (!stats.length) {
			return;
		}
		md.heading(2, 'Resource Timing Stats');
		md.table(['Name', 'Duration'], stats);
	}
}

class MarkdownBuilder {

	value: string = '';

	heading(level: number, value: string): this {
		this.value += `${'#'.repeat(level)} ${value}\n\n`;
		return this;
	}

	blank() {
		this.value += '\n';
		return this;
	}

	li(value: string) {
		this.value += `* ${value}\n`;
		return this;
	}

	table(header: string[], rows: Array<Array<{ toString(): string } | undefined>>) {
		this.value += LoaderStats.toMarkdownTable(header, rows);
	}
}
