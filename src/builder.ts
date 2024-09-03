import { cp, mkdir, writeFile } from "fs/promises";
import { JSDOM } from "jsdom";
import path from "path";

export interface RawTextbook {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
	pages: Map<string, string>;
	stylesheet?: string;
}

export interface RawTextbookMetadata {
	title: string;
	author: string;
	url: URL;
}

export interface RawNavItem {
	label: string;
	url?: URL;
	filename?: string;
	subitems: RawNavItem[];
}

export async function buildTextbook(input: RawTextbook) {
	console.log("\nBuilding textbook...");

	const root = path.join(process.cwd(), "output");
	await mkdir(root);

	if (input.stylesheet) {
		cp(input.stylesheet, path.join(root, "styles.css"));
	}

	const mediaRoot = path.join(root, "media");
	await mkdir(mediaRoot);

	for (const [filename, contents] of input.pages.entries()) {
		console.log("\nParsing " + filename + "...");

		const dom = new JSDOM("<!DOCTYPE html><body>" + contents + "</body>");
		const document = dom.window.document;

		if (input.stylesheet) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = "styles.css";

			document.head.appendChild(link);
		}

		for (const image of document.getElementsByTagName("img")) {
			const src = new URL(image.src);
			const filename = path.basename(src.pathname);
			const output = path.join(mediaRoot, filename);

			console.log("Downloading " + src);

			const response = await fetch(src);
			if (response.ok) {
				const body = await response.arrayBuffer();

				await writeFile(output, new DataView(body));
				image.src = "media/" + filename;
			} else {
				throw "Received status code " + response.status;
			}
		}

		const XMLSerializer = dom.window.XMLSerializer;

		console.log("Serializing page...");

		const serialized = new XMLSerializer().serializeToString(document);

		await writeFile(path.join(root, filename), serialized);
	}
}
