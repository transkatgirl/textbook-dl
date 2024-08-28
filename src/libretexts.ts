import { Builder, Browser, By } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

export async function download(address: URL) {
	if (
		!(
			address.pathname.startsWith("/Courses/") ||
			address.pathname.startsWith("/Bookshelves/")
		)
	) {
		throw "Invalid URL!";
	}

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

	console.log("\nWaiting 5 seconds for page to load...");
	await new Promise((resolve) => setTimeout(resolve, 5000));

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
	const bookTitle = await titleElement.getAttribute("innerText");

	const authorElement = await driver.findElements(
		By.css(".mt-author-container .mt-author-programname")
	);
	if (authorElement.length != 1) {
		throw "URL must be to the book's root!";
	}
	const bookAuthor = await authorElement[0].getAttribute("innerText");

	console.log(bookTitle + " by " + bookAuthor + " - " + address);

	// await driver.quit();
}
