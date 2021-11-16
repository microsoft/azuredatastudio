import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { queryResultsMode } from '../../../common/editor/query/queryResultsMode';

class QueryResultDisplayOptionEntry implements IQuickPickItem {
	constructor(public displayName: string) {
	}

	public get label(): string {
		return this.displayName;
	}

	public static getDefaultLabel(): string {
		return 'Grid';
	}
}

export class ChangeQueryResultsDisplayAction extends Action {
	public static ID = 'sql.action.editor.changeQueryResultsDisplay';
	public static LABEL = nls.localize('changeQueryResultsDisplay', "Change Query Results Display");

	constructor(
		actionId: string,
		actionLabel: string,
		@IQuickInputService private _quickInputService: IQuickInputService
	) {
		super(actionId, actionLabel);
	}


	public override run(): Promise<any> {
		let queryResultDisplayOptions = Object.keys(['Grid', 'Text', 'File']).map(option => new QueryResultDisplayOptionEntry(option));

		// TODO lewissanchez - figure out how NLS works
		return this._quickInputService.pick(queryResultDisplayOptions, { placeHolder: nls.localize('pickQueryResultsDisplayOption', "Select Display Option") }).then(displayOption => {
			if (displayOption) {
				queryResultsMode.selectedMode = displayOption.label;
			}
		});
	}
}
