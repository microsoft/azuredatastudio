import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ISelectBoxOptions } from 'vs/base/browser/ui/selectBox/selectBox';
import { TaskHistoryViewlet } from 'sql/parts/taskHistory/viewlet/taskHistoryViewlet';

export class AddCellAction extends Action {
	public static ID = 'jobaction.notebookTest';
	public static LABEL = 'Cell';

	constructor(
	) {
		super(AddCellAction.ID, AddCellAction.LABEL, 'newStepIcon');
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

export class KernelsDropdown extends SelectBox {
	constructor(contextViewProvider: IContextViewProvider
	) {
		let options: string[] = ['Pyspark 3'];
		super(options, 'Pyspark 3', contextViewProvider);
	}
}

export class AttachToDropdown extends SelectBox {
	constructor(contextViewProvider: IContextViewProvider
	) {
		let options: string[] = ['localhost'];
		super(options, 'localhost', contextViewProvider);
	}
}