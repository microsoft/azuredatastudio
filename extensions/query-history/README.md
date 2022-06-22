# Query History *(preview)*

Adds a Query History view for viewing and running past executed queries.

### How do I view the history?

Query History is initially as a tab in the tab panel, which is toggled by the **View: Toggle Panel** or **Query History: Focus on Query History View** commands.

![Query History tab](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/query-history/images/QueryHistoryTab.PNG)

This view can be moved similar to other views into other view containers by dragging and dropping into the desired view container.

Initially this view will be empty but once you execute a query editor that will be captured in the window - with a separate row displayed for every query executed.

![Query History tab with queries](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/query-history/images/QueryHistoryTabWithQueries.PNG)

Each row consists of 4 parts :
- Status icon : This will be a ✔️ if the query executed successfully. If any errors occurred a ❌ is shown.
- Query Text : This is the text of the query that was executed
- Connection Info : The Server and Database the query was executed against
- Timestamp : The date and time the query was executed

### Disabling/Enabling Query History

Query History capture can be enabled/disabled in one of two ways :

1. Through the action button on the view container - this will be a ⏸️ when capture is enabled and clicking it will disable capture until re-enabled. When capture is disabled this button will be a ▶ and clicking it will enable capture until disabled.
2. By running the **Query History: Pause Query History Capture** or **Query History: Start Query History Capture** commands from the command palette.
### Query History row actions

Right clicking on a history row will bring up a menu with a number of actions available.

![Query History action menu](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/query-history/images/QueryHistoryActionMenu.PNG)

#### Open Query

This will open a new query editor window populated with the query text from the query executed and using the connection of that query.

#### Run Query

This will do the same thing as Open Query but will additionally run the statement immediately.

#### Delete

This will permanently delete the selected history row.

#### Clear All History

This will permanently delete **ALL** history rows.

This action is also available from the command palette (**Query History: Clear All History**) and as an action button on the panel.

### Data Storage

Currently all information is stored in-memory and not persisted upon application exit. There is no limit to the number of entries stored, new entries will be continuously added as long as capture is enabled unless entries are deleted or the entire history is cleared.

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
