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
    var args = Array.prototype.slice.call(arguments, 0),
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

$thing.containers = {
    $thing: {
        source: '$thing',
        heap: []
    }    
};

/**
 * @memberOf $thing
 * @method container
 */
$thing.$container = function(cb) {
    cb();
};

/**
 * @memberOf $thing
 * @method getContainer
 */
$thing.getContainer = function(backtrace) {
    var i = backtrace.indexOf('$container:0:0');

    if (i === -1)
        return $thing.containers.$thing;
    else 
        return $thing.containers[backtrace[++i]] 
            ? $thing.containers[backtrace[i]]
            : $thing.containers[backtrace[i]] = { 
                source: backtrace[i],
                heap: [] 
            }
            ;
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
$thing.cbBuilder = function(self, args, cbDone) {
    cbDone = cbDone || function(){};
    
    return function() {
        var self = this,
            args = arguments
            ;
        
        $thing.agent();
        
        return (!args.length)
            ? cbDone()
            : function() {
                var cbObj = (arguments.length)
                    ? arguments
                    : [$thing.Container]
                    ;
                
                $thing.async.setImmediate(function() {
                    $thing.agent(self)
                        .apply($thing, args)
                        .apply($thing, cbObj)
                        ;
                    
                    cbDone();
                });
            }
            ;

    }.apply(self, args);
};

/**
 * @method agent
 * @param {*}
 */
var agent = $thing.agent = function() {
    var def,
        backtrace,
        selector,
        filter,
        pattern,
        selects,
        callChain,
        refCount = 0
        ;

    switch(arguments.length) {
        case 0:
            return $thing.Tasker.thread();
        
        case 1:
            if (arguments[0] instanceof $thing.Pattern) {
                selector = new $thing.Selector(undefined, pattern = arguments[0]);
                break;
            }
            else if (   typeof arguments[0] === 'object' &&
                        arguments[0].getInterfaces !== undefined
            ) {
                selector = arguments[0];
                break;
            }

            /* falls through */
        default:
            var args = Array.prototype.slice.call(arguments, 0);
            
            def = new $thing.Definition(
                undefined,
                $thing.Container,
                $thing.Agent,
                (backtrace = $thing.getBacktrace(1)),
                args
            );

            if (def.class !== undefined)
                return def.refObject(function(obj, cbRelease) {
                    cbRelease();
                });
            else {
                selects = [];
                
                $thing.searchMeta(def, 'select', function() {
                    selects.push(Array.prototype.slice.call(arguments, 0));
                });
                
                selector = new $thing.Selector(
                    undefined,
                    pattern = (selects.length)
                        ? selects
                        : def.name,
                    backtrace
                );
            }
    }

    filter = function(filters, callArgs) {          
        return function() {
            var obj,
                args = Array.prototype.slice.call(arguments, 0)
                ;
                
            switch(arguments.length) {
                case 0:
                    obj = $thing.Container;
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
                    var backtrace = $thing.getBacktrace(1),
                        def = new $thing.Definition(
                            undefined,
                            $thing.Container,
                            $thing.Agent,
                            backtrace,
                            args
                        )
                        ;
                    
                    if (def.class !== undefined) 
                        obj = def;
                    else {
                        selects = [];
                        
                        $thing.searchMeta(def, 'select', function() {
                            selects.push(Array.prototype.slice.call(arguments, 0));
                        });
                        
                        obj = new $thing.Pattern(
                            (selects.length)
                                ? selects
                                : def.name,
                                backtrace
                        );
                    }
                    
                    break;
            }

            obj.refObject(function(obj, cbRelease) {

                refCount++;

                (pattern !== undefined)
                    ? selector.dispatch(
                        {   filters: filters,
                            method: callArgs[0],
                            args: callArgs.slice(1)
                        },
                        function() {
                            return $thing.cbBuilder(
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
                            if (--refCount === 0) {
                                cbRelease();
                                selector.release();
                            }
                        }
                    )
                    : selector.dispatch(
                        {   filters: filters,
                            method: callArgs[0],
                            args: callArgs.slice(1)
                        },
                        function() {
                            return $thing.cbBuilder(
                                obj,
                                arguments,
                                function() {
                                    if (--refCount === 0) {
                                        cbRelease();
                                    }
                                }
                            );
                        }
                    )
                    ;
            });

            return callChain;
        };
    };

    callChain = function() {
        return filter(
            $thing.Filter.ALL, 
            Array.prototype.slice.call(arguments, 0)
        );
    };

    callChain.all = callChain;

    callChain.first = function() {
        return filter(
            $thing.Filter.FIRST, 
            Array.prototype.slice.call(arguments, 0)
        );
    };

    callChain.last = function() {
        return filter(
            $thing.Filter.LAST, 
            Array.prototype.slice.call(arguments, 0)
        );
    };

    return callChain;
};