#!/usr/bin/env node
import playwright from "playwright";
import fs from "fs/promises";
import { URL } from "url";

async function generatePDF(startUrl) {
  console.log(`Starting PDF generation from: ${startUrl}`);

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({
    width: 1200,
    height: 800,
  });

  // Get base URL for filtering
  const baseUrl = new URL(startUrl).origin;
  const docsPath = new URL(startUrl).pathname;

  console.log("Navigating to start page...");
  await page.goto(startUrl, {
    waitUntil: "networkidle0",
  });

  console.log("Collecting doc links...");
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a"))
      .map((link) => link.href)
      .filter((href) => href.includes("/docs/") && !href.includes("#"));
  });

  // Remove duplicates
  const uniqueLinks = [...new Set(links)].filter(
    (link) => link.startsWith(baseUrl) && link.includes(docsPath)
  );

  console.log(`Found ${uniqueLinks.length} unique documentation pages`);
  const pages = [await page.content()];

  for (const [index, link] of uniqueLinks.entries()) {
    console.log(`Processing page ${index + 1}/${uniqueLinks.length}: ${link}`);
    await page.goto(link, { waitUntil: "networkidle0" });
    pages.push(await page.content());
  }

  console.log("Combining content...");
  const combinedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .page-break { page-break-after: always; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${pages.map((content, index) => `
          <div class="page-content">
            ${content}
            ${index < pages.length - 1 ? '<div class="page-break"></div>' : ''}
          </div>
        `).join('')}
      </body>
    </html>
  `;

  console.log("Setting combined content...");
  await page.setContent(combinedHtml, { waitUntil: 'networkidle0' });

  console.log("Generating PDF...");
  await page.pdf({
    path: "output.pdf",
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      right: "20mm",
      bottom: "20mm",
      left: "20mm",
    },
  });

  await browser.close();
  console.log("PDF generation complete: output.pdf");
}

// Get URL from command line argument
const url = process.argv[2];

if (!url) {
  console.error("Please provide a URL as argument");
  console.error("Usage: node script.js https://example.com/docs/");
  process.exit(1);
}

// Validate URL
try {
  new URL(url);
} catch {
  console.error("Invalid URL provided");
  process.exit(1);
}

generatePDF(url).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
