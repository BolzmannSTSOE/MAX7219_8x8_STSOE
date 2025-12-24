/**
* MakeCode editor extension for single or multiple MAX7219 8x8 matrix LED modules
* by Alan Wang https://github.com/alankrantas/pxt-MAX7219_8x8
* changed for Calliope mini by r00b1nh00d
* deutsche Umlaute und Imageblock by M. Klein 2021
*/

//% weight=100 color=#006d19 icon="\uf00a" block="MAX7219 8x8"
//% groups=['1. Setup', '2. Display text on matrixs', '3. Basic light control', '4. Set custom LED pattern on matrixs']
namespace max7219_matrix {

//Registers (command) for MAX7219
const _NOOP = 0 // no-op (do nothing, doesn't change current status)
const _DIGIT = [1, 2, 3, 4, 5, 6, 7, 8] // digit (LED column)
const _DECODEMODE = 9 // decode mode (1=on, 0-off; for 7-segment display on MAX7219, no usage here)
const _INTENSITY = 10 // intensity (LED brightness level, 0-15)
const _SCANLIMIT = 11 // scan limit (number of scanned digits)
const _SHUTDOWN = 12 // turn on (1) or off (0)
const _DISPLAYTEST = 15 // force all LEDs light up, no usage here
let _pinCS = DigitalPin.C16 // LOAD pin, 0=ready to receive command, 1=command take effect
let _matrixNum = 1 // number of MAX7219 matrix linked in the chain
let _displayArray: number[] = [] // display array to show accross all matrixs
let _rotation = 0 // rotate matrixs display for 4-in-1 modules
let _reversed = false // reverse matrixs display order for 4-in-1 modules
let customFontData: number[][] = [] // The array that will contain custom characters, is the user defines some

/**
   * Setup/reset MAX7219s. If you are using 4-in-1 module you'll need to set rotation as true. If your chain are consisted of single modules set it as false (default).
   */
//% block="Setup MAX7219:|Number of matrixs $num|CS(LOAD) = $cs|MOSI(DIN) = $mosi|MISO(not used) = $miso|SCK(CLK) = $sck"
//% num.min=1 num.defl=1 cs.defl=DigitalPin.C16 mosi.defl=DigitalPin.C17 miso.defl=DigitalPin.P1 sck.defl=DigitalPin.P0 rotate.defl=false group="1. Setup"
export function setup(num: number, cs: DigitalPin, mosi: DigitalPin, miso: DigitalPin, sck: DigitalPin) {
// set internal variables        
_pinCS = cs
_matrixNum = num
// prepare display array (for displaying texts; add extra 8 columns at each side as buffers)
if (_displayArray.length < (num+2)*8) {
for (let i = _displayArray.length; i < (num + 2) * 8; i++)  _displayArray.push(0)
}

pins.digitalWritePin(_pinCS, 1)
basic.pause(1)

// set micro:bit SPI
pins.spiPins(mosi, miso, sck)
pins.spiFormat(8, 3)
// pins.spiFormat(8, 0)
pins.spiFrequency(1000000)
// initialize MAX7219s
_registerAll(_SHUTDOWN, 0) // turn off
_registerAll(_DISPLAYTEST, 0) // test mode off
_registerAll(_DECODEMODE, 0) // decode mode off
_registerAll(_SCANLIMIT, 7) // set scan limit to 7 (column 0-7)
_registerAll(_INTENSITY, 15) // set brightness to 15
_registerAll(_SHUTDOWN, 1) // turn on
clearAll() // clear screen on all MAX7219s
}

/**
   * Rotation/reverse order options for 4-in-1 MAX7219 modules
   */
//% block="Rotate matrix display $rotation|Reverse printing order $reversed" rotation.defl=rotation_direction.none group="1. Setup" blockExternalInputs=true advanced=true
export function for_4_in_1_modules(rotation: rotation_direction, reversed: boolean) {
_rotation = rotation
_reversed = reversed
}

/**
   * (internal function) write command and data to all MAX7219s
   */
function _registerAll(addressCode: number, data: number) {
pins.digitalWritePin(_pinCS, 0) // LOAD=LOW, start to receive commands
for (let i = 0; i < _matrixNum; i++) {
// when a MAX7219 received a new command/data set
// the previous one would be pushed to the next matrix along the chain via DOUT
pins.spiWrite(addressCode) // command (8 bits)
pins.spiWrite(data) //data (8 bits)
}
pins.digitalWritePin(_pinCS, 1) // LOAD=HIGH, commands take effect
}

/**
   * (internal function) write command and data to a specific MAX7219 (index 0=farthest on the chain)
   */
function _registerForOne(addressCode: number, data: number, matrixIndex: number) {
if (matrixIndex <= _matrixNum - 1) {
pins.digitalWritePin(_pinCS, 0) // LOAD=LOW, start to receive commands
for (let i = 0; i < _matrixNum; i++) {
// when a MAX7219 received a new command/data set
// the previous one would be pushed to the next matrix along the chain via DOUT
if (i == matrixIndex) { // send change to target
pins.spiWrite(addressCode) // command (8 bits)
pins.spiWrite(data) //data (8 bits)
} else { // do nothing to non-targets
pins.spiWrite(_NOOP)
pins.spiWrite(0)
}
}
pins.digitalWritePin(_pinCS, 1) // LOAD=HIGH, commands take effect
}
}

/**
   * (internal function) rotate matrix
   */
function _rotateMatrix(matrix: number[][]): number[][] {
if (_rotation == rotation_direction.none) return matrix
let m = getEmptyMatrix()
for (let i = 0; i < 4; i++) {
for (let j = 0; j < 4; j++) {
if (_rotation == rotation_direction.clockwise) { // clockwise
m[i][j] = matrix[j][7 - i]
m[j][7 - i] = matrix[7 - i][7 - j]
m[7 - i][7 - j] = matrix[7 - j][i]
m[7 - j][i] = matrix[i][j]
} else if (_rotation == rotation_direction.counterclockwise) { // counter-clockwise
m[i][j] = matrix[7 - j][i]
m[7 - j][i] = matrix[7 - i][7 - j]
m[7 - i][7 - j] = matrix[j][7 - i]
m[j][7 - i] = matrix[i][j]
} else if (_rotation == rotation_direction.one_eighty_degree) { // 180 degree
m[i][j] = matrix[7 - i][7 - j]
m[7 - i][7 - j] = matrix[i][j]
m[7 - j][i] = matrix[j][7 - i]
m[j][7 - i] = matrix[7 - j][i]
}
}
}
return m
}


/**
   * Return a empty 8x8 number matrix variable
   */
//% blockId=max7219_matrix_getEmptyMatrix
//% block="Empty 8x8 pattern" group="4. Set custom LED pattern on matrixs"
export function getEmptyMatrix() {
return [
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0],
]
}

/**
   * (internal function) get 8x8 matrix from a column array
   */
function _getMatrixFromColumns(columns: number[]): number[][] {
let matrix: number[][] = getEmptyMatrix()
for (let i = 0; i < 8; i++) {
let singleCol = columns[i]
for (let j = 7; j >= 0; j--) {
if (singleCol >= 2 ** j) {
singleCol -= 2 ** j
matrix[i][j] = 1
} else if (singleCol == 0) {
break
}
}
}
return matrix
}

/**
   * Scroll a text accross all MAX7219 matrixs for once
   */
//% block="Scroll text $text|delay (ms) $delay|at the end wait (ms) $endDelay" text.defl="Hello world!" delay.min=0 delay.defl=75 endDelay.min=0 endDelay.defl=500 group="2. Display text on matrixs" blockExternalInputs=true
export function scrollText(text: string, delay: number, endDelay: number) {
let printPosition = _displayArray.length - 8
let characters_index: number[] = []
let currentChrIndex = 0
let currentLetterArray: number[] = []
let nextChrCountdown = 1
let chrCountdown: number[] = []
let totalScrollTime = 0
// clear screen and array
for (let i = 0; i < _displayArray.length; i++) _displayArray[i] = 0
clearAll()
// get letter index of every characters and total scroll time needed
for (let i = 0; i < text.length; i++) {
let index = letter.indexOf(text.substr(i, 1))
if (index >= 0) {
characters_index.push(index)
//chrCountdown.push(letter_matrix[index].length)
//totalScrollTime += letter_matrix[index].length
const w = _getGlyphLen(index)
chrCountdown.push(w)
totalScrollTime += w
}
}
totalScrollTime += _matrixNum * 8
// print characters into array and scroll the array
for (let i = 0; i < totalScrollTime; i++) {
nextChrCountdown -= 1
if (currentChrIndex < characters_index.length && nextChrCountdown == 0) {
// print a character just "outside" visible area
currentLetterArray = _getGlyphColumns(characters_index[currentChrIndex])
if (currentLetterArray != null)
for (let j = 0; j < currentLetterArray.length; j++)
_displayArray[printPosition + j] = currentLetterArray[j]
// wait until current character scrolled into visible area
nextChrCountdown = chrCountdown[currentChrIndex]
currentChrIndex += 1
}
// scroll array (copy all columns to the one before it)
for (let j = 0; j < _displayArray.length - 1; j++) {
_displayArray[j] = _displayArray[j + 1]
}
_displayArray[_displayArray.length - 1] = 0
// write every 8 columns of display array (visible area) to each MAX7219s
let matrixCountdown = _matrixNum - 1
let actualMatrixIndex = 0
for (let j = 8; j < _displayArray.length - 8; j += 8) {
if (matrixCountdown < 0) break
if (!_reversed) actualMatrixIndex = matrixCountdown
else actualMatrixIndex = _matrixNum - 1 - matrixCountdown
if (_rotation == rotation_direction.none) {
for (let k = j; k < j + 8; k++)
_registerForOne(_DIGIT[k - j], _displayArray[k], actualMatrixIndex)
} else { // rotate matrix if needed
let tmpColumns = [0, 0, 0, 0, 0, 0, 0, 0]
let l = 0
for (let k = j; k < j + 8; k++) tmpColumns[l++] = _displayArray[k]
displayLEDsForOne(_getMatrixFromColumns(tmpColumns), actualMatrixIndex)
}
matrixCountdown--
}
basic.pause(delay)
}
basic.pause(endDelay)
}

/**
   * Print a text accross the chain of MAX7219 matrixs at a specific spot. Offset value -8 ~ last column of matrixs. You can choose to clear the screen or not (if not it can be used to print multiple string on the MAX7219 chain).
   */
//% block="Display text (align left) $text|offset $offset|clear screen first $clear" text.defl="Hi!" offset.min=-8 clear.defl=true group="2. Display text on matrixs" blockExternalInputs=true
export function displayText(text: string, offset: number, clear: boolean) {
// clear screen and array if needed
if (clear) {
for (let i = 0; i < _displayArray.length; i++) _displayArray[i] = 0
clearAll()
}
let printPosition = Math.constrain(offset, -8, _displayArray.length - 9) + 8
let currentPosition = printPosition
let characters_index: number[] = []
let currentChrIndex = 0
let currentLetterArray: number[] = []
// get letter index of every characters
for (let i = 0; i < text.length; i++) {
let index = letter.indexOf(text.substr(i, 1))
if (index >= 0) characters_index.push(index)
}
if (characters_index.length == 0) return
// print characters into array from offset position
while (printPosition < _displayArray.length - 8) {
currentLetterArray = _getGlyphColumns(characters_index[currentChrIndex])
if (currentLetterArray != null)
for (let j = 0; j < currentLetterArray.length; j++)
_displayArray[printPosition++] = currentLetterArray[j]
currentChrIndex += 1
if (currentChrIndex >= characters_index.length) break
}
// write every 8 columns of display array (visible area) to each MAX7219s
let matrixCountdown = _matrixNum - 1
let actualMatrixIndex = 0
for (let i = 8; i < _displayArray.length - 8; i += 8) {
if (matrixCountdown < 0) break
if (!_reversed) actualMatrixIndex = matrixCountdown
else actualMatrixIndex = _matrixNum - 1 - matrixCountdown
if (_rotation == rotation_direction.none) {
for (let j = i; j < i + 8; j++)
_registerForOne(_DIGIT[j - i], _displayArray[j], actualMatrixIndex)
} else { // rotate matrix and reverse order if needed
let tmpColumns = [0, 0, 0, 0, 0, 0, 0, 0]
let l = 0
for (let j = i; j < i + 8; j++)  tmpColumns[l++] = _displayArray[j]
displayLEDsForOne(_getMatrixFromColumns(tmpColumns), actualMatrixIndex)
}
matrixCountdown--
}
}

/**
   * Print a text on the chain of MAX7219 matrixs and automatically align to the right.
   */
//% block="Display text (align right) $text|clear screen first $clear" text.defl="Hi!" clear.defl=true group="2. Display text on matrixs" blockExternalInputs=true
export function displayTextAlignRight(text: string, clear: boolean) {
let len = 0
for (let i = 0; i < text.length; i++) {
let index = letter.indexOf(text.substr(i, 1))
if (index >= 0) len += _getGlyphLen(index)
}
displayText(text, _matrixNum * 8 - len, clear)
}

/**
   * Print a custom character from a number array on the chain of MAX7219 matrixs at a specific spot. Each number in the array is 0-255, the decimal version of column's byte number. Offset value -8 ~ last column of matrixs. You can choose to clear the screen or not (if not it can be used to print multiple string on the MAX7219 chain).
   */
//% block="Display custom character from|number array $customCharArray|offset $offset|clear screen first $clear" offset.min=-8 clear.defl=true group="2. Display text on matrixs" blockExternalInputs=true advanced=true
export function displayCustomCharacter(customCharArray: number[], offset: number, clear: boolean) {
// clear screen and array if needed
if (clear) {
for (let i = 0; i < _displayArray.length; i++) _displayArray[i] = 0
clearAll()
}
let printPosition: number = Math.constrain(offset, -8, _displayArray.length - 9) + 8
if (customCharArray != null) {
// print column data to display array
for (let i = 0; i < customCharArray.length; i++)
_displayArray[printPosition + i] = customCharArray[i]
// write every 8 columns of display array (visible area) to each MAX7219s
let matrixCountdown = _matrixNum - 1
let actualMatrixIndex = 0
for (let i = 8; i < _displayArray.length - 8; i += 8) {
if (matrixCountdown < 0) break
if (!_reversed) actualMatrixIndex = matrixCountdown
else actualMatrixIndex = _matrixNum - 1 - matrixCountdown
if (_rotation == rotation_direction.none) {
for (let j = i; j < i + 8; j++)
_registerForOne(_DIGIT[j - i], _displayArray[j], actualMatrixIndex)
} else { // rotate matrix and reverse order if needed
let tmpColumns = [0, 0, 0, 0, 0, 0, 0, 0]
let l = 0
for (let j = i; j < i + 8; j++) tmpColumns[l++] = _displayArray[j]
displayLEDsForOne(_getMatrixFromColumns(tmpColumns), actualMatrixIndex)
}
matrixCountdown--
}
}
}

/**
   * Return a number array calculated from a 8x8 LED byte array (example: B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000)
   */
//% block="Get custom character number array|from byte-array string $text" text.defl="B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000" group="2. Display text on matrixs" blockExternalInputs=true advanced=true
export function getCustomCharacterArray(text: string) {
let tempTextArray: string[] = []
let resultNumberArray: number[] = []
let currentIndex = 0
let currentChr = ""
let currentNum = 0
let columnNum = 0
if (text != null && text.length > 0) {
// seperate each byte number to a string
while (currentIndex < text.length) {
tempTextArray.push(text.substr(currentIndex + 1, 8))
currentIndex += 10
}
for (let i = 0; i < tempTextArray.length; i++) {
columnNum = 0
// read each bit and calculate the decimal sum
for (let j = tempTextArray[i].length - 1; j >= 0; j--) {
currentChr = tempTextArray[i].substr(j, 1)
if (currentChr == "1" || currentChr == "0")
currentNum = parseInt(currentChr)
else
currentNum = 0
columnNum += (2 ** (tempTextArray[i].length - j - 1)) * currentNum
}
// generate new decimal array
resultNumberArray.push(columnNum)
}
return resultNumberArray
} else {
return null
}
}

/**
   * Add a custom character from a number array at the end of the extension's letter library.
   * Each number in the array is 0-255, the decimal version of column's byte number.
   */
//% block="Add custom character $chr|number array $customCharArray|to the extension letter library"
//% chr.defl=""
//% blockExternalInputs=true
//% group="2. Display text on matrixs"
//% advanced=true
export function addCustomChr(chr: string, customCharArray: number[]) {
    if (!chr || chr.length !== 1) return
    if (!customCharArray || customCharArray.length === 0) return
    if (letter.indexOf(chr) !== -1) return

    letter.push(chr)
    fontOffs.push(-customFontData.length - 1) // NEGATIVER Index = custom
    fontLen.push(customCharArray.length)
    customFontData.push(customCharArray.slice())
}
/*
   export function addCustomChr(chr: string, customCharArray: number[]) {
       if (chr != null && chr.length == 1 && customCharArray != null) {
           // add new character
           //letter.push(chr)
           //letter_matrix.push(customCharArray)
           if (!chr || chr.length != 1 || !customCharArray) return

           // 1. Zeichen registrieren
           letter.push(chr)
       
           // 2. Offset = aktuelles Ende von fontData
           fontOffs.push(fontData.length)
       
           // 3. Länge speichern
           fontLen.push(customCharArray.length)
       
           // 4. Glyph-Daten anhängen
           for (let i = 0; i < customCharArray.length; i++) {
               fontData.push(customCharArray[i] & 0xFF)
           }
       }
   }
*/
   /**
   * Display all letters in the extension letter library
   */
//% block="Display all letters at delay $delay" delay.min=0 delay.defl=200 group="2. Display text on matrixs" advanced=true
export function letterDemo(delay: number) {
let offsetIndex = 0
clearAll()
// print all characters on all matrixs
for (let i = 1; i < letter.length; i++) {
// print two blank spaces to "reset" a matrix
displayCustomCharacter(_getGlyphColumns(0), offsetIndex * 8, false)
displayCustomCharacter(_getGlyphColumns(0), offsetIndex * 8 + 4, false)
// print a character
displayCustomCharacter(_getGlyphColumns(i), offsetIndex * 8, false)
if (offsetIndex == _matrixNum - 1) offsetIndex = 0
else offsetIndex += 1
basic.pause(delay)
}
basic.pause(delay)
clearAll()
}

/**
   * Turn on or off all MAX7219s
   */
//% block="Turn on all matrixs $status" status.defl=true group="3. Basic light control" advanced=true
export function togglePower(status: boolean) {
if (status) _registerAll(_SHUTDOWN, 1)
else _registerAll(_SHUTDOWN, 0)
}

/**
   * Set brightness level of LEDs on all MAX7219s
   */
//% block="Set all brightness level $level" level.min=0 level.max=15 level.defl=15 group="3. Basic light control"
export function brightnessAll(level: number) {
_registerAll(_INTENSITY, level)
}

/**
   * Set brightness level of LEDs on a specific MAX7219s (index 0=farthest on the chain)
   */
//% block="Set brightness level $level on matrix index = $index" level.min=0 level.max=15 level.defl=15 index.min=0 group="3. Basic light control" advanced=true
export function brightnessForOne(level: number, index: number) {
_registerForOne(_INTENSITY, level, index)
}

/**
   * Turn on all LEDs on all MAX7219s
   */
//% block="Fill all LEDs" group="3. Basic light control"
export function fillAll() {
for (let i = 0; i < 8; i++) _registerAll(_DIGIT[i], 255)
}

/**
   * Turn on LEDs on a specific MAX7219
   */
//% block="Fill LEDs on matrix index = $index" index.min=0 group="3. Basic light control" advanced=true
export function fillForOne(index: number) {
for (let i = 0; i < 8; i++) _registerForOne(_DIGIT[i], 255, index)
}

/**
   * Turn off LEDs on all MAX7219s
   */
//% block="Clear all LEDs" group="3. Basic light control"
export function clearAll() {
for (let i = 0; i < 8; i++) _registerAll(_DIGIT[i], 0)
}

/**
   * Turn off LEDs on a specific MAX7219 (index 0=farthest on the chain)
   */
//% block="Clear LEDs on matrix index = $index" index.min=0 group="3. Basic light control" advanced=true
export function clearForOne(index: number) {
for (let i = 0; i < 8; i++) _registerForOne(_DIGIT[i], 0, index)
}

/**
   * Turn on LEDs randomly on all MAX7219s
   */
//% block="Randomize all LEDs" index.min=0 group="3. Basic light control"
export function randomizeAll() {
for (let i = 0; i < 8; i++) _registerAll(_DIGIT[i], Math.randomRange(0, 255))
}

/**
   * Turn on LEDs randomly on a specific MAX7219 (index 0=farthest on the chain)
   */
//% block="Randomize LEDs on matrix index = $index" index.min=0 group="3. Basic light control" advanced=true
export function randomizeForOne(index: number) {
for (let i = 0; i < 8; i++) _registerForOne(_DIGIT[i], Math.randomRange(0, 255), index)
}



/**
   * Set LEDs of all MAX7219s to a pattern from a 8x8 matrix variable (index 0=farthest on the chain)
   */
//% newMatrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Display 8x8 pattern $newMatrix on all matrixs" group="4. Set custom LED pattern on matrixs" advanced=true
export function displayLEDsToAll(newMatrix: number[][]) {
let columnValue = 0
if (newMatrix != null) {
if (_rotation != rotation_direction.none) newMatrix = _rotateMatrix(newMatrix) // rotate matrix if needed
for (let i = 0; i < 8; i++) {
if (newMatrix[i] != null) {
columnValue = 0
for (let j = 0; j < 8; j++) {
if (newMatrix[i][j]) {
// combine row 0-7 status into a byte number (0-255)
columnValue += 2 ** j
}
}
_registerAll(_DIGIT[i], columnValue)
}
}
}
}


//% blockId=max7219_matrix_matrix8x8
//% block="Image 8x8"
//% blockHidden=true
//% imageLiteral=1
//% imageLiteralColumns=8
//% imageLiteralRows=8
//% shim=images::createImage
//% group="4. Set custom LED pattern on matrixs"
export function matrix8x8(i: string): Image {
const im = <Image><any>i;
return im
}

//% block="8x8 pattern %im"
//% im.shadow="max7219_matrix_matrix8x8"   
//% group="4. Set custom LED pattern on matrixs"
export function pattern8x8(im: Image): number[][] {
let m = getEmptyMatrix()
for (let x = 0; x < 8; x++) {
for (let y = 0; y < 8; y++) {
m[x][y] = im.pixel(x, y) ? 1 : 0
}
}
return m
}

//% blockId=max7219_matrix__default8x8Pattern
//% block=" "
//% blockHidden=true
//% group="4. Set custom LED pattern on matrixs"
export function _default8x8Pattern(): number[][] {
return getEmptyMatrix()
}

/**
   * Set LEDs of a specific MAX7219s to a pattern from a 8x8 number matrix variable (index 0=farthest on the chain)
   */
//% newMatrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Display 8x8 pattern $newMatrix|on matrix index = $index" index.min=0 blockExternalInputs=true group="4. Set custom LED pattern on matrixs"
export function displayLEDsForOne(newMatrix: number[][], index: number) {
let columnValue = 0
if (newMatrix != null) {
if (_rotation != rotation_direction.none) newMatrix = _rotateMatrix(newMatrix) // rotate matrix if needed
for (let i = 0; i < 8; i++) {
if (newMatrix[i] != null) {
columnValue = 0
for (let j = 0; j < 8; j++) {
if (newMatrix[i][j]) {
// combine row 0-7 status into a byte number (0-255)
columnValue += 2 ** j
}
}
_registerForOne(_DIGIT[i], columnValue, index)
}
}
}
}

/**
   * Return a specific value from a 8x8 number matrix variable
   */
//% matrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Get value from 8x8 pattern %matrix|x = $x y = $y" x.min=0 x.max=7 y.min=0 y.max=7 group="4. Set custom LED pattern on matrixs" blockExternalInputs=true advanced=true
export function getValueFromMatrix(matrix: number[][], x: number, y: number) {
return matrix[x][y]
}

/**
   * Set a specific value in a 8x8 number matrix variable
   */
//% matrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Set 8x8 pattern %matrix|x = $x y = $y value to $value" value.min=0 value.max=1 x.min=0 x.max=7 y.min=0 y.max=7 group="4. Set custom LED pattern on matrixs" blockExternalInputs=true
export function setValueInMatrix(matrix: number[][], x: number, y: number, value: number) {
matrix[x][y] = value
}

/**
   * Toggle (between 0/1) a specific value in a 8x8 number matrix variable
   */
//% matrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Toggle value in 8x8 pattern %matrix|x = $x y = $y" x.min=0 x.max=7 y.min=0 y.max=7 group="4. Set custom LED pattern on matrixs" blockExternalInputs=true advanced=true
export function toggleValueInMatrix(matrix: number[][], x: number, y: number) {
if (matrix[x][y] == 1) matrix[x][y] = 0
else if (matrix[x][y] == 0) matrix[x][y] = 1
}

/**
   * Rotate an 8x8 pattern 
   */
//% matrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Rotate an 8x8 pattern %matrix|direction %rotationDir" rotationDir.defl=rotation_direction.clockwise group="4. Set custom LED pattern on matrixs" blockExternalInputs=true advanced=true
export function rotate8x8Pattern(matrix: number[][], rotationDir: rotation_direction){
if (rotationDir == rotation_direction.none) return matrix
let m = getEmptyMatrix()
if (rotationDir == rotation_direction.clockwise){
for (let x=0; x<4; x++){
for (let y=0; y<4; y++){
m[7-y][x] = matrix[x][y]
m[7-x][7-y] = matrix[7-y][x]
m[y][7-x] = matrix[7-x][7-y]
m[x][y] = matrix[y][7-x]
}
}
}
else if (rotationDir == rotation_direction.counterclockwise){
for (let x=0; x<4; x++){
for (let y=0; y<4; y++){
m[y][7-x] = matrix[x][y]
m[7-x][7-y] = matrix[y][7-x]
m[7-y][x] = matrix[7-x][7-y]
m[x][y] = matrix[7-y][x]
}
}
}
else if (rotationDir == rotation_direction.one_eighty_degree){
for (let x=0; x<4; x++){
for (let y=0; y<4; y++){
m[7-x][7-y] = matrix[x][y]
m[x][y] = matrix[7-x][7-y]
m[7-y][x] = matrix[y][7-x]
m[y][7-x] = matrix[7-y][x]
}
}
}
return m
}

/**
   * Flip an 8x8 pattern horizontally or vertically
   */
//% matrix.shadow="max7219_matrix__default8x8Pattern"
//% block="Flip an 8x8 pattern %matrix|direction %flipDir" flipDir.defl=flip_direction.vertical group="4. Set custom LED pattern on matrixs" blockExternalInputs=true advanced=true
export function flip8x8Pattern(matrix: number[][], flipDir: flip_direction){
if (flipDir == flip_direction.none) return matrix
let m = getEmptyMatrix()
if (flipDir == flip_direction.horizontal){
for (let x = 0; x < 8; x++){
for (let y = 0; y < 8; y++){
m[x][y] = matrix[7-x][y]
}
}
}
else if (flipDir == flip_direction.vertical){
for (let x = 0; x < 8; x++){
for (let y = 0; y < 8; y++){
m[x][y] = matrix[x][7-y]
}
}
}
return m
}

/**
   * (internal function) Get the length of the letter to be written.
   */
function _getGlyphLen(index: number): number {
return fontLen[index] || 0
}

/**
   * (internal function) Get the coloumn-data of the letter to be written.
   */
function _getGlyphColumns(index: number): number[] {
    const off = fontOffs[index]
    const len = fontLen[index] || 0
    if (len === 0) return []

    // Custom-Glyph
    if (off < 0) {
        return customFontData[-off - 1]
    }

    // Built-in Glyph
    const cols: number[] = []
    for (let i = 0; i < len; i++) {
        cols.push(fontData[off + i])
    }
    return cols
}
  /*
function _getGlyphColumns(index: number): number[] {
const len = fontLen[index] || 0
const off = fontOffs[index] || 0
const cols: number[] = []
for (let i = 0; i < len; i++) {
cols.push(fontData[off + i])
}
return cols
}
*/


// ASCII letters borrowed from https://github.com/lyle/matrix-led-font/blob/master/src/index.js

const letter = [" ", "!", "\"", "#", "$", "%", "&", "\'", "(", ")",
"*", "+", ",", "-", ".", "/",
"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
":", ";", "<", "=", ">", "?", "@",
"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
"M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Ä", "ä",
"Ö", "ö", "Ü", "ü", "ß", "[", "\\", "]", "_", "`",
"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l",
"m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
"{", "|", "}", "~", "^"]

const fontOffs: number[] = [
0, 4, 6, 10, 16, 21, 27, 33, 35, 39, 43, 49, 55, 58, 61, 64, 69, 74, 78, 83, 88, 93, 98, 103, 108, 113, 118, 120, 123, 127, 131, 135, 140, 146, 151, 156, 161, 166, 171, 176, 181, 186, 190, 195, 200, 205, 211, 217, 222, 227, 232, 237, 242, 248, 253, 259, 265, 271, 277, 282, 287, 292, 297, 302, 307, 312, 316, 319, 324, 327, 332, 334, 339, 344, 349, 354, 359, 363, 368, 373, 377, 382, 387, 391, 397, 402, 407, 412, 417, 422, 427, 431, 436, 442, 448, 454, 459, 463, 467, 469, 473, 478
]

const fontLen: number[] = [
4, 2, 4, 6, 5, 6, 6, 2, 4, 4, 6, 6, 3, 3, 3, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5, 2, 3, 4, 4, 4, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 6, 6, 5, 5, 5, 5, 5, 6, 5, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 4, 3, 5, 3, 5, 2, 5, 5, 5, 5, 5, 4, 5, 5, 4, 5, 5, 4, 6, 5, 5, 5, 5, 5, 5, 4, 5, 6, 6, 6, 5, 4, 4, 2, 4, 5, 4
]
    

        
    const fontData = hex`
      00 00 00 00      
      5F 00            
      03 00 03 00      
      14 3E 14 3E 14 00
      24 6A 2B 12 00   
      63 13 08 64 63 00
      36 49 56 20 50 00
      03 00            
      1C 22 41 00      
      41 22 1C 00      
      28 18 0E 18 28 00
      08 08 3E 08 08 00
      B0 70 00         
      08 08 08         
      60 60 00         
      60 18 06 01 00   
      3E 41 41 3E 00   
      42 7F 40 00      
      62 51 49 46 00   
      22 41 49 36 00   
      18 14 12 7F 00   
      27 45 45 39 00   
      3E 49 49 30 00   
      61 11 09 07 00   
      36 49 49 36 00   
      06 49 49 3E 00   
      14 00            
      20 14 00         
      08 14 22 00      
      14 14 14 00      
      22 14 08 00      
      02 59 09 06 00   
      3E 49 55 5D 0E 00
      7E 11 11 7E 00   
      7F 49 49 36 00   
      3E 41 41 22 00   
      7F 41 41 3E 00   
      7F 49 49 41 00   
      7F 09 09 01 00   
      3E 41 49 7A 00   
      7F 08 08 7F 00   
      41 7F 41 00      
      30 40 41 3F 00   
      7F 08 14 63 00   
      7F 40 40 40 00   
      7F 02 0C 02 7F 00
      7F 04 08 10 7F 00
      3E 41 41 3E 00   
      7F 09 09 06 00   
      3E 41 41 BE 00   
      7F 09 09 76 00   
      46 49 49 32 00   
      01 01 7F 01 01 00
      3F 40 40 3F 00   
      0F 30 40 30 0F 00
      3F 40 38 40 3F 00
      63 14 08 14 63 00
      07 08 70 08 07 00
      61 51 49 47 00   
      7D 12 12 7D 00   
      21 54 54 79 00   
      3D 42 42 3D 00   
      39 44 44 39 00   
      3D 40 40 3D 00   
      3A 40 40 3A 00   
      FE 29 36 00      
      7F 41 00         
      01 06 18 60 00   
      41 7F 00         
      40 40 40 40 00   
      03 00            
      20 54 54 78 00   
      7F 44 44 38 00   
      38 44 44 28 00   
      38 44 44 7F 00   
      38 54 54 18 00   
      04 7E 05 00      
      98 A4 A4 78 00   
      7F 04 04 78 00   
      44 7D 40 00      
      40 80 84 7D 00   
      7F 10 28 44 00   
      41 7F 40 00      
      7C 04 7C 04 78 00
      7C 04 04 78 00   
      38 44 44 38 00   
      FC 24 24 18 00   
      18 24 24 FC 00   
      7C 08 04 04 00   
      48 54 54 24 00   
      04 3F 44 00      
      3C 40 40 7C 00   
      1C 20 40 20 1C 00
      3C 40 3C 40 3C 00
      44 28 10 28 44 00
      9C A0 A0 7C 00   
      64 54 4C 00      
      08 36 41 00      
      7F 00            
      41 36 08 00      
      08 04 08 04 00   
      02 01 02 00 
    `
    /*
   const fontData = hex`
     00 00 00 00         // " "
     5F 00               // "!"
     03 00 03 00         // "\""
     14 3E 14 3E 14 00   // "#"
     24 6A 2B 12 00      // "$"
     63 13 08 64 63 00   // "%"
     36 49 56 20 50 00   // "&"
     03 00               // "\'"
     1C 22 41 00         // "("
     41 22 1C 00         // ")"
     28 18 0E 18 28 00   // "*"
     08 08 3E 08 08 00   // "+"
     B0 70 00            // ","
     08 08 08            // "-"
     60 60 00            // "."
     60 18 06 01 00      // "/"
     3E 41 41 3E 00      // "0"
     42 7F 40 00         // "1"
     62 51 49 46 00      // "2"
     22 41 49 36 00      // "3"
     18 14 12 7F 00      // "4"
     27 45 45 39 00      // "5"
     3E 49 49 30 00      // "6"
     61 11 09 07 00      // "7"
     36 49 49 36 00      // "8"
     06 49 49 3E 00      // "9"
     14 00               // ":"
     20 14 00            // ";"
     08 14 22 00         // "<"
     14 14 14 00         // "="
     22 14 08 00         // ">"
     02 59 09 06 00      // "?"
     3E 49 55 5D 0E 00   // "@"
     7E 11 11 7E 00      // "A"
     7F 49 49 36 00      // "B"
     3E 41 41 22 00      // "C"
     7F 41 41 3E 00      // "D"
     7F 49 49 41 00      // "E"
     7F 09 09 01 00      // "F"
     3E 41 49 7A 00      // "G"
     7F 08 08 7F 00      // "H"
     41 7F 41 00         // "I"
     30 40 41 3F 00      // "J"
     7F 08 14 63 00      // "K"
     7F 40 40 40 00      // "L"
     7F 02 0C 02 7F 00   // "M"
     7F 04 08 10 7F 00   // "N"
     3E 41 41 3E 00      // "O"
     7F 09 09 06 00      // "P"
     3E 41 41 BE 00      // "Q"
     7F 09 09 76 00      // "R"
     46 49 49 32 00      // "S"
     01 01 7F 01 01 00   // "T"
     3F 40 40 3F 00      // "U"
     0F 30 40 30 0F 00   // "V"
     3F 40 38 40 3F 00   // "W"
     63 14 08 14 63 00   // "X"
     07 08 70 08 07 00   // "Y"
     61 51 49 47 00      // "Z"
     7D 12 12 7D 00      // "Ä"
     21 54 54 79 00      // "ä"
     3D 42 42 3D 00      // "Ö"
     39 44 44 39 00      // "ö"
     3D 40 40 3D 00      // "Ü"
     3A 40 40 3A 00      // "ü"
     FE 29 36 00         // "ß"
     7F 41 00            // "["
     01 06 18 60 00      // "\\"
     41 7F 00            // "]"
     40 40 40 40 00      // "_"
     03 00               // "\'"
     20 54 54 78 00      // "a"
     7F 44 44 38 00      // "b"
     38 44 44 28 00      // "c"
     38 44 44 7F 00      // "d"
     38 54 54 18 00      // "e"
     04 7E 05 00         // "f"
     98 A4 A4 78 00      // "g"
     7F 04 04 78 00      // "h"
     44 7D 40 00         // "i"
     40 80 84 7D 00      // "j"
     7F 10 28 44 00      // "k"
     41 7F 40 00         // "l"
     7C 04 7C 04 78 00   // "m"
     7C 04 04 78 00      // "n"
     38 44 44 38 00      // "o"
     FC 24 24 18 00      // "p"
     18 24 24 FC 00      // "q"
     7C 08 04 04 00      // "r"
     48 54 54 24 00      // "s"
     04 3F 44 00         // "t"
     3C 40 40 7C 00      // "u"
     1C 20 40 20 1C 00   // "v"
     3C 40 3C 40 3C 00   // "w"
     44 28 10 28 44 00   // "x"
     9C A0 A0 7C 00      // "y"
     64 54 4C 00         // "z"
     08 36 41 00         // "{"
     7F 00               // "|"
     41 36 08 00         // "}"
     08 04 08 04 00      // "~"
     02 01 02 00         // "^"
   `
    */
/*
   const fontData: number[] = [
     0b00000000, 0b00000000, 0b00000000, 0b00000000                        ,  // " "
     0b01011111, 0b00000000                                                ,  // "!"
     0b00000011, 0b00000000, 0b00000011, 0b00000000                        ,  // "\""
     0b00010100, 0b00111110, 0b00010100, 0b00111110, 0b00010100, 0b00000000,  // "#"
     0b00100100, 0b01101010, 0b00101011, 0b00010010, 0b00000000            ,  // "$"
     0b01100011, 0b00010011, 0b00001000, 0b01100100, 0b01100011, 0b00000000,  // "%"
     0b00110110, 0b01001001, 0b01010110, 0b00100000, 0b01010000, 0b00000000,  // "&"
     0b00000011, 0b00000000                                                ,  // "\'"
     0b00011100, 0b00100010, 0b01000001, 0b00000000                        ,  // "("
     0b01000001, 0b00100010, 0b00011100, 0b00000000                        ,  // ")"
     0b00101000, 0b00011000, 0b00001110, 0b00011000, 0b00101000, 0b00000000,  // "*"
     0b00001000, 0b00001000, 0b00111110, 0b00001000, 0b00001000, 0b00000000,  // "+"
     0b10110000, 0b01110000, 0b00000000                                    ,  // ","
     0b00001000, 0b00001000, 0b00001000                                    ,  // "-"
     0b01100000, 0b01100000, 0b00000000                                    ,  // "."
     0b01100000, 0b00011000, 0b00000110, 0b00000001, 0b00000000            ,  // "/"
     0b00111110, 0b01000001, 0b01000001, 0b00111110, 0b00000000            ,  // "0"
     0b01000010, 0b01111111, 0b01000000, 0b00000000                        ,  // "1"
     0b01100010, 0b01010001, 0b01001001, 0b01000110, 0b00000000            ,  // "2"
     0b00100010, 0b01000001, 0b01001001, 0b00110110, 0b00000000            ,  // "3"
     0b00011000, 0b00010100, 0b00010010, 0b01111111, 0b00000000            ,  // "4"
     0b00100111, 0b01000101, 0b01000101, 0b00111001, 0b00000000            ,  // "5"
     0b00111110, 0b01001001, 0b01001001, 0b00110000, 0b00000000            ,  // "6"
     0b01100001, 0b00010001, 0b00001001, 0b00000111, 0b00000000            ,  // "7"
     0b00110110, 0b01001001, 0b01001001, 0b00110110, 0b00000000            ,  // "8"
     0b00000110, 0b01001001, 0b01001001, 0b00111110, 0b00000000            ,  // "9"
     0b00010100, 0b00000000                                                ,  // ":"
     0b00100000, 0b00010100, 0b00000000                                    ,  // ";"
     0b00001000, 0b00010100, 0b00100010, 0b00000000                        ,  // "<"
     0b00010100, 0b00010100, 0b00010100, 0b00000000                        ,  // "="
     0b00100010, 0b00010100, 0b00001000, 0b00000000                        ,  // ">"
     0b00000010, 0b01011001, 0b00001001, 0b00000110, 0b00000000            ,  // "?"
     0b00111110, 0b01001001, 0b01010101, 0b01011101, 0b00001110, 0b00000000,  // "@"
     0b01111110, 0b00010001, 0b00010001, 0b01111110, 0b00000000            ,  // "A"
     0b01111111, 0b01001001, 0b01001001, 0b00110110, 0b00000000            ,  // "B"
     0b00111110, 0b01000001, 0b01000001, 0b00100010, 0b00000000            ,  // "C"
     0b01111111, 0b01000001, 0b01000001, 0b00111110, 0b00000000            ,  // "D"
     0b01111111, 0b01001001, 0b01001001, 0b01000001, 0b00000000            ,  // "E"
     0b01111111, 0b00001001, 0b00001001, 0b00000001, 0b00000000            ,  // "F"
     0b00111110, 0b01000001, 0b01001001, 0b01111010, 0b00000000            ,  // "G"
     0b01111111, 0b00001000, 0b00001000, 0b01111111, 0b00000000            ,  // "H"
     0b01000001, 0b01111111, 0b01000001, 0b00000000                        ,  // "I"
     0b00110000, 0b01000000, 0b01000001, 0b00111111, 0b00000000            ,  // "J"
     0b01111111, 0b00001000, 0b00010100, 0b01100011, 0b00000000            ,  // "K"
     0b01111111, 0b01000000, 0b01000000, 0b01000000, 0b00000000            ,  // "L"
     0b01111111, 0b00000010, 0b00001100, 0b00000010, 0b01111111, 0b00000000,  // "M"
     0b01111111, 0b00000100, 0b00001000, 0b00010000, 0b01111111, 0b00000000,  // "N"
     0b00111110, 0b01000001, 0b01000001, 0b00111110, 0b00000000            ,  // "O"
     0b01111111, 0b00001001, 0b00001001, 0b00000110, 0b00000000            ,  // "P"
     0b00111110, 0b01000001, 0b01000001, 0b10111110, 0b00000000            ,  // "Q"
     0b01111111, 0b00001001, 0b00001001, 0b01110110, 0b00000000            ,  // "R"
     0b01000110, 0b01001001, 0b01001001, 0b00110010, 0b00000000            ,  // "S"
     0b00000001, 0b00000001, 0b01111111, 0b00000001, 0b00000001, 0b00000000,  // "T"
     0b00111111, 0b01000000, 0b01000000, 0b00111111, 0b00000000            ,  // "U"
     0b00001111, 0b00110000, 0b01000000, 0b00110000, 0b00001111, 0b00000000,  // "V"
     0b00111111, 0b01000000, 0b00111000, 0b01000000, 0b00111111, 0b00000000,  // "W"
     0b01100011, 0b00010100, 0b00001000, 0b00010100, 0b01100011, 0b00000000,  // "X"
     0b00000111, 0b00001000, 0b01110000, 0b00001000, 0b00000111, 0b00000000,  // "Y"
     0b01100001, 0b01010001, 0b01001001, 0b01000111, 0b00000000            ,  // "Z"
     0b01111101, 0b00010010, 0b00010010, 0b01111101, 0b00000000            ,  // "Ä"
     0b00100001, 0b01010100, 0b01010100, 0b01111001, 0b00000000            ,  // "ä"
     0b00111101, 0b01000010, 0b01000010, 0b00111101, 0b00000000            ,  // "Ö"
     0b00111001, 0b01000100, 0b01000100, 0b00111001, 0b00000000            ,  // "ö"
     0b00111101, 0b01000000, 0b01000000, 0b00111101, 0b00000000            ,  // "Ü"
     0b00111010, 0b01000000, 0b01000000, 0b00111010, 0b00000000            ,  // "ü"
     0b11111110, 0b00101001, 0b00110110, 0b00000000                        ,  // "ß"
     0b01111111, 0b01000001, 0b00000000                                    ,  // "["
     0b00000001, 0b00000110, 0b00011000, 0b01100000, 0b00000000            ,  // "\\"
     0b01000001, 0b01111111, 0b00000000                                    ,  // "]"
     0b01000000, 0b01000000, 0b01000000, 0b01000000, 0b00000000            ,  // "_"
     0b00000011, 0b00000000                                                ,  // "\'"
     0b00100000, 0b01010100, 0b01010100, 0b01111000, 0b00000000            ,  // "a"
     0b01111111, 0b01000100, 0b01000100, 0b00111000, 0b00000000            ,  // "b"
     0b00111000, 0b01000100, 0b01000100, 0b00101000, 0b00000000            ,  // "c"
     0b00111000, 0b01000100, 0b01000100, 0b01111111, 0b00000000            ,  // "d"
     0b00111000, 0b01010100, 0b01010100, 0b00011000, 0b00000000            ,  // "e"
     0b00000100, 0b01111110, 0b00000101, 0b00000000                        ,  // "f"
     0b10011000, 0b10100100, 0b10100100, 0b01111000, 0b00000000            ,  // "g"
     0b01111111, 0b00000100, 0b00000100, 0b01111000, 0b00000000            ,  // "h"
     0b01000100, 0b01111101, 0b01000000, 0b00000000                        ,  // "i"
     0b01000000, 0b10000000, 0b10000100, 0b01111101, 0b00000000            ,  // "j"
     0b01111111, 0b00010000, 0b00101000, 0b01000100, 0b00000000            ,  // "k"
     0b01000001, 0b01111111, 0b01000000, 0b00000000                        ,  // "l"
     0b01111100, 0b00000100, 0b01111100, 0b00000100, 0b01111000, 0b00000000,  // "m"
     0b01111100, 0b00000100, 0b00000100, 0b01111000, 0b00000000            ,  // "n"
     0b00111000, 0b01000100, 0b01000100, 0b00111000, 0b00000000            ,  // "o"
     0b11111100, 0b00100100, 0b00100100, 0b00011000, 0b00000000            ,  // "p"
     0b00011000, 0b00100100, 0b00100100, 0b11111100, 0b00000000            ,  // "q"
     0b01111100, 0b00001000, 0b00000100, 0b00000100, 0b00000000            ,  // "r"
     0b01001000, 0b01010100, 0b01010100, 0b00100100, 0b00000000            ,  // "s"
     0b00000100, 0b00111111, 0b01000100, 0b00000000                        ,  // "t"
     0b00111100, 0b01000000, 0b01000000, 0b01111100, 0b00000000            ,  // "u"
     0b00011100, 0b00100000, 0b01000000, 0b00100000, 0b00011100, 0b00000000,  // "v"
     0b00111100, 0b01000000, 0b00111100, 0b01000000, 0b00111100, 0b00000000,  // "w"
     0b01000100, 0b00101000, 0b00010000, 0b00101000, 0b01000100, 0b00000000,  // "x"
     0b10011100, 0b10100000, 0b10100000, 0b01111100, 0b00000000            ,  // "y"
     0b01100100, 0b01010100, 0b01001100, 0b00000000                        ,  // "z"
     0b00001000, 0b00110110, 0b01000001, 0b00000000                        ,  // "{"
     0b01111111, 0b00000000                                                ,  // "|"
     0b01000001, 0b00110110, 0b00001000, 0b00000000                        ,  // "}"
     0b00001000, 0b00000100, 0b00001000, 0b00000100, 0b00000000            ,  // "~"
     0b00000010, 0b00000001, 0b00000010, 0b00000000                        ,  // "^"
   ]
   
   /*
   let letter_matrix = [
       [0b00000000,
           0b00000000,
           0b00000000,
           0b00000000],
       [0b01011111,
           0b00000000],
       [0b00000011,
           0b00000000,
           0b00000011,
           0b00000000],
       [0b00010100,
           0b00111110,
           0b00010100,
           0b00111110,
           0b00010100,
           0b00000000],
       [0b00100100,
           0b01101010,
           0b00101011,
           0b00010010,
           0b00000000],
       [0b01100011,
           0b00010011,
           0b00001000,
           0b01100100,
           0b01100011,
           0b00000000],
       [0b00110110,
           0b01001001,
           0b01010110,
           0b00100000,
           0b01010000,
           0b00000000],
       [0b00000011,
           0b00000000],
       [0b00011100,
           0b00100010,
           0b01000001,
           0b00000000],
       [0b01000001,
           0b00100010,
           0b00011100,
           0b00000000],
       [0b00101000,
           0b00011000,
           0b00001110,
           0b00011000,
           0b00101000,
           0b00000000],
       [0b00001000,
           0b00001000,
           0b00111110,
           0b00001000,
           0b00001000,
           0b00000000],
       [0b10110000,
           0b01110000,
           0b00000000],
       [0b00001000,
           0b00001000,
           0b00001000],
       [0b01100000,
           0b01100000,
           0b00000000],
       [0b01100000,
           0b00011000,
           0b00000110,
           0b00000001,
           0b00000000],
       [0b00111110,
           0b01000001,
           0b01000001,
           0b00111110,
           0b00000000],
       [0b01000010,
           0b01111111,
           0b01000000,
           0b00000000],
       [0b01100010,
           0b01010001,
           0b01001001,
           0b01000110,
           0b00000000],
       [0b00100010,
           0b01000001,
           0b01001001,
           0b00110110,
           0b00000000],
       [0b00011000,
           0b00010100,
           0b00010010,
           0b01111111,
           0b00000000],
       [0b00100111,
           0b01000101,
           0b01000101,
           0b00111001,
           0b00000000],
       [0b00111110,
           0b01001001,
           0b01001001,
           0b00110000,
           0b00000000],
       [0b01100001,
           0b00010001,
           0b00001001,
           0b00000111,
           0b00000000],
       [0b00110110,
           0b01001001,
           0b01001001,
           0b00110110,
           0b00000000],
       [0b00000110,
           0b01001001,
           0b01001001,
           0b00111110,
           0b00000000],
       [0b00010100,
           0b00000000],
       [0b00100000,
           0b00010100,
           0b00000000],
       [0b00001000,
           0b00010100,
           0b00100010,
           0b00000000],
       [0b00010100,
           0b00010100,
           0b00010100,
           0b00000000],
       [0b00100010,
           0b00010100,
           0b00001000,
           0b00000000],
       [0b00000010,
           0b01011001,
           0b00001001,
           0b00000110,
           0b00000000],
       [0b00111110,
           0b01001001,
           0b01010101,
           0b01011101,
           0b00001110,
           0b00000000],
       [0b01111110,
           0b00010001,
           0b00010001,
           0b01111110,
           0b00000000],
       [0b01111111,
           0b01001001,
           0b01001001,
           0b00110110,
           0b00000000],
       [0b00111110,
           0b01000001,
           0b01000001,
           0b00100010,
           0b00000000],
       [0b01111111,
           0b01000001,
           0b01000001,
           0b00111110,
           0b00000000],
       [0b01111111,
           0b01001001,
           0b01001001,
           0b01000001,
           0b00000000],
       [0b01111111,
           0b00001001,
           0b00001001,
           0b00000001,
           0b00000000],
       [0b00111110,
           0b01000001,
           0b01001001,
           0b01111010,
           0b00000000],
       [0b01111111,
           0b00001000,
           0b00001000,
           0b01111111,
           0b00000000],
       [0b01000001,
           0b01111111,
           0b01000001,
           0b00000000],
       [0b00110000,
           0b01000000,
           0b01000001,
           0b00111111,
           0b00000000],
       [0b01111111,
           0b00001000,
           0b00010100,
           0b01100011,
           0b00000000],
       [0b01111111,
           0b01000000,
           0b01000000,
           0b01000000,
           0b00000000],
       [0b01111111,
           0b00000010,
           0b00001100,
           0b00000010,
           0b01111111,
           0b00000000],
       [0b01111111,
           0b00000100,
           0b00001000,
           0b00010000,
           0b01111111,
           0b00000000],
       [0b00111110,
           0b01000001,
           0b01000001,
           0b00111110,
           0b00000000],
       [0b01111111,
           0b00001001,
           0b00001001,
           0b00000110,
           0b00000000],
       [0b00111110,
           0b01000001,
           0b01000001,
           0b10111110,
           0b00000000],
       [0b01111111,
           0b00001001,
           0b00001001,
           0b01110110,
           0b00000000],
       [0b01000110,
           0b01001001,
           0b01001001,
           0b00110010,
           0b00000000],
       [0b00000001,
           0b00000001,
           0b01111111,
           0b00000001,
           0b00000001,
           0b00000000],
       [0b00111111,
           0b01000000,
           0b01000000,
           0b00111111,
           0b00000000],
       [0b00001111,
           0b00110000,
           0b01000000,
           0b00110000,
           0b00001111,
           0b00000000],
       [0b00111111,
           0b01000000,
           0b00111000,
           0b01000000,
           0b00111111,
           0b00000000],
       [0b01100011,
           0b00010100,
           0b00001000,
           0b00010100,
           0b01100011,
           0b00000000],
       [0b00000111,
           0b00001000,
           0b01110000,
           0b00001000,
           0b00000111,
           0b00000000],
       [0b01100001,
           0b01010001,
           0b01001001,
           0b01000111,
           0b00000000], //Z
       [0b01111101,
         0b00010010,
         0b00010010,
         0b01111101,
         0b00000000], //Ä
       [ 0b00100001,
         0b01010100,
         0b01010100,
         0b01111001,
         0b00000000], //ä
       [ 0b00111101,
         0b01000010,
         0b01000010,
         0b00111101,
         0b00000000], //Ö
       [ 0b00111001,
         0b01000100,
         0b01000100,
         0b00111001,
         0b00000000], //ö
       [ 0b00111101,
         0b01000000,
         0b01000000,
         0b00111101,
         0b00000000], //Ü
       [ 0b00111010,
         0b01000000,
         0b01000000,
         0b00111010,
         0b00000000], //ü
       [ 0b11111110,
         0b00101001,
         0b00110110,
         0b00000000], //ß
       [0b01111111,
           0b01000001,
           0b00000000],
       [0b00000001,
           0b00000110,
           0b00011000,
           0b01100000,
           0b00000000],
       [0b01000001,
           0b01111111,
           0b00000000],
       [0b01000000,
           0b01000000,
           0b01000000,
           0b01000000,
           0b00000000],
       [0b00000001,
           0b00000010,
           0b00000000],
       [0b00100000,
           0b01010100,
           0b01010100,
           0b01111000,
           0b00000000],
       [0b01111111,
           0b01000100,
           0b01000100,
           0b00111000,
           0b00000000],
       [0b00111000,
           0b01000100,
           0b01000100,
           0b00101000,
           0b00000000],
       [0b00111000,
           0b01000100,
           0b01000100,
           0b01111111,
           0b00000000],
       [0b00111000,
           0b01010100,
           0b01010100,
           0b00011000,
           0b00000000],
       [0b00000100,
           0b01111110,
           0b00000101,
           0b00000000],
       [0b10011000,
           0b10100100,
           0b10100100,
           0b01111000,
           0b00000000],
       [0b01111111,
           0b00000100,
           0b00000100,
           0b01111000,
           0b00000000],
       [0b01000100,
           0b01111101,
           0b01000000,
           0b00000000],
       [0b01000000,
           0b10000000,
           0b10000100,
           0b01111101,
           0b00000000],
       [0b01111111,
           0b00010000,
           0b00101000,
           0b01000100,
           0b00000000],
       [0b01000001,
           0b01111111,
           0b01000000,
           0b00000000],
       [0b01111100,
           0b00000100,
           0b01111100,
           0b00000100,
           0b01111000,
           0b00000000],
       [0b01111100,
           0b00000100,
           0b00000100,
           0b01111000,
           0b00000000],
       [0b00111000,
           0b01000100,
           0b01000100,
           0b00111000,
           0b00000000],
       [0b11111100,
           0b00100100,
           0b00100100,
           0b00011000,
           0b00000000],
       [0b00011000,
           0b00100100,
           0b00100100,
           0b11111100,
           0b00000000],
       [0b01111100,
           0b00001000,
           0b00000100,
           0b00000100,
           0b00000000],
       [0b01001000,
           0b01010100,
           0b01010100,
           0b00100100,
           0b00000000],
       [0b00000100,
           0b00111111,
           0b01000100,
           0b00000000],
       [0b00111100,
           0b01000000,
           0b01000000,
           0b01111100,
           0b00000000],
       [0b00011100,
           0b00100000,
           0b01000000,
           0b00100000,
           0b00011100,
           0b00000000],
       [0b00111100,
           0b01000000,
           0b00111100,
           0b01000000,
           0b00111100,
           0b00000000],
       [0b01000100,
           0b00101000,
           0b00010000,
           0b00101000,
           0b01000100,
           0b00000000],
       [0b10011100,
           0b10100000,
           0b10100000,
           0b01111100,
           0b00000000],
       [0b01100100,
           0b01010100,
           0b01001100,
           0b00000000],
       [0b00001000,
           0b00110110,
           0b01000001,
           0b00000000],
       [0b01111111,
           0b00000000],
       [0b01000001,
           0b00110110,
           0b00001000,
           0b00000000],
       [0b00001000,
           0b00000100,
           0b00001000,
           0b00000100,
           0b00000000],
       [0b00000010,
           0b00000001,
           0b00000010,
           0b00000000]]
       */

}

enum rotation_direction {
//% block="none"
none = 0,
//% block="clockwise"
clockwise = 1,
//% block="counter-clockwise"
counterclockwise = 2,
//% block="180-degree"
one_eighty_degree = 3
}

enum flip_direction {
//% block="none"
none = 0,
//% block="horizontal"
horizontal = 1,
//% block="vertical"
vertical = 2
}










