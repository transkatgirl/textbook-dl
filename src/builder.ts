import { cp, mkdir, writeFile } from "fs/promises";
import { JSDOM } from "jsdom";
import path from "path";
import { v7 as uuidv7 } from "uuid";

export interface RawTextbook {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
	pages: Map<string, string>;
	stylesheet?: string;
}

export interface RawTextbookMetadata {
	title: string;
	author: string;
	lang: string;
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

	await writeFile(
		path.join(root, "nav.xhtml"),
		buildNav(input.meta.lang, input.nav)
	);
	await writeFile(path.join(root, "content.opf"), buildPackage(input));

	const reservedRoot = path.join(root, "META-INF");
	await mkdir(reservedRoot);

	await writeFile(
		path.join(reservedRoot, "container.xml"),
		'<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
	);

	const mediaRoot = path.join(root, "media");
	await mkdir(mediaRoot);

	for (const [filename, contents] of input.pages.entries()) {
		console.log("\nParsing " + filename + "...");

		const dom = new JSDOM("<!DOCTYPE html><body>" + contents + "</body>");
		const document = dom.window.document;
		const XMLSerializer = dom.window.XMLSerializer;

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

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		console.log("Serializing page...");

		const serialized = new XMLSerializer().serializeToString(document);
		await writeFile(path.join(root, filename), serialized);
	}
}

function buildPackage(input: RawTextbook): string {
	const dom = new JSDOM(
		'<?xml version="1.0" encoding="utf-8"?><package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"></metadata><manifest></manifest><spine></spine></package>',
		{ contentType: "text/xml" }
	);
	const document = dom.window.document;
	const XMLSerializer = dom.window.XMLSerializer;

	const identifier = uuidv7();

	// TODO

	return new XMLSerializer().serializeToString(document);
}

function buildNav(lang: string, nav: RawNavItem[]): string {
	const dom = new JSDOM(
		'<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="' +
			lang +
			'" xml:lang="' +
			lang +
			'"><head><title>Book Navigation</title><meta charset="utf-8" /></head><body epub:type="frontmatter"><nav epub:type="toc" id="toc" role="doc-toc"><h1>Table of Contents</h1></nav><nav epub:type="landmarks" id="landmarks" hidden=""><h2>Landmarks</h2><ol><li><a epub:type="toc" href="#toc">Table of Contents</a></li></ol></nav></html>',
		{ contentType: "application/xhtml+xml" }
	);
	const document = dom.window.document;

	const toc = document.getElementById("toc");
	toc?.appendChild(buildNavList(document, nav));

	return new XMLSerializer().serializeToString(document);
}

function buildNavList(document: Document, nav: RawNavItem[]): HTMLOListElement {
	const root = document.createElement("ol");

	for (const item of nav) {
		const listItem = document.createElement("li");

		if (item.filename) {
			const anchor = document.createElement("a");
			anchor.href = item.filename;
			anchor.innerText = item.label;
			listItem.appendChild(anchor);
		} else {
			const span = document.createElement("span");
			span.innerText = item.label;
			listItem.appendChild(span);
		}

		if (item.subitems.length > 0) {
			listItem.appendChild(buildNavList(document, item.subitems));
		}

		root.appendChild(listItem);
	}

	return root;
}
