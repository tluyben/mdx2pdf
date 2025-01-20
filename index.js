#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { createProcessor } from "@mdx-js/mdx";
import puppeteer from "puppeteer";
import glob from "glob-promise";

async function getMDXContent(sourceDir, filePath) {
  const source = await fs.readFile(path.join(sourceDir, filePath), "utf-8");

  try {
    // Create MDX processor with minimal transformations
    const processor = await createProcessor({
      jsx: true,
      remarkPlugins: [],
      rehypePlugins: [],
    });

    // Process MDX to JSX
    const result = await processor.process(source);

    return {
      raw: source,
      jsx: String(result),
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return { raw: "", jsx: "" };
  }
}

async function convertDirectoryToPdf(sourceDir) {
  const mdxFiles = await glob("**/*.mdx", { cwd: sourceDir });
  mdxFiles.sort();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.addStyleTag({
    content: `
      body {
        font-family: 'SF Mono', Menlo, monospace;
        line-height: 1.6;
        padding: 20px;
        font-size: 14px;
      }
      .mdx-content {
        white-space: pre-wrap;
        background: #f8f8f8;
        padding: 20px;
        border-radius: 5px;
        border: 1px solid #ddd;
      }
      .file-path {
        color: #666;
        font-size: 0.9em;
        margin-bottom: 10px;
      }
      h1 { 
        page-break-before: always;
        font-size: 24px;
        margin-bottom: 20px;
      }
      code {
        background: #f0f0f0;
        padding: 2px 4px;
        border-radius: 3px;
      }
      pre {
        background: #f4f4f4;
        padding: 15px;
        border-radius: 5px;
      }
    `,
  });

  let combinedHtml = '<div id="content">';

  for (const mdxPath of mdxFiles) {
    try {
      console.log(`Processing ${mdxPath}...`);
      const { raw } = await getMDXContent(sourceDir, mdxPath);

      combinedHtml += `
        <h1>${mdxPath}</h1>
        <div class="file-path">Path: ${mdxPath}</div>
        <div class="mdx-content">${raw
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</div>
      `;
    } catch (error) {
      console.error(`Error processing ${mdxPath}:`, error);
    }
  }

  combinedHtml += "</div>";

  await page.setContent(combinedHtml);
  await page.waitForSelector("#content");

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

  console.log("Generated output.pdf");
  await browser.close();
}

const rootPath = process.argv[2];

if (!rootPath) {
  console.error("Please provide a root path");
  process.exit(1);
}

const absolutePath = path.resolve(rootPath);

try {
  await fs.access(absolutePath);
} catch {
  console.error("Provided path does not exist");
  process.exit(1);
}

console.log(`Processing MDX files in ${absolutePath}...`);
convertDirectoryToPdf(absolutePath).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
