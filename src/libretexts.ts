import { Builder, Browser, By, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { JSDOM } from "jsdom";
import { RawNavItem, RawTextbookMetadata } from "./builder";
import path from "path";

// Note: Libretexts CSS is (mostly) from https://a.mtstatic.com/@cache/layout/anonymous.css?_=93f1867715eb41aa364510e35ff484b2_bWF0aC5saWJyZXRleHRzLm9yZw==:site_4425 (last retrieved on Oct 8 2024)

// TODO: Modify CSS to embed custom icon font + add margin

export async function download(address: URL) {
	console.log("Starting WebDriver...");

	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();

	console.log("Loading URL " + address.href);
	await driver.get(address.href);

	await initPage(driver);

	console.log("Attempting to find book title...");
	const activeBreadcrumb = await driver.findElements(
		By.css(
			".mt-breadcrumbs .mt-breadcrumbs-current-page .mt-icon-article-category"
		)
	);
	if (activeBreadcrumb.length == 0) {
		throw "URL must be to the book's root!";
	}

	const titleElement = await driver.findElement(
		By.css("#elm-main-content #title")
	);
	const bookTitle = await titleElement.getText();
	const bookAddress = address;

	const authorElement = await driver.findElements(
		By.css(
			".mt-author-container .mt-author-programname, .mt-author-container .mt-author-companyname"
		)
	);
	if (authorElement.length != 1) {
		throw "URL must be to the book's root!";
	}
	const bookAuthor = await authorElement[0].getText();

	console.log(bookTitle + " by " + bookAuthor + " - " + address);

	console.log("Attempting to find table of contents...");
	const contentsButton = await driver.findElement(
		By.css('#sbHeader button[title="Open contents panel"]')
	);
	await contentsButton.click();

	await new Promise((resolve) => setTimeout(resolve, 3000));

	const toc = await driver.findElement(
		By.css("#LibreTextsSidebar .toc-hierarchy > ul.ui-fancytree")
	);

	for (let i = 0; i < 4; i++) {
		console.log(
			"Attempting to expand table of contents (iteration " + (i + 1) + ")..."
		);

		const items = await toc.findElements(
			By.css(
				'.fancytree-has-children:not(.fancytree-expanded) > [role="button"].fancytree-expander'
			)
		);

		for (const item of items) {
			if (await item.isDisplayed()) {
				await item.click();
				await driver.executeScript("arguments[0].scrollIntoView(true);", item);

				await new Promise((resolve) => setTimeout(resolve, 3000));
			}
		}
	}

	const tocHTML = await toc.getAttribute("innerHTML");

	console.log("Parsing table of contents...");

	const dom = new JSDOM(
		'<!DOCTYPE html><body><ul id="toc-root">' + tocHTML + "</ul></body>"
	);
	const document = dom.window.document;

	const tocRoot = document.getElementById("toc-root");

	if (!tocRoot) {
		return;
	}

	const nav = parseToc(tocRoot);

	const meta: RawTextbookMetadata = {
		title: bookTitle,
		creators: [bookAuthor],
		lang: "en",
		url: new URL(bookAddress),
	};

	const pages = await downloadPages(driver, meta, nav).then(
		(pages) => new Map(pages)
	);

	await driver.quit();

	const stylesheet = path.resolve(__dirname, "../src/libretexts.css");

	if (pages) {
		return {
			meta,
			nav,
			pages,
			stylesheet,
		};
	}
}

async function initPage(driver: WebDriver) {
	console.log("\nWaiting 6 seconds for page to load...");
	await new Promise((resolve) => setTimeout(resolve, 6000));

	await driver.manage().setTimeouts({ implicit: 3000 });
}

function parseToc(root: HTMLElement) {
	const items: RawNavItem[] = [];

	for (const element of root.children) {
		if (element.tagName == "LI") {
			const item = handleListingItem(element as HTMLLIElement);

			if (item) {
				items.push(item);
			}
		}
	}

	return items;
}

function handleListingItem(element: HTMLLIElement): RawNavItem | void {
	const span = element.querySelector("span");

	if (span && span.classList.contains("fancytree-node")) {
		const title = element.querySelector(".fancytree-title");

		if (title && title.textContent) {
			const label = title.textContent;

			const anchor = title.querySelector("a");

			let url;

			if (anchor) {
				url = new URL(anchor.href);
			}

			const subitems: RawNavItem[] = [];

			if (span.classList.contains("fancytree-has-children")) {
				const list = element.querySelector("ul");

				if (list) {
					for (const childElement of list.children) {
						if (childElement.tagName == "LI") {
							const subitem = handleListingItem(childElement as HTMLLIElement);

							if (subitem) {
								subitems.push(subitem);
							}
						}
					}
				}
			}

			return {
				label,
				url,
				subitems,
			};
		}
	}
}

async function downloadPages(
	driver: WebDriver,
	meta: RawTextbookMetadata,
	nav: RawNavItem[]
): Promise<[string, string][]> {
	const downloaded: [string, string][] = [];

	for (let i = 0; i < nav.length; i++) {
		const item = nav[i];

		if (item.url) {
			const filename = path.basename(item.url.pathname);

			const download = await downloadPage(driver, item.url);

			if (download) {
				downloaded.push([filename, download]);
			}
			nav[i].filename = filename;
		}
		if (item.subitems.length > 0) {
			const subitemDownload = await downloadPages(driver, meta, item.subitems);

			for (const download of subitemDownload) {
				downloaded.push(download);
			}
		}
	}

	return downloaded;
}

async function downloadPage(
	driver: WebDriver,
	address: URL
): Promise<string | void> {
	console.log("\nLoading URL " + address.href);
	await driver.get(address.href);

	await initPage(driver);

	console.log("Attempting to get page content...");
	const main = await driver.findElement(By.id("elm-main-content"));

	const content = await main.getAttribute("innerHTML");

	console.log("Parsing content...");

	const dom = new JSDOM(
		'<!DOCTYPE html><body><div id="main-content">' + content + "</div></body>",
		{
			url: address.href,
		}
	);
	const document = dom.window.document;

	// TODO:
	// - Download images
	// - Remove: header ol[data-ga-action='Page actions']
	// - Remove: .mt-author-container
	// - Remove: <script>

	console.log("Archived " + address.href);

	return document.body.innerHTML;
}
