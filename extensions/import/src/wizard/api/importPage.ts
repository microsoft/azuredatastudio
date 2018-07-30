import {ImportDataModel} from './models';
import * as sqlops from 'sqlops';
import {FlatFileProvider} from '../../services/contracts';
import {FlatFileWizard} from '../flatFileWizard';

export abstract class ImportPage {
	protected readonly instance: FlatFileWizard;
	protected readonly model: ImportDataModel;
	protected readonly view: sqlops.ModelView;
	protected readonly provider: FlatFileProvider;

	protected constructor(instance: FlatFileWizard, model: ImportDataModel, view: sqlops.ModelView, provider: FlatFileProvider) {
		this.instance = instance;
		this.model = model;
		this.view = view;
		this.provider = provider;
	}

	public async abstract start(): Promise<boolean>;

	public async abstract onPageEnter(): Promise<boolean>;

	public async abstract onPageLeave(): Promise<boolean>;

	public async cleanup(): Promise<boolean> {
		return true;
	}
}
