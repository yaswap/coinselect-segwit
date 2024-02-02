// baseline estimates, used to improve performance
var TX_EMPTY_SIZE = 4 + 1 + 1 + 4
var TX_INPUT_BASE = 32 + 4 + 1 + 4
var TX_INPUT_PUBKEYHASH = 107
var TX_INPUT_SEGWIT = 27
var TX_INPUT_TAPROOT = 17 // round up 16.5 bytes
var TX_OUTPUT_BASE = 8 + 1
var TX_OUTPUT_PUBKEYHASH = 25
var TX_OUTPUT_SCRIPTHASH = 23
var TX_OUTPUT_SEGWIT = 22
var TX_OUTPUT_SEGWIT_SCRIPTHASH = 34

function inputBytes (input) {
  return TX_INPUT_BASE + (input.redeemScript ? input.redeemScript.length : 0) +
    (input.witnessScript ? parseInt(input.witnessScript.length / 4)
      : input.isTaproot ? TX_INPUT_TAPROOT
        : input.witnessUtxo ? TX_INPUT_SEGWIT
          : !input.redeemScript ? TX_INPUT_PUBKEYHASH : 0)
}

function outputBytes (output) {
  let nBytes = TX_OUTPUT_BASE
  if (output.script) {
    nBytes += output.script.length
  } else if (output.address) {
    if (output.address.startsWith('bc1') || output.address.startsWith('tb1')) {
      if (output.address.length === 42) {
        nBytes += TX_OUTPUT_SEGWIT
      } else {
        nBytes += TX_OUTPUT_SEGWIT_SCRIPTHASH
      }
    } else if (output.address.startsWith('3') || output.address.startsWith('2')) {
      nBytes += TX_OUTPUT_SCRIPTHASH
    } else {
      nBytes += TX_OUTPUT_PUBKEYHASH
    }
  } else {
    nBytes += TX_OUTPUT_PUBKEYHASH
  }

  return nBytes
}

function dustThreshold (output, feeRate) {
  /* ... classify the output for input estimate  */
  return inputBytes({}) * feeRate
}

function transactionBytes (inputs, outputs) {
  return TX_EMPTY_SIZE +
    inputs.reduce(function (a, x) { return a + inputBytes(x) }, 0) +
    outputs.reduce(function (a, x) { return a + outputBytes(x) }, 0)
}

function uintOrNaN (v) {
  if (typeof v !== 'number') return NaN
  if (!isFinite(v)) return NaN
  if (Math.floor(v) !== v) return NaN
  if (v < 0) return NaN
  return v
}

function sumForgiving (range) {
  return range.reduce(function (a, x) { return a + (isFinite(x.value) ? x.value : 0) }, 0)
}

function sumOrNaN (range) {
  return range.reduce(function (a, x) { return a + uintOrNaN(x.value) }, 0)
}

var BLANK_OUTPUT = outputBytes({})

function finalize (inputs, outputs, feeRate) {
  var bytesAccum = transactionBytes(inputs, outputs)
  var feeAfterExtraOutput = feeRate * (bytesAccum + BLANK_OUTPUT)
  var remainderAfterExtraOutput = sumOrNaN(inputs) - (sumOrNaN(outputs) + feeAfterExtraOutput)

  // is it worth a change output?
  if (remainderAfterExtraOutput > dustThreshold({}, feeRate)) {
    outputs = outputs.concat({ value: remainderAfterExtraOutput })
  }

  var fee = sumOrNaN(inputs) - sumOrNaN(outputs)
  if (!isFinite(fee)) return { fee: feeRate * bytesAccum }

  return {
    inputs: inputs,
    outputs: outputs,
    fee: fee
  }
}

module.exports = {
  dustThreshold: dustThreshold,
  finalize: finalize,
  inputBytes: inputBytes,
  outputBytes: outputBytes,
  sumOrNaN: sumOrNaN,
  sumForgiving: sumForgiving,
  transactionBytes: transactionBytes,
  uintOrNaN: uintOrNaN
}
