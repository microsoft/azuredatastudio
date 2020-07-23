# Query History *(preview)*

Adds a Query History panel for viewing and running past executed queries.

### How do I view the history?

Query History is displayed as a tab in the tab panel, which is toggled by the **View: Toggle Panel** command.

![Query History tab](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/query-history/images/QueryHistoryTab.PNG)

Initially this view will be empty but once you execute a query editor that will be captured in the window - with a separate row displayed for every query executed.

![Query History tab with queries](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/query-history/images/QueryHistoryTabWithQueries.PNG)

Each row consists of 4 parts :
- Status icon : This will be a ✔️ if the query executed successfully. If any errors occurred a ❌ is shown.
- Query Text : This is the text of the query that was executed
- Connection Info : The Server and Database the query was executed against
- Timestamp : The date and time the query was executed

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

#### Pause/Start Query History Capture

This will Pause or Start Query History Capture. While paused no data will be stored for queries run.

This action is also available from the command palette (**Query History: Toggle Query History Capture**) and as an action button
on the panel.

### Data Storage

Currently all information is stored in-memory and not persisted upon application exit.

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
