/*! ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  
        /\____                                          THING.JS               
      // ~ / _\_____                            Internet of Wild Things        
     /     \   .. \/                                 version 0.2.2             
    //     /~_____/                                                            
    /// \/  /                                      http://thingjs.org          
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

if (typeof async === 'undefined' || typeof async.setImmediate === 'undefined')
    throw new Error('async missing: https://github.com/caolan/async');

if (typeof jsonld === 'undefined' || typeof jsonld.compact === 'undefined')
    throw new Error('jsonld missing: https://github.com/digitalbazaar/jsonld.js');

var $thing = $thing || {};

$thing.bootstrap = 'browser.js';
$thing.usePaho = true;

$thing.async = async;
$thing.jsonld = jsonld;

$thing.getMicroTime = function() {
    return Date.now() * 1000;
};

if (!!window.chrome) {

    $thing.getThreadId = function(first) {
        first = first || 0;

        var j = 0,
            threadId = [undefined, 'main', 'main'],
            prepareStackTrace = Error.prepareStackTrace
            ;

        first++;

        Error.prepareStackTrace = function(err, frame) {

            if (frame.length > first) {

                threadId[0] = frame[first].getFileName() + 
                    ':' + frame[first].getLineNumber() +
                    ':' + frame[first].getColumnNumber()
                    ;

                for (var i = 1; i < frame.length; i++) {

                    if (frame[i - 1].getFunctionName() === '$thing.$container') {

                        threadId[++j] = frame[i].getFileName() +
                            ':' + frame[i].getLineNumber() +
                            ':' + frame[i].getColumnNumber()
                            ;

                        if (j > threadId.length) break;

                    }
                }

            }
             
        };

        new Error().stack;

        Error.prepareStackTrace = prepareStackTrace;

        return threadId;
    };

}
else {

    $thing.getBacktrace = function(first) {
        first = first || 0;

        try {
            0(); 
        }
        catch(e) {
            var trace = e.stack
                    .replace(/Object\.\$thing\.\$container [^\r\n\t\f ]+/g, '$container:0:0')
                    .replace(/\$thing\.\$container@[^\r\n\t\f ]+/g, '$container:0:0')
                    .replace(/\$container@[^\r\n\t\f ]+/g, '$container:0:0')
                ;

            if ((trace = trace.match(/[^\r\n\t\f\( ]+\d\:\d+/g)) !== null)
                return trace.slice(1 + first);
            else if ((trace = trace.match(/\s+at /g)) !== null)
                return trace.slice(1 + first);
            return [];
        }
    };

    $thing.getThreadId = function(first) {
        var j = 0,
            threadId = [undefined, 'main', 'main'],
            frame = $thing.getBacktrace(first + 1)
            ;

        threadId[0] = frame[0];

        for (var i = 1; i < frame.length; i++) {

            if (frame[i - 1].indexOf('$container:0:0') > -1) {

                threadId[++j] = frame[i];

                if (j > threadId.length) break;

            }

        }

        return threadId;
    };

}

$thing.createBuffer = function(byteArray) {
    return {
        buf: byteArray,
        toString: function() {
            return String.fromCharCode.apply(
                null, 
                new Uint16Array(byteArray)
            );
        }
    };
};
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

/** @namespace $thing */

$thing.Mash = function() {
    // Mash by Johannes Baagoe <baagoe@baagoe.com>
    var n = 0xefc8249d;
    var mash = function(data) {
        data = data.toString();
        for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000; 
        }
        return (n >>> 0) * 2.3283064365386963e-10; 
    };
    return mash;
};

/**
 * @memberOf $thing
 * @method create64BitId
 */
$thing.create64BitId = function() {
    var h1 = new $thing.Mash(),
        h2 = new $thing.Mash()
        ;

    for (var i = 0; i < arguments.length; i++) 
        h1(arguments[i] || '');

    return  h1('').toString(16).split('.')[1] +
            h2($thing.getMicroTime()).toString(16).split('.')[1]
            ;
};

/**
 * @memberOf $thing
 * @method merge
 */
$thing.merge = function() {
    var args = $thing.arrayDup(arguments),
        obj = args[0],
        i = 1
        ;
        
    for(; i < args.length; i++)
        if (args[i] !== undefined)
            for(var k in args[i])
                (obj[k] === undefined)
                    ? obj[k] = args[i][k]
                    : undefined
                    ;

    return obj;
};

/**
 * @memberOf $thing
 * @method arrayDup
 */

$thing.arrayDup = function(src, length, destroySrc, retainLength) {
    var i,
        l = length || src.length,
        dest = new Array(length || src.length)
        ;

    if (destroySrc === undefined || destroySrc === false)
        for (i = 0; i < l; i++)
            dest[i] = src[i];
    else {
    
        for (i = 0; i < l; i++) {
            dest[i] = src[i];
            src[i] = undefined;
        }
    
        if (retainLength === undefined)
            src.length = 0;
        else if (src.length > retainLength)
            src.length = retainLength;

    }

    return dest;
};

/**
 * @memberOf $thing
 * @method arrayAppend
 */

$thing.arrayAppend = function(src, value) {
    var l = src.length,
        dest = new Array(l + 1)
        ;

    for (var i = 0; i < l; i++)
        dest[i] = src[i];

    dest[l] = value;

    return dest;
};

/**
 * @memberOf $thing
 * @method arrayToObject
 */

$thing.arrayToObject = function(values, predicates, cbTestFunc) {
    var obj = {};

    predicates = predicates || [];

    for (var i in values)
        if (!cbTestFunc || cbTestFunc(values[i]))
            obj[predicates[i] || i] = values[i];

    return obj;
};

$thing.containers = {
    main: {
        source: '$thing',
        heap: [] 
    }    
};

/**
 * @memberOf $thing
 * @method $container
 */
$thing.$container = function(cb) {
    $thing.getContainer($thing.getThreadId(1));
    cb();
};

/**
 * @memberOf $thing
 * @method getContainer
 */
$thing.getContainer = function(threadId) {
    var container = $thing.containers[threadId[1]],
        parent = $thing.containers[threadId[2]]
        ;

    if (container === undefined) {

        container = $thing.containers[threadId[1]] = {
            heap: []
        };

        if (threadId[1] !== threadId[2] && parent !== undefined)
            for (var k in parent.heap)
                if (parent.heap[k].isAbstract)
                    container.heap.push(parent.heap[k]);

    }

    return container;
};

/**
 * @memberOf $thing
 * @method attach
 */
$thing.attach = function(def, heap) {

    if (def._id !== undefined) 
        return def._id;
    else {
        var length = heap.length;
        
        while(heap.length !== 0 &&
            heap[heap.length - 1]._refCount === 0
        ) 
            (heap.pop())._id = undefined;
        
        if (!heap.length || heap.length !== length)
            def._id = heap.push(def) - 1;
        else {
            def._id = undefined;
            
            for(var i = heap.length - 1;
                i > -1 && def._id === undefined;
                i--
            )
                if (heap[i]._refCount === 0) {
                    heap[i]._id = undefined;
                    heap[def._id = i] = def;
                }
            
            if (def._id === undefined)
                def._id = heap.push(def) - 1;
        }
        
        return def._id;
    }
};

/**
 * @memberOf $thing
 * @method search
 */
$thing.search = function(obj, heap) {
    var match;
    
    for(var i = heap.length - 1; i > -1; i--) {
        if (heap[i]._refCount > 0) {
            for(var k in obj)
                if (!(match = obj[k] === heap[i][k]))
                    break;
                
                if (match)
                    return heap[i];
            }
        }
    
    return undefined;
};

/**
 * @memberOf $thing
 * @method searchMeta
 */
$thing.searchMeta = function(obj, predicate) {
    var type = 'string',
        cb = arguments[2],
        meta = (obj.getMeta !== undefined)
            ? obj.getMeta()
            : obj._meta
        ;
    
    switch(arguments[2]) {
        case 'int':
        case 'boolean':
        case 'string':
            type = arguments[2];
            cb = arguments[3];
    }
    
    meta.forEach(function(item) {
        item = item.match(/\S+/g);
        if (item !== null && item[0] === predicate) {
            item = item.slice(1);
            
            switch(type) {
                case 'int':
                    if (!isNaN(item[0] = parseInt(item[0])))
                        cb.apply(obj, item);
                    break;
                
                case 'boolean':
                    switch(item[0].toLowerCase()) {
                        case 'true':
                            item[0] = true;
                            cb.apply(obj, item);
                            break;
                        
                        case 'false':
                            item[0] = false;
                            cb.apply(obj, item);
                            break;
                    }
                    break;
                
                default:
                    cb.apply(obj, item);
            }
        }
    });
};

/**
 * @memberOf $thing
 * @method cbBuilder
 */
$thing.cbBuilder = function(threadId, self, args, cbDone) {
    cbDone = cbDone || function(){};
    
    $thing.Tasker.thread(threadId);
        
    if (args.length === 0) cbDone();
    else {

        return function() {
                
            $thing.agent(self)
                .apply($thing, args)
                .apply($thing, arguments.length ? arguments : [$thing.Container]);
            
            cbDone();
        };

    }
    
};

/**
 * @method agent
 * @param {*}
 */
var agent = $thing.agent = function() {
    var cb,
        threadId,
        selector,
        filter,
        pattern,
        selects,
        callChain,
        inlineDef,
        inlineThreadId,
        inlineObj = $thing.Container,
        refCount = 0
        ;

    switch(arguments.length) {
        case 0:
            return $thing.Tasker.thread($thing.getThreadId(1));
        
        case 2:
            if (typeof arguments[1] === 'function')
                cb = arguments[1];

            /* falls through */    
        case 1:
            if (arguments[0] instanceof $thing.Pattern) {
                pattern = arguments[0];
                threadId = pattern.getThreadId();
                selector = new $thing.Selector(threadId, pattern, true);
                break;
            }
            else if (   typeof arguments[0] === 'object' &&
                        arguments[0].getInterfaces !== undefined
            ) {
                selector = arguments[0];
                threadId = selector.getThreadId();
                break;
            }

            /* falls through */
        default:            
            var def = new $thing.Definition(
                $thing.Container,
                $thing.Agent,
                threadId = $thing.getThreadId(1),
                $thing.arrayDup(arguments)
            );

            if (def.class !== undefined)
                return def.refObject(function(obj, cbRelease) {
                    cbRelease();
                });
            else {
                selects = [];
                
                $thing.searchMeta(def, 'select', function() {
                    selects.push($thing.arrayDup(arguments));
                });
                
                selector = new $thing.Selector(
                    threadId,
                    pattern = (selects.length) ? selects : def.name,
                    true
                );
            }
    }

    filter = function(filters, callArgs) {

        if (arguments.length === 2 &&
            typeof callArgs[0] === 'string' &&
            callArgs[0].charAt(0) === '^'
        ) {

            if (inlineDef === undefined) {
                inlineDef = {};
                inlineThreadId =  $thing.getThreadId(2);
            }

            inlineDef[callArgs[0].substring(1)] = callArgs[1];

            return callChain;
        }

        return function() {
            var obj;

            switch(arguments.length) {
                case 0:
                    if (inlineDef === undefined) 
                        obj = inlineObj;
                    else {

                        obj = inlineObj = new $thing.Definition(
                            $thing.Container,
                            $thing.Agent,
                            inlineThreadId,
                            [inlineDef]
                        );

                        inlineDef = undefined;

                    }

                    break;
                
                case 1:
                    if (typeof arguments[0] === 'object' &&
                        arguments[0].getInterfaces !== undefined
                    ) {
                        obj = arguments[0];
                        break;
                    }
                    
                    /* falls through */ 
                default:
                    var def = new $thing.Definition(
                            $thing.Container,
                            $thing.Agent,
                            $thing.getThreadId(1),
                            $thing.arrayDup(arguments)
                        )
                        ;
                    
                    if (def.class !== undefined) 
                        obj = def;
                    else {
                        selects = [];
                        
                        $thing.searchMeta(def, 'select', function() {
                            selects.push($thing.arrayDup(arguments));
                        });
                        
                        obj = new $thing.Pattern(
                            threadId,
                            (selects.length) ? selects : def.name
                        );
                    }
                    
                    break;
            }

            obj.refObject(function(obj, cbRelease) {

                refCount++;

                if (pattern === undefined) {

                    selector.dispatch(
                        {   filters: filters,
                            method: callArgs[0],
                            args: callArgs.slice(1)
                        },
                        function() {

                            return $thing.cbBuilder(
                                threadId,
                                obj,
                                arguments,
                                function() {

                                    if (--refCount === 0) {

                                        if (cb !== undefined) cb();

                                        cbRelease();

                                    }

                                }
                            );
                        }
                    );

                }
                else {

                    selector.select();

                    selector.schedule();

                    selector.dispatch(
                        {   filters: filters,
                            method: callArgs[0],
                            args: callArgs.slice(1)
                        },
                        function() {

                            return $thing.cbBuilder(
                                threadId,
                                obj,
                                Array.prototype.slice.call(
                                    arguments,
                                    0,
                                    arguments.length - 1
                                ),
                                arguments[arguments.length - 1]
                            );
                        },
                        function() {

                            if (refCount > 1) refCount--;
                            else {

                                $thing.async.setImmediate(function() {

                                    if (--refCount === 0) {

                                        if (cb !== undefined) cb();

                                        cbRelease();
                                    
                                        selector.release();
                                    
                                    }

                                });

                            }

                        }
                    );

                }

            });

            return callChain;
        };
    };

    callChain = function() {

        return filter($thing.Filter.ALL, $thing.arrayDup(arguments));
    };

    callChain.all = callChain;

    callChain.first = function() {

        return filter($thing.Filter.FIRST, $thing.arrayDup(arguments));
    };

    callChain.last = function() {

        return filter($thing.Filter.LAST, $thing.arrayDup(arguments));
    };

    return callChain;
};
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

/**
 * @memberOf $thing
 * @method switchContext
 */
$thing.switchContext = function(
    functString,
    parentOrdinal,
    superOrdinal,
    ordinal,
    superName,
    methodName
) {
    functString = functString || this.$vtable[ordinal][methodName].toString();

    return (
        functString.indexOf('$parent') > -1 ||
        functString.indexOf('$super') > -1
    )
        ? function() {
            var ret,
                $parent = this.$parent,
                $super = this.$super
                ;
            
            this.$parent = this.$vtable[parentOrdinal] || $parent;
            this.$super = this.$vtable[superOrdinal][superName];

            ret = this.$vtable[ordinal][methodName].apply(this, arguments);

            this.$parent = $parent;
            this.$super = $super;
            
            return ret;
        }
        : this.$vtable[ordinal][methodName]
        ;
};

/**
 * @memberOf $thing
 * @method switchParentContext
 */
$thing.switchParentContext = function(
    functString,
    parentOrdinal,
    ordinal,
    methodName
) {
    functString = functString || this.$vtable[ordinal][methodName].toString();

    return (
        functString.indexOf('$parent') > -1
    )
        ? function() {
            var ret,
                $parent = this.$parent
                ;
            
            this.$parent = this.$vtable[parentOrdinal] || this.$parent;

            ret = this.$vtable[ordinal][methodName].apply(this, arguments);

            this.$parent = $parent;
            
            return ret;
        }
        : this.$vtable[ordinal][methodName]
        ;
};

/**
 * @class Object
 * @memberOf $thing
 */
$thing.Object = function(){};

/**
 * Return object name
 * @memberOf $thing
 * @method Object#getName
 * @returns {string}
 */
$thing.Object.prototype.getName = function(){
    return 'Object';
};

/**
 * @memberOf $thing
 * @method Object.inherit
 * @param {object} obj
 * @param {object} parent
 * @returns {object}
 */
var $inherit = $thing.Object.inherit = function(obj, parent) {
    var i,
        j,
        k,
        v,
        functString,
        signature,
        signatures = {},
        ontology = {},
        inherit = this.prototype
        ;
        
    function $obj() {
        /*jshint validthis:true */
        (this.init !== undefined)
            ? this.init.apply(this, arguments)
            : undefined
            ;
    }

    function replace() {
        return (obj['$' + arguments[1]] !== undefined)
            ? obj['$' + arguments[1]]
            : arguments[0]
            ;
    }
    
    $obj.prototype = new this();
    $obj.prototype.constructor = $obj;
    $obj.prototype.$vtable = ($obj.prototype.$vtable !== undefined)
        ? $obj.prototype.$vtable.slice()
        : []
        ;
    
    var ordinal = $obj.prototype.$vtable.push(obj) - 1,
        parentOrdinal = $obj.prototype.$vtable.push(parent) - 1,
        superOrdinal = $obj.prototype.$vtable.push(inherit) - 1
        ;
    
    $obj.inherit = $inherit;
    
    for (i in obj) {
        switch(i) {
            case '$vtable':
                /* falls through */
            case '$signatures':
                /* falls through */
            case '$ontology':
                /* falls through */                
            case '$owner':
                /* falls through */
            case '$parent':
                /* falls through */
            case '$super':
                /* falls through */
                continue;
        }
        
        v = obj[i];
        k = i.replace(/\$\((.+?)\)/g, replace);
        j = k.substring(k.indexOf('.') + 1);
        
        if (typeof v !== 'function') 
            if (k.charAt(0) === '$')
                $obj.prototype[k] = v; 
            else
                ontology[k] = v;
        else {
            functString = v.toString();
            signature = functString.match(/function[^(]*\(([^)]*)\)/);
            
            (typeof inherit[k] !== 'function')
                ? (typeof inherit[j] !== 'function')
                    ? $obj.prototype[k] = $thing.switchParentContext.apply(
                        $obj.prototype,
                        [   functString,
                            parentOrdinal,
                            ordinal,
                            i
                        ]
                    )
                    : $obj.prototype[k] = $thing.switchContext.apply(
                        $obj.prototype,
                        [   functString,
                            parentOrdinal,
                            superOrdinal,
                            ordinal,
                            j,
                            i
                        ]
                    )
                : $obj.prototype[k] = $thing.switchContext.apply(
                    $obj.prototype,
                    [   functString,
                        parentOrdinal,
                        superOrdinal,
                        ordinal,
                        k,
                        i
                    ]
                )
                ;
            
            if (signature !== null)
                signatures[k] = (signature[1].length)
                    ? signature[1].split(/,\s*/)
                    : []
                    ;
        }
    }
    
    $obj.prototype.$owner = parent || $obj.prototype.$owner;

    $obj.prototype.$signatures = $thing.merge(
        signatures,
        $obj.prototype.$signatures
    );

    $obj.prototype.$ontology = $thing.merge(
        ontology,
        $obj.prototype.$ontology
    );

    return $obj;
};
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.Base = $thing.Object.inherit({

    /**
     * @constructs Base
     * @mixes $thing.Object
     * @memberOf $thing
     */
    init: function() {},

    getName: function() {
        return 'Base';
    },

    /**
     * Define an object property
     * @memberOf $thing
     * @method Base#property
     * @param {string} prop property name
     * @param {function} [cbGetter]
     * @param {function} [cbSetter]
     */
    property: function(prop, cbGetter, cbSetter) {
        var obj = {};

        (cbGetter)
            ? obj.get = cbGetter
            : undefined
            ;
        
        (cbSetter)
            ? obj.set = cbSetter
            : undefined
            ;
    
        Object.defineProperty(this, prop, obj);
    },

    bind: function(funct) {
        var self = this;
        
        return function() {
            return funct.apply(self, arguments);
        };
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.BURST_DECAY =  5 * 60 * 1000000;

$thing.State = {
    EXPR_AND:       1,
    EXPR_NOT:       2,
    EXPR_OR:        3,
    DEF_DESC:       1,
    DEF_NAME:       2,
    DEF_SOURCE:     4,
    DEF_EXTENDS:    16,
    DEF_IMPLEMENTS: 64,
    DEF_USES:       128,
    DEF_META:       256,
    DEF_NOP:        512,
    DEF_END:        1024,
    LIFE_INITIATED: 2048,
    LIFE_ACTIVE:    4096,
    LIFE_WAITING:   8192,
    LIFE_SUSPENDED: 16384,
    LIFE_DELETED:   32768,
    LIFE_TRANSIT:   65536,
    LIFE_BLOCKED:   131072
};

$thing.Definition = $thing.Base.inherit({

    $metaHandlers: {

        mobile: function() {
            this._isMobile = true;
        },

        passive: function() {
            this._isPassive = true;
        },

        singleton: function() {
            this._singleton = this._singleton || this._source;
        },

        catchall: function(catchall, methodName) {
            this._substitute.$__catchall__ = methodName;
        }

    },

    getName: function() {
        return 'Definition';
    },

    /**
     * @constructs Definition
     * @mixes $thing.Base
     * @memberOf $thing
     * @param {object} parent
     * @param {object} super
     * @param {string[]} threadId
     * @param {string[]} stack
     */
    init: function(parent, _super, threadId, stack) {
        var k,
            item,
            search,
            self = this,
            heap = $thing.getContainer(threadId).heap
            ;

        this.$super();
        
        this._state = $thing.State.DEF_DESC;
        this._threadId = threadId;
        this._parent = parent;
        this._children = [];
        this._meta = [];
        this._interfaces = [];
        this._uses = [];
        this._super = _super;
        this._source = threadId[0];
        this._refCount = 0;
        this._isAgent = this._super === $thing.Agent;
        this._isAbstract = false;
        this._isPassive = false;
        this._isMobile = false;

        this._lastBurstTime = 0;
        this._burstAverage = 1;

        this._waitTime = $thing.getMicroTime();

        this._interfaces = [
            $thing.create64BitId(this._source, heap.length),
            this._source
        ];

        this._substitute = {
            $id: this._interfaces[0],
            $source: this._source
        };
        
        this.parseStack(stack);
        
        if (this._extends !== undefined) {
            item = $thing.search({_name: this._extends}, heap);
            
            if (item === undefined) throw new Error(
                'DefinitionError: Super Class \'' +
                this._extends + '\' is not defined'
            );
            else {
                this._super = item._class;
                this._singleton = item._singleton;
                for(k = item._meta.length - 1; k > -1; k--)
                    this._meta.unshift(item._meta[k]);
            }
            
            (this._class === undefined)
                ? this._class = {}
                : undefined
                ;
        }
        
        this._meta.forEach(function(item) {
            var args = item.split(/ (.+)?/);
            
            (self.$metaHandlers[args[0]] !== undefined)
                ? self.$metaHandlers[args[0]].apply(self, args)
                : undefined
                ;
        });
        
        if (this._isAbstract)
            search = {
                _name: this._name,
                _source: this._source
            };
        else if (this._singleton !== undefined)
            search = {
                _name: this._name,
                _singleton: this._singleton
            };
        
        if (search !== undefined && (item = $thing.search(search, heap))) {
            this.refObject = item.bind(item.refObject);
            
            this.property('class', function() {
                return item._class;
            });
            
            this.property('refCount', function() {
                return item._refCount;
            });
            
            this.property('isAbstract', function() {
                return item._isAbstract;
            });
            
            this.property('isPassive', function() {
                return item._isPassive;
            });
                
            this.property('instance', function() {
                return item._instance;
            });
                
            this.property('state', function() {
                return item._state;
            });
                
            this.property('name', function() {
                return item._name;
            });

            this.property('parent', function() {
                return item._parent;
            });

            this.property('threadId', function() {
                return item._threadId;
            });

        }
        else {
            
            this._childrenWrapper = {
                push: this.bind(this._pushChild),
                forEach: this.bind(this._forEachChild)
            };
            
            Object.defineProperty(this._childrenWrapper, 'length', {
                get: this.bind(this._countChildren)
            });
            
            (this._factory !== undefined)
                ? this._class = this._factory.apply($thing, this._uses)
                : undefined
                ;
            
            if (this._class !== undefined) {
                for(k in this._substitute)
                    this._class[k] = this._substitute[k]
                    ;
                
                var interfaces = (this._name !== undefined)
                    ? this._interfaces.concat(this._name)
                    : this._interfaces
                    ;
                
                this._class.getInterfaces = function() {
                    return this.$super().concat(interfaces);
                };
                
                this._class = this._super.inherit(
                    this._class,
                    parent,
                    this._isMobile
                );
                
                $thing.attach(this, heap);
            }
            
            this.property('class', function() {
                return this._class;
            });
            
            this.property('refCount', function() {
                return this._refCount;
            });
            
            this.property('isAbstract', function() {
                return this._isAbstract;
            });
            
            this.property('isPassive', function() {
                return this._isPassive;
            });
            
            this.property('instance', function() {
                return this._instance;
            });
            
            this.property('state', function() {
                return this._state;
            });
            
            this.property('name', function() {
                return this._name;
            });
            
            this.property('parent', function() {
                return this._parent;
            });

            this.property('threadId', function() {
                return this._threadId;
            });

        }

    },

    _forEachChild: function(cb) {
        this._children.forEach(function(args) {
            (args[0].getHeapId !== undefined)
                ? cb.apply(undefined, args)
                : undefined
                ;
        });
    },

    _pushChild: function(obj) {
        var id = obj.getHeapId();
    
        for(var i = 0; i < this._children.length; i++) {

            if (this._children[i][0].getHeapId === undefined)
                this._children.splice(i, 1);

            else if (this._children[i][0].getHeapId() === id)
                return this._children.length;

        }
    
        return this._children.push(arguments);
    },

    _countChildren: function() {
        var length = 0;
        
        this._forEachChild(function(child) {
            if (child.getRefCount())
                length++;
        });
        
        return length;
    },

    parseStack: function(stack) {
        var item,
            match,
            self = this
            ;
        
        function replace() {
            return (arguments[1] === undefined)
                ? stack.shift()
                : self._substitute['$' + arguments[1]] = stack.shift()
                ;
        }
        
        while(  this._state !== $thing.State.DEF_END &&
                (item = stack.shift()) !== undefined
        ) {
        
            switch(typeof item) {
                case 'function':
                    this._state = $thing.State.DEF_END;
                    this._factory = item;
                    continue;

                case 'object':
                    this._state = $thing.State.DEF_END;
                    this._class = item;
                    continue;
            }
            
            switch(item) {
                case 'abstract':
                    this._isPassive = this._isAbstract = true;
                    continue;

                case 'source':
                    this._state = $thing.State.DEF_SOURCE;
                    continue;

                case 'extends':
                    this._state = $thing.State.DEF_EXTENDS;
                    continue;

                case 'implements':
                    this._state = $thing.State.DEF_IMPLEMENTS;
                    continue;

                case 'uses':
                    this._state = $thing.State.DEF_USES;
                    continue;

                default:
                    (this._state === $thing.State.DEF_META || item.charAt(0) === '@')
                        ? this._state = $thing.State.DEF_META
                        : (item.match(/ /))
                            ? this._state = $thing.State.DEF_DESC
                            : undefined
                            ;
            }
            
            switch(this._state) {

                case $thing.State.DEF_DESC:
                    item = item.replace(/\$\((.+?)\)|\$/g, replace);
                    
                    item = item.split(' @');

                    stack = item[0].split(/ +/).filter(Boolean).concat(
                        (item[1] !== undefined)
                            ? ['@' + item[1]].concat(stack)
                            : stack
                    );

                    (this._name === undefined)
                        ? this._state = $thing.State.DEF_NAME
                        : this._state = $thing.State.DEF_NOP
                        ;
                    break;
                    
                case $thing.State.DEF_META:
                    item = item.replace(/\$\((.+?)\)|\$/g, replace);
                    
                    if (item.charAt(item.length - 1) === '+') {
                        stack = [
                            item.slice(0, -1) + stack.shift()
                        ].concat(stack);
                    }
                    else {
                        this._state = $thing.State.DEF_DESC;
                        this._meta.push(item.slice(1));
                    }
                    
                    break;
                
                case $thing.State.DEF_NAME:
                    this._name = item || this._name;
                    break;
                
                case $thing.State.DEF_SOURCE:
                    this._source = item || this._source;
                    break;
                
                case $thing.State.DEF_EXTENDS:
                    this._extends = item || this._extends;
                    break;
                
                case $thing.State.DEF_IMPLEMENTS:
                    ((match = item.match(/^\/(.*?)\/([gimy]*)$/)) !== null)
                        ? this._interfaces.push(
                            new RegExp(match[1], match[2])
                        )
                        : this._interfaces.push(item)
                        ;
                    break;
                
                case $thing.State.DEF_USES:
                    this._uses.push($thing.agent(item));
                    break;
            }
        }
    },

    patchObject: function(obj) {
        var self = this;
        
        obj.refObject = this.bind(this.refObject);
        
        obj.getRefCount = function() {
            return self._refCount;
        };
        
        obj.getHeapId = function() {
            return self._id;
        };
        
        obj.getName = function() {
            return self._name;
        };
        
        obj.getSource = function() {
            return self._source;
        };
        
        obj.getChildren = function() {
            return self._childrenWrapper;
        };
        
        obj.getState = function() {
            return self._state;
        };
        
        obj.setState = function() {
            
            for (var k in arguments)
                self._state |= arguments[k];

            var states = $thing.arrayDup(arguments);
            
            this.getChildren().forEach(function(child) {
                child.setState(states);
            });

        };
        
        obj.unsetState = function() {
            
            for (var k in arguments)
                self._state  &= ~arguments[k];

            var states = $thing.arrayDup(arguments);

            this.getChildren().forEach(function(child) {
                child.unsetState(states);
            });
            
        };

        obj.getThreadId = function() {
            return $thing.arrayDup(self._threadId);
        };
        
        obj.getMeta = function() {
            return self._meta;
        };
        
        obj.isAbstract = function() {
            return self._isAbstract;
        };

        obj.waitTime = function() {
            self._waitTime = $thing.getMicroTime();
        };

        obj.burstTime = function(ticks) {
            var now = $thing.getMicroTime();

            if (!self._lastBurstTime)
                self._burstAverage = ticks;
            else {
                var a = 1 - (Math.exp(-(now - self._lastBurstTime) / $thing.BURST_DECAY * 60));

                self._burstAverage = a * ticks + (1 - a) * self._burstAverage;            
            }

            self._lastBurstTime = now;

            return self._burstAverage;
        };

        obj.getResponseRatio = function() {
            var now = $thing.getMicroTime();

            return (now - self._waitTime + self._burstAverage) / self._burstAverage;
        };
        
        return obj;
    },

    unpatchObject: function(obj) {
        
        delete obj.refObject;
        delete obj.getRefCount;
        delete obj.getHeapId;
        delete obj.getName;
        delete obj.getSource;
        delete obj.getChildren;
        delete obj.getState;
        delete obj.setState;
        delete obj.unsetState;
        delete obj.getThreadId;
        delete obj.getMeta;
        delete obj.isAbstract;
        delete obj.waitTime;
        delete obj.burstTime;
        delete obj.getResponseRatio;
        
        return obj;
    },

    refObject: function(cb) {
        var self = this;
        
        this.parent.refObject(function(parent, cbRelease) {
            var constructed;
            
            if (self._refCount)
                self._refCount++;
            else {
                self._refCount = constructed = 1;
                self._instance = self.patchObject(new self._class());
                self._instance.setState($thing.State.LIFE_INITIATED);
            }
            
            if (constructed && self._isAgent && !self._isAbstract)
                self._instance.setup();
            cb(
                self._instance,
                function() {
                    if (self._isAgent && self._isPassive) return;
                    else if (--self._refCount !== 0) cbRelease();
                    else {
                        if (self._isAgent)
                            self._instance.takedown(
                                function() {
                                    self._children = [];
                                    self.unpatchObject(self._instance);
                                    
                                    delete self._instance;
                                    
                                    cbRelease();
                                }
                            );
                        else {
                            self._children = [];
                            self.unpatchObject(self._instance);
                            
                            delete self._instance;
                            
                            cbRelease();
                        }
                    }
                }
            );
        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';  

/**
 * @class Delegate
 * @mixes $thing.Base
 * @memberOf $thing
 */
$thing.Delegate = $thing.Base.inherit({

    init: function() {
        this.$super();

    },

    getName: function() {
        return 'Delegate';
    },

    /**
     * @memberOf $thing
     * @method Delegate#getInterfaces
     * @returns {string[]}
     */
    getInterfaces: function() {
        return [];
    },

    /**
     * @memberOf $thing
     * @method Delegate#matchInterface
     * @param {string} pattern
     * @param {string} source
     * @returns {string}
     */
    matchInterface: function(pattern) {
        var interfaces = this.getInterfaces();

        for(var i = 0; i < interfaces.length; i++)
            if ((interfaces[i] instanceof RegExp)
                ? pattern.match(interfaces[i]) !== null
                : interfaces[i] === pattern
            ) break;
            
        return interfaces[i];
    },

    /**
     * @memberOf $thing
     * @method Delegate#refObject
     */
    refObject: function(cb) {
        cb(this, function(){});
    },

    /**
     * @memberOf $thing
     * @method Delegate#dispatch
     * @param {object} call
     */
    dispatch: function(call, cb) {
        var method,
            signature,
            predicates,
            args,
            thisHasOntology = false,
            argHasContext = false,
            self = this
            ;

        cb = cb || function() {};
            
        // Don't dispatch to unpatched delegates
        if (typeof this.getRefCount === 'undefined') return cb();

        // Don't dispatch to methods with $ prefix 
        if (call.method.charAt(0) === '$') return cb(); 

        // Check for method name prefixed with interface
        (this[method = call.interface + '.' + call.method] === undefined)
            ? (this[method = call.method] === undefined)
                ? method = undefined
                : undefined
            : undefined
            ;

        // Check for ontology
        for (thisHasOntology in this.$ontology) break;

        // Check for atleast 1 arg with @context
        if (thisHasOntology)
            for (var k in call.args)
                if (call.args[k].constructor === Object && 
                    typeof call.args[k]['@context'] !== 'undefined'
                ) {
                    argHasContext = true;
                    break;
                }

            // Check method has a name
        (   method === undefined ||
            // Does the signature for the method exist
            (signature = this.$signatures[method]) === undefined ||
            // Signature must have atleast 1 argument
            signature.length < 1 ||
            // Last argument of signature must be prefixed with $ 
            signature[signature.length - 1].charAt(0) !== '$' ||
            // Number of signature arguments must match the number of
            // call arguments plus callback object
            signature.length !== call.args.length + 1
        )
            // Didn't match, check for catch all
            ? ( this[method = this.$__catchall__] === undefined ||
                // Catch all signature must exist
                (signature = this.$signatures[method]) === undefined ||
                // Last argument is prefixed with $
                signature[1].charAt(0) !== '$' ||
                // 2 arguments
                signature.length !== 2
            )
                // Didn't match, skip call
                ? cb()
                // Matched, call catch all
                : this[this.$__catchall__].apply(
                    this,
                    [call.args, cb]
                )
            // Matched
            : (!thisHasOntology || !argHasContext || this.$signatures[method].length === 1)
                // 0 call arguments, empty ontology or no arg @context, make call
                ? this[method].apply(this, $thing.arrayAppend(call.args, cb))
                // Compact with ontology 
                : $thing.jsonld.compact({
                        '@graph': 
                            (predicates = Object.keys(
                                args = $thing.arrayToObject(
                                    call.args, 
                                    this.$signatures[method],
                                    function(value) {
                                        return value && 
                                            value.constructor === Object &&
                                            typeof value['@context'] !== 'undefined'
                                            ;
                                    }
                                )
                            ))
                            .map(function(k) {
                                return args[k];
                            })
                    },
                    this.$ontology, {
                        graph: true
                    },
                    function(err, graph) {
                        // On error, skip call
                        if (err) return cb(); 

                        graph = graph['@graph'];
                    
                        // Skip call if they don't match
                        if (graph.length !== predicates.length) cb();
                        else {
                            // All ok, merge and make call

                            graph = $thing.merge(
                                $thing.arrayToObject(
                                    graph,
                                    predicates
                                ),
                                $thing.arrayToObject(
                                    call.args,
                                    self.$signatures[method]
                                )
                            );

                            args = new Array(self.$signatures[method].length);

                            for (   var i = 0; 
                                    i < self.$signatures[method].length - 1; 
                                    i++
                            )
                                args[i] = graph[self.$signatures[method][i]];

                            args[args.length - 1] = cb;

                            self[method].apply(self, args);

                        }

                    }
                )
                ;
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';
    
$thing.Pattern = $thing.Delegate.inherit({

    getName: function() {
        return 'Pattern';
    },

    /**
     * @constructs Pattern
     * @mixes $thing.Delegate
     * @memberOf $thing
     * @param {[]} threadId
     * @param {(string|string[])} pattern
     */
    init: function(threadId, pattern) {
        this.$super();
        this._threadId = threadId;
        this._pattern = pattern;
    },

    /**
     * @memberOf $thing
     * @method Pattern#getThreadId
     * @returns {[]}
     */
     getThreadId: function() {
        return this._threadId;
     },

    /**
     * @memberOf $thing
     * @method Pattern#toArray
     * @returns {string[]}
     */
    toArray: function() {
        return (this._pattern instanceof Array)
            ? this._pattern
            : [[this._pattern]]
            ;
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

/**
 * @class Agent
 * @mixes $thing.Delegate
 * @memberOf $thing
 */
$thing.Agent = $thing.Delegate.inherit({

    getName: function() {
        return 'Agent';
    },

    getInterfaces: function() {
        return ['Agent'];
    },

    /**
     * @memberOf $thing
     * @method Agent#setup
     */
    setup: function(cb) {
        this.setState($thing.State.LIFE_ACTIVE);
        this.doActivate(cb);
    },

    /**
     * @memberOf $thing
     * @method Agent#takedown
     */
    takedown: function(cb) {
        this.doDelete(cb);
    },

    /**
     * @memberOf $thing
     * @method Agent#doActivate
     */
    doActivate: function(cb) {
        this.unsetState($thing.State.LIFE_SUSPENDED);
        if (cb) cb();
    },

    /**
     * @memberOf $thing
     * @method Agent#doDelete
     */
    doDelete: function(cb) {
        this.setState($thing.State.LIFE_DELETED);
        if (cb) cb();
    },

    /**
     * @memberOf $thing
     * @method Agent#doSuspend
     */
    doSuspend: function(cb) {
        this.setState($thing.State.LIFE_SUSPENDED);
        if (cb) cb();
    },

    /**
     * @memberOf $thing
     * @method Agent#doWait
     */
    doWait: function(cb) {
        this.setState($thing.State.LIFE_WAITING);
        if (cb) cb();
    },

    /**
     * @memberOf $thing
     * @method Agent#doWake
     */
    doWake: function(cb) {
        this.unsetState($thing.State.LIFE_WAITING);
        if (cb) cb();
    },

    /**
     * @memberOf $thing
     * @method Agent#addBehaviour
     * @param {*}
     * @returns {$thing.Behaviour}
     */
    addBehaviour: function() {
        var obj,
            reset,
            self = this,
            threadId = $thing.getThreadId(1),
            args = $thing.arrayDup(arguments),
            def = new $thing.Definition(
                this,
                $thing.Behaviour,
                threadId,
                args
            )
            ;

        if (def.class !== undefined) {
            var funct = function() {

                (!def.refCount)
                    ? def.refObject(function(instance, cbRelease) {
                        $thing.attach(def);
                        obj = instance;
                        self.getChildren().push(obj, cbRelease);
                    })
                    : obj = def.instance
                    ;
                    
                obj.unsetState(
                    $thing.State.LIFE_WAITING |
                    $thing.State.LIFE_SUSPENDED |
                    $thing.State.LIFE_DELETED |
                    $thing.State.LIFE_TRANSIT |
                    $thing.State.LIFE_BLOCKED
                );
                
                obj.setState(self.getState() | $thing.State.LIFE_ACTIVE);
                
            };
            
            funct();
            
            reset = obj.reset;
            
            obj.reset = function() {
                funct();
                reset.apply(obj, arguments);
            };

            $thing.async.setImmediate(function() {
                $thing.Tasker.thread(threadId);
            });
            
        }
        
        return obj;
    },

    /**
     * @memberOf $thing
     * @method Agent#removeBehaviour
     * @param {string|$thing.Behaviour}
     */
    removeBehaviour: function() {
        var objs = [],
            children = this.getChildren()
            ;
            
        if (typeof arguments[0] === 'object' &&
            arguments[0].getHeapId !== undefined
        ) {
            var id = arguments[0].getHeapId();
            
            children.forEach(function(obj, cbRelease) {
                if (obj.getHeapId() === id) {
                    obj.setState($thing.State.LIFE_DELETED);
                    cbRelease();
                    objs.push(obj);
                }
            });
        }
        else {
            var args = $thing.arrayDup(arguments),
                def = new $thing.Definition(
                    this,
                    $thing.Behaviour,
                    $thing.getThreadId(1),
                    args
                )
                ;
                
            children.forEach(function(obj, cbRelease) {
                if (obj.getName() === def.name) {
                    obj.setState($thing.State.LIFE_DELETED);
                    cbRelease();
                    objs.push(obj);
                }
            });
        }

        return objs;
    }

});

/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';    

/**
 * @class Behaviour
 * @mixes $thing.Delegate
 * @memberOf $thing
 */
$thing.Behaviour = $thing.Delegate.inherit({

    getName: function() {
        return 'Behaviour';
    },

    getInterfaces: function() {
        return [
            'Behaviour', 
            'parent:' + this.$parent.$id,
            'owner:' + this.$owner.$id
        ];
    },

    done: function() {
        return false;
    },

    action: function($cb) {
        
        if (this.done())
            this.$owner.removeBehaviour(this);
            
        if ($cb) $cb();

    },

    block: function($cb) {
    
        this.setState($thing.State.LIFE_BLOCKED);
        
        if ($cb) $cb();
        
    },

    restart: function($cb) {
        
        this.unsetState($thing.State.LIFE_BLOCKED);
        
        if ($cb) $cb();

    },

    reset: function($cb) {

        this.unsetState(
            $thing.State.LIFE_WAITING | 
            $thing.State.LIFE_SUSPENDED
        );

        this.setState($thing.State.LIFE_ACTIVE);

        if ($cb) $cb();
        
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.Filter = {
    ALL:            1,
    FIRST:          2,
    LAST:           4
};

$thing.Selector = $thing.Base.inherit({

    getName: function() {
        return 'Selector';
    },

    /**
     * @constructs Selector
     * @mixes $thing.Base
     * @memberOf $thing
     * @param {[]} threadId
     * @param {(string|string[]|$thing.Pattern)} pattern
     * @param {boolean} [includePassive=true]
     */
    init: function(threadId, pattern, includePassive) {
        this.$super();

        this._threadId = threadId;
        this._includePassive = includePassive === undefined ? true : includePassive;
        this._exprs = [];
        this._schedule = [];
        this._selection = [];
        this._callbacks = [];

        this._filterStates = (this._includePassive) 
            ? $thing.State.LIFE_SUSPENDED
            : $thing.State.LIFE_WAITING
            ;
        
        if (pattern instanceof $thing.Pattern) {

            if (this._threadId === undefined)
                this._threadId = pattern.getThreadId();

            pattern = pattern.toArray();

        }
        else if (typeof pattern === 'string') {
            var expr = {
                and: {},
                not: {}
            };
            
            expr.and[pattern] = true;
            
            this._exprs.push(expr);

        }
        
        if (pattern instanceof Array) {
            for(var i = 0; i < pattern.length; i++) {
                this.parseStack(pattern[i]);
            }
        }
        
        this.property('length', function() {

            return this._schedule.length;
        });

    },

    parseStack: function(stack) {
        var k,
            item,
            state = $thing.State.EXPR_AND,
            expr = {
                and: {},
                not: {}
            }
            ;
        
        while((item = stack.shift()) !== undefined) {
            
            switch(item) {
                case 'and':
                    state = $thing.State.EXPR_AND;
                    continue;
                
                case 'not':
                    state = $thing.State.EXPR_NOT;
                    continue;
                
                case 'or':
                    state = $thing.State.EXPR_OR;
                    continue;
            }

            switch(state) {
                case $thing.State.EXPR_AND:
                    expr.and[item] = true;
                    break;
                
                case $thing.State.EXPR_NOT:
                    expr.not[item] = true;
                    break;
                
                case $thing.State.EXPR_OR:
                    for (k in expr.and) {
                        this._exprs.push(expr);
                        break;
                    }
                    
                    expr = {
                        and: {},
                        not: {}
                    };
                    
                    expr.and[item] = true;
                    break;
            }
        }
        
        for (k in expr.and) {
            this._exprs.push(expr);
            break;
        }
    },

    matchObject: function(obj, cbRelease) {
        var k,
            match
            ;
        
        for (var i = 0; i < this._exprs.length; i++) {
            var m,
                expr = this._exprs[i]
                ;
            
            for(k in expr.and)
                if ((m = obj.matchInterface(k, this._source)) !== undefined)
                    match = match || m;
                else {
                    match = undefined;
                    break;
                }
                
            if (match === undefined)
                continue;
                
            for(k in expr.not)
                if (obj.matchInterface(k, this._source)) {
                    match = undefined;
                    cbRelease();
                    return;
                }

            if (match !== undefined)
                break;
        }
            
        if (match === undefined)
            cbRelease();
        else {
            this._callbacks.push(cbRelease);
            this._selection.push({match: match, obj: obj});
        }
    
    },

    select: function() {
        var i,
            j,
            include,
            def,
            heap
            ;

        this.release();

        heap = $thing.getContainer(this._threadId).heap;

        for(i = 0; i < heap.length; i++) {
            def = heap[i];
            
            include = (def.isPassive)
                ? (def.isPassive & this._includePassive) && def.state < this._filterStates
                : def.state < this._filterStates
                ;

            if (!def.isAbstract &&
                def.refCount > 0 &&
                def.state & $thing.State.LIFE_ACTIVE &&
                include
            )
                def.refObject(this.bind(this.matchObject));
        }
        
        if (this._schedule.length !== this._selection.length) {
            
            this._schedule = new Array(this._selection.length);
    
            for (j = 0; j < this._schedule.length; j++)
                this._schedule[j] = j;

        }

    },

    schedule: function() {
              
        if (this._schedule.length === 1) {

            var s = this._selection[this._schedule[0]].obj
                .getState() < this._filterStates;

            if (!s) this._schedule.length = 0;    

        }
        else {

            var shrink = false,
                self = this
                ;

            this._schedule.sort(function(x, y) {
                x = self._selection[x].obj;
                y = self._selection[y].obj;

                var xr = x.getResponseRatio(),
                    yr = y.getResponseRatio(),
                    xs = x.getState() < self._filterStates,
                    ys = y.getState() < self._filterStates               
                    ;

                if (!ys) {
                    shrink = true;
                    if (!xs) return 0; 
                    else return -1;
                }

                if (!xs) {
                    shrink = true;
                    return 1;
                }

                if (xr > yr) return -1;
                if (xr < yr) return 1;
    
                return 0;
            });

            if (shrink)
                for (var i = 0; i < this._schedule.length; i++) {
            
                    var s = this._selection[this._schedule[i]].obj
                        .getState() < this.filterStates; 

                    if (!s) {
                        this._schedule.length = i;
                        break;
                    }

                }

        }

    },

    dispatch: function(call, cbItem, cbDone) {
        var self = this;

        if (    (call.filters & $thing.Filter.ALL && this._schedule.length === 1) || 
                (call.filters & $thing.Filter.FIRST && this._schedule.length > 0)
        ) {

            var item = this._selection[this._schedule[0]],
                match = item.match,
                obj = item.obj,
                start = $thing.getMicroTime()
                ;

            obj.dispatch(
                {   interface: match,
                    method: call.method,
                    args: call.args
                },
                function() {

                    if (typeof obj.getRefCount === 'undefined')
                        obj = $thing.Container;
                    else {

                        obj.burstTime($thing.getMicroTime() - start);

                        obj.waitTime();

                    }

                    return cbItem.apply(
                        obj,
                        $thing.arrayAppend(arguments, cbDone)
                    );
                }
            );

        }
        else if (   call.filters & $thing.Filter.LAST &&
                    this._schedule.length > 0
        ) {

            var item = this._selection[this._schedule[this._schedule.length - 1]],
                match = item.match,
                obj = item.obj,
                start = $thing.getMicroTime()
                ;

            obj.dispatch(
                {   interface: match,
                    method: call.method,
                    args: call.args
                },
                function() {

                    if (typeof obj.getRefCount === 'undefined')
                        obj = $thing.Container;
                    else {

                        obj.burstTime($thing.getMicroTime() - start);

                        obj.waitTime();

                    }

                    return cbItem.apply(
                        obj,
                        $thing.arrayAppend(arguments, cbDone)
                    );
                }
            );

        }
        else if (   call.filters & $thing.Filter.ALL &&
                    this._schedule.length > 0
        ) {

            $thing.async.each(
                this._schedule,
                function(item, cbNext) {
                    item = self._selection[item];

                    var match = item.match,
                        obj = item.obj,
                        start = $thing.getMicroTime()
                        ;

                    obj.dispatch(
                        {   interface: match,
                            method: call.method,
                            args: call.args
                        },
                        function() {

                            if (typeof obj.getRefCount === 'undefined')
                                obj = $thing.Container;
                            else {

                                obj.burstTime($thing.getMicroTime() - start);

                                obj.waitTime();

                            }

                            return cbItem.apply(
                                obj,
                                $thing.arrayAppend(arguments, cbNext)
                            );
                        }
                    );

                },
                cbDone
            );
            
        }
        else {

            cbDone();

        }

    },

    release: function() {
        var i,
            callbacks = this._callbacks
            ;

        this._schedule = [];
        this._callbacks = [];
        this._selection = [];

        for(i = 0; i < callbacks.length; i++) 
            callbacks[i]();
        
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

/**
 * @class Container
 * @mixes $thing.Agent
 * @memberOf $thing
 */
$thing.Container = new ($thing.Agent.inherit({
    
    getName: function() {
        return 'Container';
    },
    
    getInterfaces: function() {
        return ['Container'];
    },

    getThreadId: function() {
        return ['$thing', 'main', 'main'];
    },
    
    setup: undefined,
    takedown: undefined,
    addBehaviour: undefined,
    removeBehaviour: undefined

}))();

/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

/**
 * @class Tasker
 * @mixes $thing.Base
 * @memberOf $thing
 */
$thing.Tasker = new ($thing.Base.inherit({

    doAction: function(container, selector, iteration) {
        var self = this;
        
        container.isTaskerQueued = true;

        if (iteration > selector.length) {
            selector.select();
            iteration = 0;
        }

        if (selector.length === 0) {
            selector.release();
            container.isTaskerQueued = false;
        }
        else {

            selector.schedule();

            selector.dispatch(
                {   filters: $thing.Filter.FIRST,
                    method: 'action',
                    args: []
                },
                function(cbNext) {
                    cbNext();
                },
                function() {

                    $thing.async.setImmediate(function() {
                        self.doAction(container, selector, ++iteration);
                    });
                
                }
            );

        }

    },

    thread: function(threadId) {
        if (threadId === undefined) 
            threadId = $thing.getThreadId(1);

        var container = $thing.getContainer(threadId);

        if (!container.isTaskerQueued) {

            var selector = new $thing.Selector(threadId, [['Behaviour']], false);

            selector.select();

            this.doAction(
                container,
                selector,
                0
            );
            
        }
        
    }
    
}))();
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

/**
 * @class Heartbeat
 * @mixes $thing.Agent
 * @abstract
 * @singleton
 */
$thing.agent(
    '@singleton', 
    'abstract Heartbeat implements Container', {

        setup: function(cb) {
            this.$super(cb);

            var self = this;
            
            this.keepAlive = this.addBehaviour('@passive', {});

            this.intervalId = setInterval(
                function() {
                    $thing.Tasker.thread(self.getThreadId());
                }, 
                $thing.WAKE_MIN_PERIOD / 1000
            );
            
        },
            
        /**
         * @method Heartbeat#destroy
         */
        destroy: function($cb) {
                
            clearInterval(this.intervalId);

            this.removeBehaviour(this.keepAlive);

            $cb();
        }
    }
);
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.agent('@singleton', {
    
    setup: function(cb) {
        this.$super(cb);

        /**
         * @class Flow
         * @abstract
         * @mixes $thing.Behaviour
         */
        this.addBehaviour('abstract Flow', {

            /**
             * @method Flow#getFlow
             * @returns {function[]}
             */
            getFlow: function() {
                var flow,
                    names,
                    namesDict = {},
                    self = this
                    ;
                    
                for (var i = 0; i < arguments.length; i++) 
                    namesDict[arguments[i]] = i;
              
                $thing.searchMeta(this, 'flow', function() {

                    for (var j = 0; j < arguments.length; j++)  
                        namesDict[arguments[j]] = j + i;

                    i += j;

                });

                names = Object.keys(namesDict);
                
                flow = new Array(names.length);
 
                names.forEach(function(name, index) {

                    flow[index] = function() {
                        var args = new Array(arguments.length);

                        args[0] = name;

                        for (var i = 0; i < arguments.length - 1; i++)
                            args[i + 1] = arguments[i];

                        $thing.agent(self, arguments[arguments.length - 1])
                            .apply(self, args)
                            .apply(self, [self])
                            ;

                    };

                });

                flow.remove = function(name) {
                    var k,
                        l = 0,
                        index = namesDict[name]
                        ;

                    if (index !== -1) {
                        
                        namesDict[name] = -1;

                        flow[index] = function() { 

                            arguments[arguments.length - 1]();

                        };

                    }

                    for (k in namesDict)
                        if (namesDict[k] !== -1) break;
                        else l++;

                    if (flow.length === l)
                        this.removeAll();

                };

                flow.removeAll = function() {

                    namesDict = {};

                    flow.length = 0;

                };
    
                this.getFlow = function() {
                    
                    return flow;
                };

                return flow;
            },

            end: function(methodName, $cb) {
                var flow = this.getFlow();

                if (methodName instanceof Array)
                    for(var k in methodName)
                        flow.remove(methodName[k]);
                else 
                    flow.remove(methodName);

                if ($cb) $cb();

            },

            endAll: function($cb) {

                 this.getFlow().removeAll();

                 if ($cb) $cb();

            },
            
            action: function($cb) {

                if (this.getFlow().length === 0)
                    this.done = function() {
                        return true;
                    };
                            
                this.$super($cb);
            },
                
            done: function() {
                
                return false;
            }

        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.agent('@singleton', {
    
    setup: function(cb) {
        this.$super(cb);
    
        /**
         * @class Series
         * @mixes Flow
         * @abstract
         */
        this.addBehaviour('abstract Series extends Flow', {
    
            action: function($cb) {
                this.$super($cb);

                var self = this,
                    start = $thing.getMicroTime()
                    ;

                $thing.async.series(this.getFlow(), function() {

                    self.burstTime($thing.getMicroTime() - start);

                });
            }
    
        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.agent('@singleton', {
    
    setup: function(cb) {
        this.$super(cb);
    
        /**
         * @class Parallel
         * @mixes Flow
         * @abstract
         */
        this.addBehaviour('abstract Parallel extends Flow', {
    
            action: function($cb) {
                this.$super($cb);

                var self = this,
                    start = $thing.getMicroTime()
                    ;

                $thing.async.parallel(this.getFlow(), function() {

                    self.burstTime($thing.getMicroTime() - start);

                });

            }
    
        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.agent('@singleton', {
    
    setup: function(cb) {
        this.$super(cb);
    
        /**
         * @class Queue
         * @mixes Flow
         * @abstract
         */
        this.addBehaviour('abstract Queue extends Flow', {
        
            /**
             * @method Queue#getQueue
             */
            getQueue: function() {
                var chunks,
                    callbacks,
                    cbCompletion,
                    i = 0,
                    x = 0,
                    y = 0,
                    last = 0,
                    queueLength = 0,
                    limit = 0,
                    concurrency = 1,
                    active = 0,
                    paused = 0,
                    self = this,
                    getQueue = this.getQueue,
                    queue = {

                        action: function() {

                            if (paused) return; 

                            if (queueLength === 0 && limit === 0) {
                                var l = Math.max(chunks.length / 2, 1);
                            
                                if (chunks.length > l) {
                                    chunks.length = l;
                                    callbacks.length = l;
                                }
                            }

                            if (queueLength === 0 && limit > 0) {
                                self.setState($thing.State.LIFE_WAITING);
                                return;
                            }

                            if (queueLength === 0 && chunks.length === 1) {
                                self.setState($thing.State.LIFE_WAITING);
                                return;
                            }

                            for(    var j = 0, flow = self.getFlow();

                                    flow.length > 0 &&
                                    j + active < concurrency + 1 && 
                                    i < queueLength; 
                                    
                                    j++
                            ) {

                                var v,
                                    $cb,
                                    start = $thing.getMicroTime()
                                    ;

                                i++;

                                active++;

                                if (chunks[y] instanceof Array) {
                                    
                                    v = chunks[y][x];

                                    if (x < chunks[y].length - 1) x++;
                                    else {

                                        $cb = callbacks[y];

                                        chunks[y] = undefined;
                                        callbacks[y] = undefined;

                                        x = 0;
                                        y++;

                                    }

                                }
                                else {

                                    v = chunks[y];

                                    $cb = callbacks[y];

                                    chunks[y] = undefined;
                                    callbacks[y] = undefined;

                                    x = 0;
                                    y++;

                                }

                                $thing.async.applyEachSeries(
                                    flow, 
                                    v, 
                                    cbCompletion.bind({
                                        start: start,
                                        $cb: $cb
                                    })
                                );

                            }

                        },

                        push: function(items, $cb) {
                            var length = items instanceof Array
                                ? queueLength + items.length
                                : queueLength + 1
                                ;

                            if (self.getFlow() === 0)
                                if ($cb) return $cb('onError', -1)();
                                else return;

                            if (limit > 0 && length > limit)
                                if ($cb) return $cb('onError', -1)();
                                else return;

                            queueLength = length;

                            if (last === chunks.length) {
                                
                                chunks = $thing.arrayDup(chunks, chunks.length * 2, true);
                                callbacks = $thing.arrayDup(callbacks, callbacks.length * 2, true);

                            }

                            chunks[last] = items;
                            callbacks[last] = $cb;

                            last++;

                            if (!paused)
                                self.unsetState($thing.State.LIFE_WAITING);
                            
                            $thing.Tasker.thread(self.getThreadId());

                        },

                        clear: function() {

                            i = queueLength;

                            $thing.async.each(
                                callbacks.slice(y),
                                function(cbItem, cbNext) {

                                    if (cbItem) cbItem('onError', -1)();

                                    cbNext();

                                }
                            );
                
                        },

                        pause: function($cb) {

                            paused = true;

                            self.setState($thing.State.LIFE_WAITING);
                            
                            if ($cb) $cb();

                        },

                        resume: function($cb) {

                            if (queueLength > 0)
                                self.unsetState($thing.State.LIFE_WAITING);

                            paused = false;

                            if ($cb) $cb();

                        },

                        reset: function() {

                            this.clear();

                            chunks.length = 0;
                            callbacks.length = 0;

                            queue = undefined;

                            self.getQueue = getQueue;
                        
                        }

                    }
                    ;

                $thing.searchMeta(this, 'concurrency', 'int', function(value) {

                    concurrency = value;
                
                });
            
                $thing.searchMeta(this, 'limit', 'int', function(value) {
                
                    limit = value;
                
                });

                chunks = new Array(limit || 1);
                callbacks = new Array(limit || 1);

                cbCompletion = function() {
                    var $cb = this.$cb,
                        start = this.start,
                        callDrain = false
                        ;
                                                                
                    if (--active === 0 && i === queueLength) {
                        
                        queueLength = last = i = x = y = 0;

                        callDrain = true;
                        
                    }

                    if (callDrain)
                        self.drain(function() {
                            self.burstTime($thing.getMicroTime() - start);
                        });
                    else
                        self.burstTime($thing.getMicroTime() - start);

                    if ($cb) $cb('onComplete')();

                };

                Object.defineProperty(queue, 'length', {
                    get: function() {
                        return queueLength;
                    }
                });

                this.getQueue = function() {
                    
                    return queue;
                };

                return queue;
            },

            action: function($cb) {

                this.$super($cb);

                this.getQueue().action();

            },
    
            push: function(items, $cb) {

                this.getQueue().push(items, $cb);

            },
    
            pause: function($cb) {

                this.getQueue().pause($cb);

            },
    
            resume: function($cb) {

                this.getQueue().resume($cb);

            },

            end: function(method, $cb) {
                var ret = this.$super(method, $cb);

                if (this.getFlow().length === 0)
                    this.getQueue().clear();

                return ret;
            },

            endAll: function($cb) {
                var ret = this.$super($cb);

                this.getQueue().clear();

                return ret;
            },

            reset: function($cb) {

                this.getQueue().reset();

                this.$super($cb);
            },

            drain: function(cb) {

                cb();
            
            }

        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.agent('@singleton', {
    
    setup: function(cb) {
        this.$super(cb);
    
        /**
         * @class MapReduce
         * @mixes Queue
         * @abstract
         */
        this.addBehaviour('abstract MapReduce extends Queue', {

            getMapReduce: function() {
                var keys = {},
                    values = [],
                    lengths = [],
                    last = 0,
                    shape = 1,
                    total = 0,
                    reduceIndex = 0,
                    drainRefs = 0,
                    pushes = [],
                    self = this,
                    getMapReduce = this.getMapReduce,
                    mapReduce = {

                        write: function(key, value) {
                            var index;

                            if (last === values.length) {

                                values = $thing.arrayDup(
                                    values, 
                                    (1 + values.length) * 2, 
                                    true
                                );
                                
                                lengths = $thing.arrayDup(
                                    lengths, 
                                    (1 + lengths.length) * 2, 
                                    true
                                );

                                for (var i = last; i < lengths.length; i++) {
                                    lengths[i] = 0;
                                    values[i] = new Array(shape);
                                }

                            }

                            if ((index = keys[key]) === undefined) {
                                index = keys[key] = last;
                                last++;
                            }

                            if (lengths[index] === values[index].length) {

                                values[index] = $thing.arrayDup(
                                    values[index], 
                                    Math.max((1 + values[index].length) * 2, shape), 
                                    true
                                );

                            }

                            values[index][lengths[index]] = value;

                            lengths[index]++;

                            shape = Math.ceil(++total / last);

                        },

                        drain: function() {

                            if (++drainRefs === 1) {

                                self.pause();

                                self.unsetState($thing.State.LIFE_WAITING);

                            }

                        },

                        action: function($cb) {
                            var start = $thing.getMicroTime(),
                                valuesCopy = $thing.arrayDup(
                                    values[reduceIndex],
                                    lengths[reduceIndex],
                                    true,
                                    shape
                                )
                                ;
                            
                            lengths[reduceIndex] = 0;

                            self.reduce(valuesCopy, function(reduced) {

                                if (++reduceIndex === last) {
                                    var l = (1 + last) * 2;

                                    if (values.length > l) {
                                        values.length = l;
                                        lengths.length = l;
                                    }

                                    keys = {};

                                    drainRefs = last = reduceIndex = 0;

                                    self.resume();
                                }

                                if (reduced !== undefined)
                                    for(var k in pushes)
                                        pushes[k]('push', reduced)(self);

                                self.burstTime($thing.getMicroTime() - start);

                                $cb();

                            });

                        },

                        reset: function() {

                            keys = {};
                            values.length = 0;
                            lengths.length = 0;

                            mapReduce = undefined;

                            self.getMapReduce = getMapReduce;

                        }

                    }
                    ;

                $thing.searchMeta(this, 'push', 'string', function() {

                    pushes.push(
                        $thing.agent('@select ' + $thing.arrayDup(arguments).join(' '))
                    );
                
                });

                Object.defineProperty(mapReduce, 'length', {
                    get: function() {
                        return total;
                    }
                });

                Object.defineProperty(mapReduce, 'isReducing', {
                    get: function() {
                        return drainRefs > 0 && last > 0;
                    }
                });

                this.getMapReduce = function() {
                    
                    return mapReduce;
                };

                return mapReduce;
            },

            action: function($cb) {
                var mapReduce = this.getMapReduce();

                if (mapReduce.isReducing)
                    mapReduce.action($cb);
                else
                    this.$super($cb);

            },

            reset: function($cb) {

                this.getMapReduce().reset();

                this.$super($cb);
            },

            write: function(key, value) {

                this.getMapReduce().write(key, value);

            },

            reduce: function(values, cb) {

                cb(values);

            },

            drain: function(cb) {

                this.getMapReduce().drain();

                this.$super(cb);
            }

        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.WAKE_MIN_PERIOD = 500000;

$thing.agent('@singleton', {
    
    setup: function(cb) {
        this.$super(cb);
    
        /**
         * @class Waker
         * @mixes Behaviour
         * @abstract
         */
        this.addBehaviour('abstract Waker', {

            /**
             * @method Waker#getWakeTime
             */
            getWakeTime: function() {
                var time,
                    period = 1000000,
                    now = $thing.getMicroTime()
                    ;

                $thing.searchMeta(this, 'period', 'int', function(value) {
                    period = value * 1000;
                });

                time = now + period - (now % period);

                this.getWakeTime = function() {
                    return time;
                };
                        
                return this.getWakeTime();
            },

            /**
             * @method Waker#wake
             */
            wake: function(cb) {
                cb();
            },

            action: function($cb) {
                var time = this.getWakeTime();

                if (time === undefined) 
                    return this.$super($cb);
                else if ($thing.getMicroTime() >= time) {
                    this.getWakeTime = function() {
                        return undefined;
                    };
                    
                    return this.wake(
                        this.bind(function() {
                            this.$super($cb);
                        })
                    );
                }

                this.$super($cb);
            },

            done: function() {
                if (this.getWakeTime() !== undefined)
                    return false;
                else {
                    delete this.getWakeTime;
                    return true;
                }
            },

            reset: function($cb) {
                delete this.getWakeTime;
                this.$super($cb);
            },

            /**
             * @method Waker#stop
             */
            stop: function($cb) {
                this.$owner.removeBehaviour(this);
                delete this.getWakeTime;
                if ($cb) $cb();
            }
 
        });
    }

});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

$thing.agent('@singleton', 'Util', {

    setup: function(cb) {
        this.$super(cb);

        /**
         * @class Complete
         * @mixes $thing.Behaviour
         */
        this.addBehaviour(
            '@passive',
            '@catchall catchAll',
            'Complete', {
                catchAll: function(args, $cb) {
                    $cb('onComplete')();
                }
            }
        );

        /**
         * @class Error
         * @mixes $thing.Behaviour
         */
        this.addBehaviour(
            '@passive',
            '@catchall catchAll',
            'Error', {
                catchAll: function(args, $cb) {
                    $cb('onError', -1)();
                }
            }
        );

        /**
         * @class Sensor
         * @mixes Queue
         * @abstract
         */
        this.addBehaviour('abstract Sensor extends Queue');

        /**
         * @class Actuator
         * @mixes Queue
         * @abstract
         */
        this.addBehaviour('abstract Actuator extends Queue');

        /**
         * @class Bridge
         * @mixes Queue
         * @abstract
         */
        this.addBehaviour(
            'abstract Bridge extends Queue implements Actuator Sensor'
        );
    }
    
});
/*
Copyright (c) 2015 Simon Cullen, http://github.com/cullens

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
'use strict';

if (!$thing.usePaho)
    var mqtt = require('mqtt');

if ((mqtt) || ($thing.usePaho && Paho))

$thing.agent('abstract Mqtt implements Container', {

    setup: function(cb) {
        this.$super(cb);

        if ($thing.usePaho)
            this.port = 80;
        else
            this.port = 1883;

        this.reconnectPeriod = 1000;

        this.isConnecting = false;
        this.isConnected = false;

        this.actuatorsTotal = 0;

        this.topicRefs = {};
        this.pendingSubs = {};
        this.pendingUnsubs = {};

        var z = -1,
            self = this
            ;

        $thing.searchMeta(this, 'host', 'string', function(value) {
            self.host = value;
        });

        $thing.searchMeta(this, 'port', 'int', function(value) {
            self.port = value;
        });

        $thing.searchMeta(this, 'clientId', 'string', function(value) {
            self.clientId = value;
        });

        $thing.searchMeta(this, 'reconnectPeriod', 'int', function(value) {
            self.reconnectPeriod = value;
        });

        if (this.host === undefined)
            throw new Error('Mqtt: Missing @host');
 
        if (this.clientId === undefined)
            this.clientId = 'xxxxxxxx-xxxx-4xxz-yzzz-zzzzzzzzzzzz'.replace(
                /[xyz4-]/g, 
                function(c) {
                    switch(c) {
                        case 'x':
                            return (
                                Math.floor(Math.random() * 100) % 16
                            ).toString(16);
                        case 'y':
                            return '8';
                        case 'z':
                            return self.$id.charAt(++z);
                        case '-':
                        case '4':
                            return c;
                    }
                }
            );

    },
    
    destroy: function($cb) {
        this.getChildren().forEach(function(child) {
            if (!child.isAbstract())
                if (child.matchInterface('Sensor') !== undefined ||
                    child.matchInterface('Actuator') !== undefined
                )
                    child.$owner.removeBehaviour(child);
        });

        $cb();
    },

    addBehaviour: function() {
        var doConnect = false,
            obj = this.$super.apply(this, arguments)
            ;
        
        if (obj !== undefined && !obj.isAbstract()) {
 
            if (obj.matchInterface('Sensor') !== undefined) {
                obj.$subTopic = obj.getName();

            if (this.topicRefs[obj.$subTopic] !== undefined)
                this.topicRefs[obj.$subTopic]++;
            else {
                this.topicRefs[obj.$subTopic] = 1;

                if (this.isConnected)
                    this.doSubscribe(obj.$subTopic);
                else {
                    this.pendingSubs[obj.$subTopic] = true;

                    if (this.pendingUnsubs[obj.$subTopic] !== undefined)
                        delete this.pendingUnsubs[obj.$subTopic];

                        doConnect = true;
                    }
                }
            }
                
            if (obj.matchInterface('Actuator') !== undefined) {
                var flow = obj.getFlow();

                obj.$pubTopic = obj.getName();

                obj.getFlow = function() {

                    return $thing.arrayAppend(
                        flow,
                        function(message, cb) {

                            obj.$owner.doSendMessage(obj.$pubTopic, message);
                            
                            cb();
                        }
                    );

                };
                
                if (!this.isConnected) {

                    doConnect = true;

                    $thing.agent(obj)('pause')();

                }

                this.actuatorsTotal++;
            }
            
            if (doConnect)
                this.doConnect();

        }
            
        return obj;
    },

    removeBehaviour: function() {
        var self = this,
            objs = this.$super.apply(this, arguments)
            ;
            
        objs.forEach(function(obj) {

            if (obj.$subTopic !== undefined)
                if (--self.topicRefs[obj.$subTopic] <= 0) {
                    delete self.topicRefs[obj.$subTopic];

                    if (self.pendingSubs[obj.$subTopic] !== undefined)
                        delete self.pendingSubs[obj.$subTopic];

                    if (self.isConnected)
                        self.doUnsubscribe(obj.$subTopic);
                    else
                        self.pendingUnsubs[obj.$subTopic] = true;
                }
                
            if (obj.$pubTopic !== undefined)
                self.actuatorsTotal--;

        });

        if (!this.isActive())
            this.doDisconnect();

        return objs;
    },

    doConnectWithMqtt: function() {
        var self = this;

        this.client = mqtt.connect({
            host: this.host,
            port: this.port,
            clientId: this.clientId,
            reconnectPeriod: this.reconnectPeriod
        });

        this.client.on('error', function(err) {
            self.onError(err)();
        });

        this.client.on('close', function() {
            self.onDisconnect();
            self.removeBehaviour(self.broker);
            delete self.broker;
        });

        this.client.on('connect', function() {
            self.broker = self.addBehaviour('@passive', {});
            self.onConnect();
        });

        this.client.on('message', function(topic, message) {
            self.onMessageArrived(
                topic, 
                $thing.createBuffer(message)
            );
        });

    },

    doConnectWithPaho: function() {
        var self = this;

        this.client = new Paho.MQTT.Client(
            this.host, 
            this.port, 
            this.clientId
        );

        this.client.onConnectionLost = function() {
            self.onDisconnect();
        };
                    
        this.client.onMessageArrived = function(msg) {
            self.onMessageArrived(
                msg.destinationName, 
                $thing.createBuffer(msg.payloadBytes)
            );
        };
            
        this.client.onMessageDelivered = function(msg) {
            self.onMessageDelivered(
                msg.destinationName, 
                $thing.createBuffer(msg.payloadBytes)
            );
        };

        this.client.connect({
            onSuccess: function() {
                self.onConnect();
            },
            onFailure: function(err) {
                self.onError(err);
            }
        });
    },

    isActive: function() {
        for (var i in this.pendingSubs)
            break;        
        for (var j in this.pendingUnsubs)
            break;
        for (var k in this.topicRefs)
            break;
        if (    i !== undefined || 
                j !== undefined || 
                k !== undefined || 
                this.actuatorsTotal > 0
        )  
            return true;
        else
            return false;
    },

    doConnect: function() {
        if (this.isConnecting) 
            return;

        this.isConnecting = true;
        this.isConnected = false;

        if ($thing.usePaho)
            this.doConnectWithPaho();
        else
            this.doConnectWithMqtt();
    },

    doDisconnect: function() {
        if (this.client !== undefined) {

            this.isConnecting = false;
            this.isConnected = false;

            if ($thing.usePaho)
                this.client.disconnect();
            else
                this.client.end();

            delete this.client;
        }
    },

    doReconnect: function() {
        if ($thing.usePaho)
            this.addBehaviour(
                '@singleton',
                '@period $', this.reconnectPeriod,
                'extends Waker', {
                    wake: function(cb) {
                        this.$super(cb);

                        if (this.$owner.isConnected)
                            this.$owner.doDisconnect();
                        else
                            this.$owner.doConnect();
                    }
                }
            );
    },

    doSubscribe: function(topic) {
        this.client.subscribe(topic);
    },

    doUnsubscribe: function(topic) {
        this.client.unsubscribe(topic);
    },

    doSendMessage: function(topic, message) {
        var self = this;

        if ($thing.usePaho)
            this.client.send(topic, message, 0, false);
        else 
            this.client.publish(
                topic,
                message, {

                },
                function(err) {
                    if (err) 
                        self.onError(err);
                    else 
                        self.onMessageDelivered(
                            topic, 
                            $thing.createBuffer(message)
                        );
                }
            );
    },

    onError: function(err) {
        this.isConnecting = false;

        if ($thing.usePaho && err.errorCode === 8)
            this.onDisconnect();
    },

    onConnect: function() {
        this.isConnecting = false;
        this.isConnected = true;

        for (var i in this.pendingSubs)
            this.doSubscribe(i);

        for (var j in this.pendingUnsubs)
            this.doUnsubscribe(j);

        this.pendingSubs = {};
        this.pendingUnsubs = {};

        for (var k in this.topicRefs)
            break;

        if (k === undefined && this.actuatorsTotal <= 0) 
            this.doDisconnect();
        else
            this.getChildren().forEach(function(obj) {

                if (!obj.isAbstract() && 
                    obj.matchInterface('Actuator') !== undefined
                )       
                    $thing.agent(obj)('resume')();

            });
    },

    onDisconnect: function() {
        this.isConnecting = false;
        this.isConnected = false;

        if (this.actuatorsTotal > 0)
            this.getChildren().forEach(function(obj) {
                if (obj.matchInterface('Actuator') !== undefined)
                    $thing.agent(obj)('pause')();
            });

        if (this.isActive())
            this.doReconnect();
    },

    onMessageArrived: function(topic, message) {

        this.getChildren().forEach(function(obj) {

            if (!obj.isAbstract() && obj.matchInterface(topic) !== undefined)
                    
                if (obj.matchInterface('Bridge') !== undefined)
                    $thing.agent('@select $ not owner:$', topic, obj.$owner.$id)
                        ('push', message)()
                        ;

                else if (obj.matchInterface('Sensor') !== undefined)
                    $thing.agent(obj)
                        ('push', message)()
                        ;

        });
        
    },

    onMessageDelivered: function(topic, message) {

    }

});
//# sourceMappingURL=thingjs-agent-0.2.2.js.map