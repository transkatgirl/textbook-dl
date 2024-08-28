import { Builder, Browser } from "selenium-webdriver";
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

	// await driver.quit();
}
