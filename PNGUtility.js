const engine = {
  /** Init methods as private */
  decode(bytesArr) {
    return __UPNG__.decode(bytesArr)
  },
  blobify(name) {
    const blob = Utilities.newBlob(new Uint8Array(this._encoded), "image/png")
    if (name) blob.setName(name.toString())
    return blob
  },
  getSize() {
    return {
      width: this._img.width,
      height: this._img.height,
      fileSize: this._encoded.length,
    }
  },
  crop(x1, x2, y1, y2) {
    if (
      typeof x1 !== "number" ||
      +x1 !== +x1 ||
      typeof x2 !== "number" ||
      +x2 !== +x2 ||
      typeof y1 !== "number" ||
      +y1 !== +y1 ||
      typeof y2 !== "number" ||
      +y2 !== +y2
    ) {
      throw new TypeError(
        "newImage.crop operation could not be performed. At least one of coordination values is not a number."
      )
    }
    if (x1 > x2 || y1 > y2) {
      throw new RangeError(
        "newImage.crop operation could not be performed. Specified values are unable to create valid shape"
      )
    }

    const size = {
      x: x2 - x1,
      y: y2 - y1,
    }

    if (size.x * size.y > this.MAX_SAFE_AREA) {
      throw new RangeError(
        "newImage.scale operation could not be performed. Expected image size was too big. You can still change max safe image area within class instance (MAX_SAFE_AREA field) but please keep in mind this will affect runtime performance and it is not supported in current lib version."
      )
    }
    const img = this._img,
      rgba = new Uint8Array(__UPNG__.toRGBA8(img)[0]),
      output = new Uint8Array(size.x * size.y * 4),
      width = this.getSize().width

    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const srcIndex = ((y + y1) * width + (x + x1)) * 4
        const dstIndex = (y * size.x + x) * 4

        output[dstIndex + 0] = rgba[srcIndex + 0]
        output[dstIndex + 1] = rgba[srcIndex + 1]
        output[dstIndex + 2] = rgba[srcIndex + 2]
        output[dstIndex + 3] = rgba[srcIndex + 3]
      }
    }

    const bytes = __UPNG__.encode([output], size.x, size.y, 0)
    this._encoded = new Uint8Array(bytes)
    this._img = engine.decode(bytes)
    this._bytesarr = [bytes]
    return this
  },
  copy() {
    return newImage(this._encoded)
  },
  scale(scale) {
    if (typeof scale !== "number" || +scale !== +scale) {
      throw new TypeError(
        "newImage.scale operation could not be performed. The parameter value is not a number"
      )
    }
    const { width: srcWidth, height: srcHeight } = this.getSize(),
      dstWidth = Math.round(srcWidth * scale),
      dstHeight = Math.round(srcHeight * scale)

    if (dstWidth * dstHeight > this.MAX_SAFE_AREA) {
      throw new RangeError(
        "newImage.scale operation could not be performed. Expected image size was too big. You can still change max safe image area within class instance (MAX_SAFE_AREA field) but please keep in mind this will affect runtime performance and it is not supported in current lib version."
      )
    }

    const dst = new Uint8Array(dstWidth * dstHeight * 4),
      src = new Uint8Array(__UPNG__.toRGBA8(this._img)[0])

    const getBIColor = (src, srcWidth, srcHeight, x, y) => {
      const x1 = Math.floor(x),
        y1 = Math.floor(y),
        x2 = Math.min(x1 + 1, srcWidth - 1),
        y2 = Math.min(y1 + 1, srcHeight - 1),
        fx = x - x1,
        fy = y - y1,
        w1 = (1 - fx) * (1 - fy),
        w2 = fx * (1 - fy),
        w3 = (1 - fx) * fy,
        w4 = fx * fy,
        i1 = (y1 * srcWidth + x1) * 4,
        i2 = (y1 * srcWidth + x2) * 4,
        i3 = (y2 * srcWidth + x1) * 4,
        i4 = (y2 * srcWidth + x2) * 4,
        r = src[i1] * w1 + src[i2] * w2 + src[i3] * w3 + src[i4] * w4,
        g =
          src[i1 + 1] * w1 +
          src[i2 + 1] * w2 +
          src[i3 + 1] * w3 +
          src[i4 + 1] * w4,
        b =
          src[i1 + 2] * w1 +
          src[i2 + 2] * w2 +
          src[i3 + 2] * w3 +
          src[i4 + 2] * w4,
        a =
          src[i1 + 3] * w1 +
          src[i2 + 3] * w2 +
          src[i3 + 3] * w3 +
          src[i4 + 3] * w4

      return [r, g, b, a].map((v) => Math.round(v))
    }

    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = x / scale,
          srcY = y / scale,
          [r, g, b, a] = getBIColor(src, srcWidth, srcHeight, srcX, srcY),
          dstIdx = (y * dstWidth + x) * 4

        dst[dstIdx] = r
        dst[dstIdx + 1] = g
        dst[dstIdx + 2] = b
        dst[dstIdx + 3] = a
      }
    }

    const encoded = __UPNG__.encode([dst], dstWidth, dstHeight, 0)

    this._encoded = new Uint8Array(encoded)
    this._img = engine.decode(encoded)
    this._bytesarr = [encoded]
    return this
  },
  tob64() {
    return Utilities.base64Encode(
      Utilities.newBlob(new Uint8Array(this._encoded), "image/png").getBytes()
    )
  },
  fromb64(b64) {
    const content = Utilities.base64Decode(b64)
    return new Image(content)
  },
  getStream() {
    return this._encoded
  }
}

class Image {
  constructor(bytes) {
    this._encoded = bytes
    this._img = engine.decode(bytes)
    this._bytesarr = [bytes]
    /**
   * Determines max proceedable image surface area in px 
   */
    this.MAX_SAFE_AREA = 36000000
  }
  /**
   * Returns image as image/png Blob type
   * @Param {string} name optional blob name
   * @returns {Blob} AppsScript engine Blob instance
   */
  toBlob(name) {
    return engine.blobify.call(this, name)
  }
  /**
   * Provides information about image (size, dimensions)
   * @returns {{width: number, height: number, fileSize: number}}
   */
  getSize() {
    return engine.getSize.call(this)
  }
  /**
   * Crops oraz stretches image canvas by specified marking sets
   * @param {number} fromX determines left border pos of cropped image (px)
   * @param {number} toX determines right border pos of cropped image (px)
   * @param {number} fromY determines top border pos of cropped image (px)
   * @param {number} toX determines bottom border pos of cropped image (px)
   *
   * @returns {Image} overriden Image class instance
   */
  crop(fromX, toX, fromY, toY) {
    return engine.crop.call(this, fromX, toX, fromY, toY)
  }
  /**
   * Resize this image to specified width and height
   * @param {number} multipl scale multiplier, decimal likely
   * @returns {Image} modified class instance
   */
  scale(multipl) {
    return engine.scale.call(this, multipl)
  }
  /**
   * Creates new Image instance based on current instance
   * 
   * @returns {Image} duplicated class instance
   */
  copy() {
    return engine.copy.call(this)
  }
  /**
   * Converts PNG to Base64 string
   * @returns {string} Base64 String
   */
  toBase64() {
    return engine.tob64.call(this)
  }
  toByteStream() {
    return engine.getStream.call(this)
  }
}

/**
 * 
 * EXPORTS
 * 
 */

/**
* Creates new PNG image utility
*    
* Sample:
* const bytes = Utilities.newBlob([...some bytes array...], 'image/png').getBytes() <br/>
* const img = PNGUtility.newImage(bytes)
* 
* @param {byte[]} bytes byte array of any image
*
* @returns {Image}
*/
function newImage(bytes) {
  return new Image(bytes)
}

/**
 * Creates new Image class instance from Base64 string
 *
 * Usage:
 * const img = ImageFromBase64(...base64Content...)
 *
 * @param {string} content Base64 string
 * @returns {Image} new Image instance
 */
function ImageFromBase64(content) {
  return engine.fromb64(content)
}
