import {ImportDataModel} from './dataModel';
import * as sqlops from 'sqlops';

export abstract class ImportPage {
	protected readonly model: ImportDataModel;
	protected readonly view: sqlops.ModelView;

	protected constructor(model: ImportDataModel, view: sqlops.ModelView) {
		this.model = model;
		this.view = view;
	}

	public async abstract start(): Promise<boolean>;

	public async abstract onPageEnter(): Promise<boolean>;

	public async abstract onPageLeave(): Promise<boolean>;
}
