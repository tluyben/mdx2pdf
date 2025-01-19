# MDX2PDF 📚➡️📄

Convert your MDX documentation into beautiful PDFs with automatic table of contents based on directory structure!

## 🚀 Features

- 📁 Recursively processes entire directory structures
- 📑 Generates automatic table of contents
- 🖼️ Handles images and assets (SVG, PNG, JPEG)
- 🎨 Syntax highlighting for code blocks
- 🔗 Preserves relative links
- 💅 Clean, professional styling
- ⚠️ Comprehensive error reporting
- 🛠️ Continues processing even if some files fail

## 🏗️ Installation

```bash
# Create a new directory
mkdir mdx2pdf && cd mdx2pdf

# Initialize package
npm init -y

# Install dependencies
npm install @mdx-js/mdx react react-dom puppeteer remark-gfm rehype-highlight

# Make the script executable
chmod +x index.js

# Optional: make globally available
npm link
```

## 📖 Usage

Basic usage:

```bash
mdx2pdf /path/to/your/docs
```

The script will:

1. 🔍 Find all MDX files in the directory
2. 📝 Process each file
3. 🖼️ Embed images and assets
4. 📊 Generate table of contents
5. 📄 Create a single PDF file

### 📁 Directory Structure Example

```
example/
├── getting-started/
│   ├── installation.mdx
│   └── quick-start.mdx
└── introduction.mdx
```

### 🖼️ Asset Handling

Images can be referenced using relative paths:

```markdown
![Diagram](../assets/diagram.svg)
```

Or using HTML:

```html
<img src="../assets/screenshot.png" alt="Screenshot" />
```

## 🛠️ Internal Architecture

The conversion process happens in several stages:

1. 📁 **File Discovery**

   - Recursively walks directory structure
   - Builds file list with paths and menu structure

2. 🔄 **MDX Processing**

   - Converts MDX to React components
   - Handles GitHub Flavored Markdown
   - Processes code blocks with syntax highlighting

3. 🖼️ **Asset Processing**

   - Resolves relative paths
   - Converts images to data URLs
   - Validates asset existence
   - Handles SVG/PNG/JPEG formats

4. 📑 **Table of Contents**

   - Generates based on directory structure
   - Creates internal links
   - Preserves hierarchy

5. 📄 **PDF Generation**
   - Uses Puppeteer for conversion
   - Applies consistent styling
   - Handles page breaks
   - Embeds all assets

## ⚠️ Error Handling

The script provides detailed feedback:

- Missing asset warnings
- Syntax error locations
- Failed file reports
- Processing summaries

It will:

- Continue processing even if some files fail
- Show warnings for missing assets
- Provide detailed error messages
- Generate PDF with successfully processed files

## 🎨 Styling

The generated PDF includes:

- 📝 Clean typography
- 🎨 Code syntax highlighting
- 📏 Consistent margins and spacing
- 📱 Responsive image sizing
- 🔤 Professional font choices

## 🤝 Contributing

Contributions are welcome! Some areas that could use improvement:

- 📚 More documentation formats support
- 🎨 Additional styling options
- 🔧 Configuration file support
- 📊 Custom table of contents formatting
- 🖨️ PDF output options

## 📄 License

MIT License - feel free to use in your own projects!
