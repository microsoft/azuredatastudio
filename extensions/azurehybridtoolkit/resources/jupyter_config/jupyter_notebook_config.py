# Disable CSP in order to load Jupyter inside Azure Data Studio
c.NotebookApp.tornado_settings = {
	'headers': {'Content-Security-Policy': ''}
}

c.NotebookApp.open_browser = False
