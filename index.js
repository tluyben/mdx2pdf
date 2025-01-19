import { readFile, readdir, access } from "fs/promises";
import { join, parse, dirname, resolve } from "path";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import puppeteer from "puppeteer";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Check if file exists
async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Function to handle image paths
async function processImagePaths(content, mdxFilePath) {
  const mdxDir = dirname(mdxFilePath);

  // Find all image references in markdown/HTML
  const imageRegex = /!\[.*?\]\((.*?)\)|<img.*?src=["'](.*?)["']/g;
  let match;
  let processedContent = content;
  let warnings = [];

  while ((match = imageRegex.exec(content)) !== null) {
    const imgPath = match[1] || match[2];
    if (!imgPath.startsWith("http")) {
      const absoluteImgPath = resolve(mdxDir, imgPath);
      const exists = await fileExists(absoluteImgPath);

      if (!exists) {
        warnings.push(
          `Warning: Image file not found: ${imgPath} in ${mdxFilePath}`
        );
      } else {
        // Convert image to data URL for PDF
        try {
          const imgData = await readFile(absoluteImgPath);
          const base64 = imgData.toString("base64");
          const mimeType = imgPath.endsWith(".svg")
            ? "image/svg+xml"
            : imgPath.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${base64}`;

          // Replace the original path with data URL
          processedContent = processedContent.replace(imgPath, dataUrl);
        } catch (error) {
          warnings.push(
            `Warning: Failed to process image ${imgPath} in ${mdxFilePath}: ${error.message}`
          );
        }
      }
    }
  }

  return { processedContent, warnings };
}

// Function to recursively get all MDX files in directory
async function getMdxFiles(dir, fileList = [], prefix = "") {
  const items = await readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const path = join(dir, item.name);

    if (item.isDirectory()) {
      await getMdxFiles(path, fileList, `${prefix}${item.name}/`);
    } else if (item.name.endsWith(".mdx")) {
      fileList.push({
        path,
        menuPath: `${prefix}${parse(item.name).name}`,
      });
    }
  }

  return fileList;
}

// Convert MDX to HTML
async function mdxToHtml(mdxContent, filePath) {
  try {
    // Process image paths first
    const { processedContent, warnings } = await processImagePaths(
      mdxContent,
      filePath
    );

    const { default: Content } = await evaluate(processedContent, {
      ...runtime,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeHighlight],
    });

    // Create the React element
    const element = createElement(Content);

    // Render to HTML string
    return { html: renderToString(element), warnings };
  } catch (error) {
    throw new Error(`Error processing ${filePath}: ${error.message}`);
  }
}

// Convert HTML to PDF
async function htmlToPdf(html, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
          }
          pre {
            background: #f6f8fa;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
          }
          code {
            font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          .toc-item {
            margin: 8px 0;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 2rem;
            margin-bottom: 1rem;
          }
          hr {
            margin: 2rem 0;
            border: none;
            border-top: 1px solid #e1e4e8;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  await page.setContent(fullHtml, {
    waitUntil: "networkidle0",
  });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "2cm",
      bottom: "2cm",
      left: "2cm",
      right: "2cm",
    },
  });

  await browser.close();
}

// Generate table of contents
function generateToc(files) {
  return `
    <h1>Table of Contents</h1>
    <nav>
      ${files
        .map(
          (file) => `
        <div class="toc-item" style="padding-left: ${
          (file.menuPath.match(/\//g) || []).length * 20
        }px">
          <a href="#${file.menuPath}">${file.menuPath}</a>
        </div>
      `
        )
        .join("")}
    </nav>
    <hr>
  `;
}

// Main function
async function convertMdxToPdf(inputDir) {
  try {
    console.log("Finding MDX files...");
    const files = await getMdxFiles(inputDir);

    if (files.length === 0) {
      console.error("No MDX files found in directory");
      process.exit(1);
    }

    console.log(`Found ${files.length} MDX files`);

    // Create TOC
    const toc = generateToc(files);
    let sections = [];
    let allWarnings = [];
    let failedFiles = [];

    // Convert each MDX file
    console.log("Converting MDX files to HTML...");
    for (const file of files) {
      try {
        const mdxContent = await readFile(file.path, "utf-8");
        const { html, warnings } = await mdxToHtml(mdxContent, file.path);

        sections.push(`
          <section id="${file.menuPath}">
            <h2>${file.menuPath}</h2>
            ${html}
          </section>
          <hr>
        `);

        if (warnings.length > 0) {
          allWarnings.push(...warnings);
        }
      } catch (error) {
        console.error(`\n${error.message}`);
        failedFiles.push(file.path);
        // Continue with other files instead of throwing
      }
    }

    if (allWarnings.length > 0) {
      console.log("\nWarnings:");
      allWarnings.forEach((warning) => console.log(warning));
    }

    if (failedFiles.length > 0) {
      console.log("\nFailed to process these files:");
      failedFiles.forEach((file) => console.log(` - ${file}`));

      if (failedFiles.length === files.length) {
        console.error("All files failed to process. Exiting.");
        process.exit(1);
      }

      console.log("\nContinuing with successfully processed files...");
    }

    const fullHtml = toc + sections.join("\n");

    console.log("\nGenerating PDF...");
    await htmlToPdf(fullHtml, "output.pdf");
    console.log("PDF generated successfully: output.pdf");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// CLI handling
const inputDir = process.argv[2] || ".";
convertMdxToPdf(inputDir);
