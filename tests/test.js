var inspector = require('inspector')
inspector.open(9330, null, true)

function tryRequire(module) {
	try {
		return require(module)
	} catch(error) {
		return {}
	}
}
if (typeof chai === 'undefined') { chai = require('chai') }
assert = chai.assert
if (typeof cborX === 'undefined') { cborX = require('..') }
var Encoder = cborX.Encoder
var EncoderStream = cborX.EncoderStream
var DecoderStream = cborX.DecoderStream
var decode = cborX.decode
var encode = cborX.encode
var DECIMAL_FIT = cborX.DECIMAL_FIT

var addExtension = cborX.addExtension

var zlib = tryRequire('zlib')
var deflateSync = zlib.deflateSync
var inflateSync = zlib.inflateSync
var deflateSync = zlib.brotliCompressSync
var inflateSync = zlib.brotliDecompressSync
var constants = zlib.constants
import('./test.mjs')
try {
//	var { decode, encode } = require('msgencode-lite')
} catch (error) {}

if (typeof XMLHttpRequest === 'undefined') {
	var fs = require('fs')
	var sampleData = JSON.parse(fs.readFileSync(__dirname + '/example4.json'))
} else {
	var xhr = new XMLHttpRequest()
	xhr.open('GET', 'example4.json', false)
	xhr.send()
	var sampleData = JSON.parse(xhr.responseText)
}
var ITERATIONS = 10000

suite('cborX basic tests', function(){
	test('encode/decode data', function(){
		var data = {
			data: [
				{ a: 1, name: 'one', type: 'odd', isOdd: true },
				{ a: 2, name: 'two', type: 'even'},
				{ a: 3, name: 'three', type: 'odd', isOdd: true },
				{ a: 4, name: 'four', type: 'even'},
				{ a: 5, name: 'five', type: 'odd', isOdd: true },
				{ a: 6, name: 'six', type: 'even', isOdd: null }
			],
			description: 'some names',
			types: ['odd', 'even'],
			convertEnumToNum: [
				{ prop: 'test' },
				{ prop: 'test' },
				{ prop: 'test' },
				{ prop: 1 },
				{ prop: 2 },
				{ prop: [undefined] },
				{ prop: null }
			]
		}
		let structures = []
		let encoder = new Encoder({ structures })
		var serialized = encoder.encode(data)
		var deserialized = encoder.decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('mixed array', function(){
		var data = [
			'one',
			'two',
			'one',
			10,
			11,
			null,
			true,
			'three',
			'three',
			'one', [
				3, -5, -50, -400,1.3, -5.3, true
			]
		]
		let structures = []
		let encoder = new Encoder({ structures })
		var serialized = encoder.encode(data)
		var deserialized = encoder.decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('encode/decode sample data', function(){
		var data = sampleData
		let structures = []
		let encoder = new Encoder({ structures, useRecords: true })
		var serialized = encoder.encode(data)
		var deserialized = encoder.decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('extended class', function(){
		function Extended() {

		}
		Extended.prototype.getDouble = function() {
			return this.value * 2
		}
		var instance = new Extended()
		instance.value = 4
		instance.string = 'decode this: ᾜ'
		var data = {
			prop1: 'has multi-byte: ᾜ',
			extendedInstance: instance,
			prop2: 'more string',
			num: 3,
		}
		let encoder = new Encoder()
		addExtension({
			Class: Extended,
			type: 30,
			decode: function(buffer) {
				let e = new Extended()
				let data = encoder.decode(buffer)
				e.value = data[0]
				e.string = data[1]
				return e
			},
			encode: function(instance) {
				return encoder.encode([instance.value, instance.string])
			}
		})
		var serialized = encode(data)
		var deserialized = decode(serialized)
		assert.deepEqual(data, deserialized)
		assert.equal(deserialized.extendedInstance.getDouble(), 8)
	})
	test.skip('text decoder', function() {
			let td = new TextDecoder('ISO-8859-15')
			let b = Buffer.alloc(3)
			let total = 0
			for (var i = 0; i < 256; i++) {
				b[0] = i
				b[1] = 0
				b[2] = 0
				let s = td.decode(b)
				if (!require('cborX-extract').isOneByte(s)) {
					console.log(i.toString(16), s.length)
					total++
				}
			}
	})

	test('structured cloning: self reference', function() {
		let object = {
			test: 'string',
			children: [
				{ name: 'child' }
			]
		}
		object.self = object
		object.children[1] = object
		object.children[2] = object.children[0]
		object.childrenAgain = object.children
		let encoder = new Encoder({
			structuredClone: true,
		})
		var serialized = encoder.encode(object)
		var deserialized = encoder.decode(serialized)
		assert.equal(deserialized.self, deserialized)
		assert.equal(deserialized.children[0].name, 'child')
		assert.equal(deserialized.children[1], deserialized)
		assert.equal(deserialized.children[0], deserialized.children[2])
		assert.equal(deserialized.children, deserialized.childrenAgain)
	})

	test('structured cloning: types', function() {
		let object = {
			error: new Error('test'),
			set: new Set(['a', 'b']),
			regexp: /test/gi,
			float32Array: new Float32Array([2.25,6]),
			uint16Array: new Uint16Array([3,4])
		}
		let encoder = new Encoder({
			structuredClone: true,
		})
		var serialized = encoder.encode(object)
		var deserialized = encoder.decode(serialized)
		assert.deepEqual(Array.from(deserialized.set), Array.from(object.set))
		assert.equal(deserialized.error.message, object.error.message)
		assert.equal(deserialized.regexp.test('TEST'), true)
		assert.equal(deserialized.float32Array.constructor.name, 'Float32Array')
		assert.equal(deserialized.float32Array[0], 2.25)
		assert.equal(deserialized.float32Array[1], 6)
		assert.equal(deserialized.uint16Array.constructor.name, 'Uint16Array')
		assert.equal(deserialized.uint16Array[0], 3)
		assert.equal(deserialized.uint16Array[1], 4)
	})

	test('map/date', function(){
		var map = new Map()
		map.set(4, 'four')
		map.set('three', 3)


		var data = {
			map: map,
			date: new Date(1532219539733),
			farFutureDate: new Date(3532219539133),
			ancient: new Date(-3532219539133),
		}
		let encoder = new Encoder()
		var serialized = encoder.encode(data)
		var deserialized = encoder.decode(serialized)
		assert.equal(deserialized.map.get(4), 'four')
		assert.equal(deserialized.map.get('three'), 3)
		assert.equal(deserialized.date.getTime(), 1532219539733)
		assert.equal(deserialized.farFutureDate.getTime(), 3532219539133)
		assert.equal(deserialized.ancient.getTime(), -3532219539133)
	})
	test('map/date with options', function(){
		var map = new Map()
		map.set(4, 'four')
		map.set('three', 3)
		var data = {
			map: map,
			date: new Date(1532219539011),
		}
		let encoder = new Encoder({
			mapsAsObjects: true,
			useTimestamp32: true,
		})
		var serialized = encoder.encode(data)
		var deserialized = encoder.decode(serialized)
		assert.equal(deserialized.map[4], 'four')
		assert.equal(deserialized.map.three, 3)
		assert.equal(deserialized.date.getTime(), 1532219539000)
	})
	test('decimal float32', function() {
		var data = {
			a: 2.526,
			b: 0.0035235,
			c: 0.00000000000352501,
			d: 3252.77,
		}
		let encoder = new Encoder({
			useFloat32: DECIMAL_FIT
		})
		var serialized = encoder.encode(data)
		assert.equal(serialized.length, 31)
		var deserialized = encoder.decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('numbers', function(){
		var data = {
			bigEncodable: 48978578104322,
			dateEpoch: 1530886513200,
			realBig: 3432235352353255323,
			decimal: 32.55234,
			negative: -34.11,
			exponential: 0.234e123,
			tiny: 3.233e-120,
			zero: 0,
			//negativeZero: -0,
			Infinity: Infinity
		}
		var serialized = encode(data)
		var deserialized = decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('buffers', function(){
		var data = {
			buffer1: new Uint8Array([2,3,4]),
			buffer2: new Uint8Array(encode(sampleData))
		}
		var serialized = encode(data)
		var deserialized = decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('noteencode test', function() {
		const data = {
		  foo: 1,
		  bar: [1, 2, 3, 4, 'abc', 'def'],
		  foobar: {
		    foo: true,
		    bar: -2147483649,
		    foobar: {
		      foo: new Uint8Array([1, 2, 3, 4, 5]),
		      bar: 1.5,
		      foobar: [true, false, 'abcdefghijkmonpqrstuvwxyz']
		    }
		  }
		};
		var serialized = encode(data)
		var deserialized = decode(serialized)
		var deserialized = decode(serialized)
		var deserialized = decode(serialized)
		assert.deepEqual(deserialized, data)
	})

	test('utf16 causing expansion', function() {
		this.timeout(10000)
		let data = {fixstr: 'ᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝ', str8:'ᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝ'}
		var serialized = encode(data)
		deserialized = decode(serialized)
		assert.deepEqual(deserialized, data)
	})
	if (EncoderStream) {
		test('serialize/parse stream', () => {
			const serializeStream = new EncoderStream({
			})
			const parseStream = new DecoderStream()
			serializeStream.pipe(parseStream)
			const received = []
			parseStream.on('data', data => {
				received.push(data)
			})
			const messages = [{
				name: 'first'
			}, {
				name: 'second'
			}, {
				name: 'third'
			}, {
				name: 'third',
				extra: [1, 3, { foo: 'hi'}, 'bye']
			}]
			for (const message of messages)
				serializeStream.write(message)
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					assert.deepEqual(received, messages)
					resolve()
				}, 10)
			})
		})
	}

})
suite('cborX performance tests', function(){
	test('performance JSON.parse', function() {
		var data = sampleData
		this.timeout(10000)
		let structures = []
		var serialized = JSON.stringify(data)
		console.log('JSON size', serialized.length)
		for (var i = 0; i < ITERATIONS; i++) {
			var deserialized = JSON.parse(serialized)
		}
	})
	test('performance JSON.stringify', function() {
		var data = sampleData
		this.timeout(10000)
		for (var i = 0; i < ITERATIONS; i++) {
			var serialized = JSON.stringify(data)
		}
	})
	test('performance decode', function() {
		var data = sampleData
		this.timeout(10000)
		let structures = []
		var serialized = encode(data)
		console.log('CBOR size', serialized.length)
		let encoder = new Encoder({ structures })
		var serialized = encoder.encode(data)
		console.log('cborX w/ record ext size', serialized.length)
		for (var i = 0; i < ITERATIONS; i++) {
			var deserialized = encoder.decode(serialized)
		}
	})
	test('performance encode', function() {
		var data = sampleData
		this.timeout(10000)
		let structures = []
		let encoder = new Encoder({ structures })
		let buffer = Buffer.alloc(0x10000)

		for (var i = 0; i < ITERATIONS; i++) {
			//serialized = encode(data, { shared: sharedStructure })
			encoder.useBuffer(buffer)
			var serialized = encoder.encode(data)
			//var serializedGzip = deflateSync(serialized)
		}
		//console.log('serialized', serialized.length, global.propertyComparisons)
	})
})
