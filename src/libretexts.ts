import { Builder, Browser } from "selenium-webdriver";

export async function download(address: URL) {
	const driver = await new Builder().forBrowser(Browser.CHROME).build();

	await driver.get(address.href);
}
