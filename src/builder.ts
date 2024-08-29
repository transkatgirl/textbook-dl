export interface RawTextbookIndex {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
}

export interface RawTextbookMetadata {
	title: string;
	author: string;
	url: string;
}

export interface RawNavItem {
	label: string;
	href?: string;
	subitems: RawNavItem[];
}

export function buildTextbook(
	input: RawTextbookIndex,
	pages: Map<string, string>
) {}
