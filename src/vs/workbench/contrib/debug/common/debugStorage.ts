/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { StorageScope, IStorageService } from 'vs/platform/storage/common/storage';
import { ExceptionBreakpoint, Expression, Breakpoint, FunctionBreakpoint, DataBreakpoint } from 'vs/workbench/contrib/debug/common/debugModel';
import { IEvaluate, IExpression, IDebugModel } from 'vs/workbench/contrib/debug/common/debug';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';

const DEBUG_BREAKPOINTS_KEY = 'debug.breakpoint';
const DEBUG_FUNCTION_BREAKPOINTS_KEY = 'debug.functionbreakpoint';
const DEBUG_DATA_BREAKPOINTS_KEY = 'debug.databreakpoint';
const DEBUG_EXCEPTION_BREAKPOINTS_KEY = 'debug.exceptionbreakpoint';
const DEBUG_WATCH_EXPRESSIONS_KEY = 'debug.watchexpressions';

export class DebugStorage {
	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ITextFileService private readonly textFileService: ITextFileService
	) { }

	loadBreakpoints(): Breakpoint[] {
		let result: Breakpoint[] | undefined;
		try {
			result = JSON.parse(this.storageService.get(DEBUG_BREAKPOINTS_KEY, StorageScope.WORKSPACE, '[]')).map((breakpoint: any) => {
				return new Breakpoint(URI.parse(breakpoint.uri.external || breakpoint.source.uri.external), breakpoint.lineNumber, breakpoint.column, breakpoint.enabled, breakpoint.condition, breakpoint.hitCondition, breakpoint.logMessage, breakpoint.adapterData, this.textFileService);
			});
		} catch (e) { }

		return result || [];
	}

	loadFunctionBreakpoints(): FunctionBreakpoint[] {
		let result: FunctionBreakpoint[] | undefined;
		try {
			result = JSON.parse(this.storageService.get(DEBUG_FUNCTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE, '[]')).map((fb: any) => {
				return new FunctionBreakpoint(fb.name, fb.enabled, fb.hitCondition, fb.condition, fb.logMessage);
			});
		} catch (e) { }

		return result || [];
	}

	loadExceptionBreakpoints(): ExceptionBreakpoint[] {
		let result: ExceptionBreakpoint[] | undefined;
		try {
			result = JSON.parse(this.storageService.get(DEBUG_EXCEPTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE, '[]')).map((exBreakpoint: any) => {
				return new ExceptionBreakpoint(exBreakpoint.filter, exBreakpoint.label, exBreakpoint.enabled);
			});
		} catch (e) { }

		return result || [];
	}

	loadDataBreakpoints(): DataBreakpoint[] {
		let result: DataBreakpoint[] | undefined;
		try {
			result = JSON.parse(this.storageService.get(DEBUG_DATA_BREAKPOINTS_KEY, StorageScope.WORKSPACE, '[]')).map((dbp: any) => {
				return new DataBreakpoint(dbp.description, dbp.dataId, true, dbp.enabled, dbp.hitCondition, dbp.condition, dbp.logMessage, dbp.accessTypes);
			});
		} catch (e) { }

		return result || [];
	}

	loadWatchExpressions(): Expression[] {
		let result: Expression[] | undefined;
		try {
			result = JSON.parse(this.storageService.get(DEBUG_WATCH_EXPRESSIONS_KEY, StorageScope.WORKSPACE, '[]')).map((watchStoredData: { name: string, id: string }) => {
				return new Expression(watchStoredData.name, watchStoredData.id);
			});
		} catch (e) { }

		return result || [];
	}

	storeWatchExpressions(watchExpressions: (IExpression & IEvaluate)[]): void {
		if (watchExpressions.length) {
			this.storageService.store(DEBUG_WATCH_EXPRESSIONS_KEY, JSON.stringify(watchExpressions.map(we => ({ name: we.name, id: we.getId() }))), StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(DEBUG_WATCH_EXPRESSIONS_KEY, StorageScope.WORKSPACE);
		}
	}

	storeBreakpoints(debugModel: IDebugModel): void {
		const breakpoints = debugModel.getBreakpoints();
		if (breakpoints.length) {
			this.storageService.store(DEBUG_BREAKPOINTS_KEY, JSON.stringify(breakpoints), StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(DEBUG_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
		}

		const functionBreakpoints = debugModel.getFunctionBreakpoints();
		if (functionBreakpoints.length) {
			this.storageService.store(DEBUG_FUNCTION_BREAKPOINTS_KEY, JSON.stringify(functionBreakpoints), StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(DEBUG_FUNCTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
		}

		const dataBreakpoints = debugModel.getDataBreakpoints().filter(dbp => dbp.canPersist);
		if (dataBreakpoints.length) {
			this.storageService.store(DEBUG_DATA_BREAKPOINTS_KEY, JSON.stringify(dataBreakpoints), StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(DEBUG_DATA_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
		}

		const exceptionBreakpoints = debugModel.getExceptionBreakpoints();
		if (exceptionBreakpoints.length) {
			this.storageService.store(DEBUG_EXCEPTION_BREAKPOINTS_KEY, JSON.stringify(exceptionBreakpoints), StorageScope.WORKSPACE);
		} else {
			this.storageService.remove(DEBUG_EXCEPTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
		}
	}
}
