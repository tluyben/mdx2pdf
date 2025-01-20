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
  const links = await page.evaluate((basePath) => {
    return Array.from(document.querySelectorAll("a"))
      .map(link => ({
        href: link.href,
        hash: link.hash
      }));
  }, baseUrl + docsPath);

  // Remove duplicates and filter relevant links
  const uniqueLinks = [...new Set(links.map(l => l.href))].filter(
    (link) => link.startsWith(baseUrl) && link.includes(docsPath)
  );

  // Create a mapping of URLs to their position in the document
  const pageIndexMap = new Map();
  uniqueLinks.forEach((link, index) => {
    pageIndexMap.set(link, index);
  });

  console.log(`Found ${uniqueLinks.length} unique documentation pages`);
  const pages = [await page.content()];

  for (const [index, link] of uniqueLinks.entries()) {
    console.log(`Processing page ${index + 1}/${uniqueLinks.length}: ${link}`);
    await page.goto(link, { waitUntil: "networkidle0" });
    
    // Process page content to update internal links
    const processedContent = await page.evaluate((pageData) => {
      // Add an ID to the main content
      const mainContent = document.querySelector('main') || document.body;
      mainContent.id = `page-${pageData.index}`;
      
      // Update all internal links
      document.querySelectorAll('a').forEach(link => {
        if (link.href.startsWith(pageData.baseUrl)) {
          // If it's an internal link
          const url = new URL(link.href);
          if (url.hash) {
            // If it has a hash, keep it as is - it will work in PDF
            link.href = url.hash;
          } else {
            // If it's a page link, point to the page ID
            const targetIndex = pageData.pageIndexMap[link.href];
            if (targetIndex !== undefined) {
              link.href = `#page-${targetIndex}`;
            }
          }
        }
      });
      
      return document.documentElement.outerHTML;
    }, {
      index,
      baseUrl,
      pageIndexMap: Object.fromEntries([...pageIndexMap.entries()])
    });
    
    pages.push(processedContent);
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
          /* Ensure page IDs don't affect layout */
          [id^="page-"] { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        ${pages
          .map(
            (content, index) => `
          <div class="page-content">
            ${content}
            ${index < pages.length - 1 ? '<div class="page-break"></div>' : ""}
          </div>
        `
          )
          .join("")}
      </body>
    </html>
  `;

  console.log("Setting combined content...");
  await page.setContent(combinedHtml, { waitUntil: "networkidle0" });

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
