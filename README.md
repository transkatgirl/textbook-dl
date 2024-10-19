# textbook-dl

A tool for downloading open-access textbooks in EPUB format.

## Note to Publishers

Please just offer your books in EPUB format. I shouldn't have to do this.

## Usage

Note: You must have Google Chrome installed to run this tool.

```bash
npm install
npm run start [book url]
```

### Supported URLs

- openstax.org/books/\* (OpenStax online textbook viewer)
- \*.libretexts.org/\[Bookshelves,Courses\]/* (LibreTexts Libraries)
	- Note: The LibreTexts downloader is a work in progress and may fail with some textbooks.

#### Coming Soon

The below sites are not yet supported, but support for them may be implemented in the future:

- CK-12
- Wikibooks