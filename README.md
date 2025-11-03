# BOOTH Orders - Download All

A Tampermonkey userscript that adds a "Download All" button to BOOTH.pm order pages, allowing you to download all purchased files as a single ZIP archive.

## Features

**One-Click Download** - Download all files from a BOOTH order with a single click  
**Automatic ZIP Creation** - All files are packaged into a single ZIP file named after the product  
**Parallel Downloads** - Downloads multiple files simultaneously for maximum speed  
**Unicode Support** - Properly handles Japanese filenames and special characters  
**Multiple File Types** - Supports all file types (ZIP, MP4, images, etc.)  
**Modern & Fast** - Uses `fflate` library for fast, reliable ZIP generation  

## Installation

1. **Install Tampermonkey Extension**
   - [Chrome/Edge/Brave](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

2. **Install the Userscript**
   - Click here to install: [booth-download-all.user.js](https://github.com/DjShinter/BoothDL/raw/main/booth-download-all.user.js)
   - Or copy the script contents and create a new script in Tampermonkey

3. **Grant Permissions**
   - When prompted, click "Always allow" for cross-origin requests to `booth.pm`

## Usage

1. Go to your BOOTH orders page: `https://accounts.booth.pm/orders/`
2. Click on any order to view the order details
3. You'll see a new "Download All" button appear above the file list
4. Click "Download All" to:
   - Download all files in parallel
   - Create a ZIP archive with all files
   - Save the ZIP with the product name

### Example

```
Order Page: https://accounts.booth.pm/orders/12345678

Files:
├── file1.zip (50 MB)
├── file2.zip (120 MB)
└── video.mp4 (200 MB)

Result: 【Product Name】.zip (370 MB)
```

## Screenshots

![Download All Button](https://github.com/DjShinter/BoothDL/blob/main/BoothDL.png?raw=true)

*The "Download All" button appears seamlessly integrated with BOOTH's native interface*

## Technical Details

- **Fast ZIP Library**: Uses [fflate](https://github.com/101arrowz/fflate) instead of outdated JSZip
- **No Compression**: Files are stored without compression for instant ZIP creation
- **Parallel Downloads**: All files download simultaneously using `GM_xmlhttpRequest`
- **Proper Encoding**: Handles URL-encoded filenames and UTF-8 characters correctly
- **No Timeouts**: Large files can download without artificial time limits

## Compatibility

- ✅ Chrome/Chromium
- ✅ Firefox
- ~ Edge (have not tested)
- ~ Opera GX (have not tested)

## Troubleshooting

**Button doesn't appear?**
- Make sure you're on an order detail page (not the order list)
- Refresh the page
- Check that Tampermonkey is enabled

**Download fails?**
- Check your browser's download permissions
- Ensure you have enough disk space
- Try downloading files individually if the ZIP is too large


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for the BOOTH.pm community
- Uses [fflate](https://github.com/101arrowz/fflate) for ZIP compression
- Inspired by the need for batch downloads on digital marketplaces

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/DjShinter/BoothDL/issues).

---

⭐ If you find this userscript helpful, please consider giving it a star!

