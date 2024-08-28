import { Builder, Browser, By } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

export async function download(address: URL) {
	console.log("Starting WebDriver...");

	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();
	await driver.manage().setTimeouts({ implicit: 3000 });

	console.log("Loading URL " + address.href);
	await driver.get(address.href);

	await new Promise((resolve) => setTimeout(resolve, 3000));

	await driver.manage().setTimeouts({ implicit: 3000 });

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

	const authorElement = await driver.findElements(
		By.css(".mt-author-container .mt-author-programname")
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

	console.log("Attempting to get page list...");
	const tocItems = await toc.findElements(By.css(".fancytree-node a"));

	for (const item of tocItems) {
		const contentTitle = await item.getText();
		const contentURL = await item.getAttribute("href");

		console.log(contentTitle + " - " + contentURL);
	}

	console.log(toc);

	// await driver.quit();
}
