import * as TypeMoq from 'typemoq';

import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { TestInstantiationService } from 'sql/platform/instantiation/test/common/instantiationServiceMock';
import { MarkdownToolbarComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/markdownToolbar.component';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';


suite('markdownToolbar Component', function (): void {
	setup(() => {
		const instantiationService: TestInstantiationService = new TestInstantiationService();
		instantiationService.set(INotificationService, new TestNotificationService());
		instantiationService.set(INotebookService, new NotebookServiceStub());
		instantiationService.set(IContextMenuService, TypeMoq.Mock.ofType(ContextMenuService).object);
		instantiationService.set(IConfigurationService, new TestConfigurationService);
	});

	test('Should return selected link properly', async function (): Promise<void> {
		// let markdownToolbar = new MarkdownToolbarComponent();

	});
});
