try:
	import notebook.notebookapp
	notebook.notebookapp.main()
except ImportError:
	import notebook.app
	notebook.app.main()
