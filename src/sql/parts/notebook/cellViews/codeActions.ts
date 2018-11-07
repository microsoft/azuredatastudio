import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ISelectBoxOptions } from 'vs/base/browser/ui/selectBox/selectBox';
import { TaskHistoryViewlet } from 'sql/parts/taskHistory/viewlet/taskHistoryViewlet';

export class RunCellAction extends Action {
	public static ID = 'jobaction.notebookRunCell';
	public static LABEL = 'Run cell';

	constructor(
	) {
		super(RunCellAction.ID, RunCellAction.LABEL, 'newStepIcon');
	}

	public run(context: any): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}