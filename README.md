# PNGUtility
Simple class improving your work with PNG images within AppsScript environment

## Review
**PNGUtility** provides `Image` class - it’s simple but improves your work with PNG images within AppsScript environment.
It’s way faster than workaround with SlidesApp interface.

Implements:
* UPNG.js – https://github.com/photopea/UPNG.js/blob/master/UPNG.js – Copyright (c) 2017 Photopea [MIT]
* pako.js – https://github.com/nodeca/pako – (c) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn [MIT]

The Image class provides following operations:
* `crop` - Image canvas cropping and stretching
* `scale` - Image scaling (with bilinear interpolation)
* `toBase64`/`ImageFromBase64` To/From Base64 conversion
* `toCellImg` - To CellImage conversion (Sheets)

and others...

## Installation
Install as AppsScript library using following ID:
`1uo7WeG0VaP4nzmgw_JfCs-GwkDsxfVbOyG3DhzP9HIaSE9i-h1u0M90A`

## Sample
```js
function demo() {
  const png = UrlFetchApp
    .fetch("https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/1200px-Google_2015_logo.svg.png")
    .getAs("image/png")
    .getBytes() //just Google logo

  const klass = PNGUtility.newImage(png)

  const clipping = klass.crop(0, 740, 0, 320).scale(0.3) // some manipulations...

  DriveApp.createFile(clipping.toBlob('Goo')) // Google became small Goo immediately

  //Cell Image? Why not
  let cimg
  cimg = SpreadsheetApp.newCellImage()
  cimg.setSourceUrl(
    "data:image/png;base64," +
    Utilities.base64Encode(klass.toByteStream())
  )
  SpreadsheetApp.getActiveSpreadsheet().getRange('a1').setValue(cimg.build())
}
```
