import { from as BopsFrom } from 'bops';
import { inflate as PakoInflate } from 'pako';

const pivotedMapCode = {
  // pivoted
  "G": 1, "H": 2, "I": 3, "J": 4, "K": 5, "L": 6, "M": 7, "N": 8, "O": 9,
  "P": 10, "Q": 11, "R": 12, "S": 13, "T": 14, "U": 15, "V": 16, "W": 17,
  "X": 18, "Y": 19, "g": 20, "h": 40, "i": 60, "j": 80, "k": 100, "l": 120,
  "m": 140, "n": 160, "o": 180, "p": 200, "q": 220, "r": 240, "s": 260,
  "t": 280, "u": 300, "v": 320, "w": 340, "x": 360, "y": 380, "z": 400
};

function decode(text) {
  text = text.trim();

  if (!text.startsWith('^GFA') && !text.startsWith('A')) {
    throw new Error('Unsupported encoding')
  }

  // trim ^GF
  if (text.startsWith('^GF')) {
    text = text.substring(3);
  }

  // trim trailing '^FS'
  if (text.endsWith('^FS')) {
    text = text.substring(0, text.length - 3);
  }

  // a: compression type (A, B, C)
  let commaIndex = text.indexOf(',');
  const a = text.substring(0, commaIndex);
  text = text.substring(commaIndex + 1);

  // b: binary byte count
  commaIndex = text.indexOf(',');
  const b = text.substring(0, commaIndex);
  text = text.substring(commaIndex + 1);

  // c: graphic field count
  commaIndex = text.indexOf(',');
  const c = text.substring(0, commaIndex);
  text = text.substring(commaIndex + 1);

  // d: bytes per row
  commaIndex = text.indexOf(',');
  const d = text.substring(0, commaIndex);

  const data = text.substring(commaIndex + 1);
  let buffer = null;

  const width = d * 8;
  const height = c / d;

  if (data.startsWith(':Z64:')) {
    buffer = decodeZ64(data);
  } else {
    buffer = decodeASCII(data, c, d);
  }

  return {
    width,
    height,
    buffer,
    getPixelBit: (x, y) => {
      const byteIndex = y * (width / 8) + ~~(x / 8);
      const byte = buffer[byteIndex];
      const bit = (byte >> (7 - (x % 8))) & 0x01;
      return bit;
    }
  };
}

function decodeZ64(data) {
  // trim :Z64:
  data = data.substring(5);
  // trim trailing crc
  data = data.substring(0, data.length - 5);

  const deflatedData = BopsFrom(data, 'base64');
  const buffer = PakoInflate(deflatedData);
  return buffer;
}

function decodeASCII(data, size, lineByteCount) {
  const buffer = new Uint8Array(size);
  const lineWordCount = lineByteCount * 2;

  // inflate data from map codes
  let inflatedData = '';
  let index = 0;
  while (index < data.length) {
    let character = data[index++];

    if (pivotedMapCode[character]) {
      let code = '';
      while (pivotedMapCode[character]) {
        code += character;
        character = data[index++];
      }

      const multiplier = getMapCodeCount(code);
      inflatedData += new Array(multiplier + 1).join(character);
    } else {
      inflatedData += character;
    }
  }

  // expand shortended data rows
  let expandedData = '';
  index = 0;
  while (index < inflatedData.length) {
    let character = inflatedData[index++];
    let remainingLength = lineWordCount - (expandedData.length % lineWordCount);

    if (character == ',') {
      expandedData += new Array(remainingLength + 1).join('0');
    } else if (character == '!') {
      expandedData += new Array(remainingLength + 1).join('F');
    } else if (character == ':') {
      expandedData += expandedData.substring(expandedData.length - lineWordCount, expandedData.length);
    } else {
      expandedData += character;
    }
  }

  // convert data into buffer
  let bufferIndex = 0;
  index = 0;
  while (index < expandedData.length) {
    let character = expandedData[index++];
    let nextCharacter = expandedData[index++];
    buffer[bufferIndex++] = Number.parseInt(character + nextCharacter, 16);
  }

  return buffer;
}

function getMapCodeCount(code) {
  let value = 0;

  for (let index = 0; index < code.length; index++) {
    const multiplier = Math.pow(20, (code.length - index - 1));
    value += multiplier * pivotedMapCode[code[index]];
  }
  return value;
}

export default {
  decode,
};
