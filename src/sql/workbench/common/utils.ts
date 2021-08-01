function truncate(str: string, maxLength: number): string {
	return str.length > maxLength ? str.substr(0, maxLength) + '...' : str;
}
