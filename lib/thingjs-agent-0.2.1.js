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

var $thing = $thing || {};

$thing.bootstrap = 'browser.js';
$thing.usePaho = true;

$thing.async = async;

$thing.getMicroTime = function() {
    return Date.now() * 1000;
};

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
        inherit = this.prototype
        ;
        
    function ret() {
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
    
    ret.prototype = new this();
    ret.prototype.constructor = ret;
    ret.prototype.$vtable = (ret.prototype.$vtable !== undefined)
        ? ret.prototype.$vtable.slice()
        : []
        ;
    
    var ordinal = ret.prototype.$vtable.push(obj) - 1,
        parentOrdinal = ret.prototype.$vtable.push(parent) - 1,
        superOrdinal = ret.prototype.$vtable.push(inherit) - 1
        ;
    
    ret.inherit = $inherit;
    
    for (i in obj) {
        switch(i) {
            case '$vtable':
                /* falls through */
            case '$signatures':
                /* falls through */
            case '$owner':
                /* falls through */
            case '$parent':
                 /* falls through */
            case '$super':
                continue;
        }
        
        v = obj[i];
        k = i.replace(/\$\((.+?)\)/g, replace);
        j = k.substring(k.indexOf('.') + 1);
        
        if (typeof v !== 'function')
            ret.prototype[k] = v;
        else {
            functString = v.toString();
            signature = functString.match(/function[^(]*\(([^)]*)\)/);
            
            (typeof inherit[k] !== 'function')
                ? (typeof inherit[j] !== 'function')
                    ? ret.prototype[k] = $thing.switchParentContext.apply(
                        ret.prototype,
                        [   functString,
                            parentOrdinal,
                            ordinal,
                            i
                        ]
                    )
                    : ret.prototype[k] = $thing.switchContext.apply(
                        ret.prototype,
                        [   functString,
                            parentOrdinal,
                            superOrdinal,
                            ordinal,
                            j,
                            i
                        ]
                    )
                : ret.prototype[k] = $thing.switchContext.apply(
                    ret.prototype,
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
    
    ret.prototype.$owner = parent || ret.prototype.$owner;
    ret.prototype.$signatures = $thing.merge(
        signatures,
        ret.prototype.$signatures
    );
    
    return ret;
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

    _metaHandlers: {

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
     * @param {object} container
     * @param {object} parent
     * @param {object} super
     * @param {string[]} backtrace
     * @param {string[]} stack
     */
    init: function(container, parent, _super, backtrace, stack) {
        var k,
            item,
            search,
            self = this,
            heap = (container) 
                ? container.heap
                : $thing.getContainer(backtrace).heap
            ;

        this.$super();
        
        this._state = $thing.State.DEF_DESC;
        this._parent = parent;
        this._children = [];
        this._meta = [];
        this._interfaces = [];
        this._uses = [];
        this._super = _super;
        this._source = backtrace[0];
        this._refCount = 0;
        this._isAgent = this._super === $thing.Agent;
        this._isAbstract = false;
        this._isPassive = false;
        this._isMobile = false;

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
            
            (self._metaHandlers[args[0]] !== undefined)
                ? self._metaHandlers[args[0]].apply(self, args)
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
            var states = Array.prototype.slice.call(arguments, 0);
            
            states.forEach(function(state) {
                self._state |= state;
            });
            
            this.getChildren().forEach(function(child) {
                child.setState(states);
            });
        };
        
        obj.unsetState = function() {
            var states = Array.prototype.slice.call(arguments, 0);
            
            states.forEach(function(state) {
                self._state &= ~state;
            });
            
            this.getChildren().forEach(function(child) {
                child.unsetState(states);
            });
        };
        
        obj.getMeta = function() {
            return self._meta;
        };
        
        obj.isAbstract = function() {
            return self._isAbstract;
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
        delete obj.getMeta;
        delete obj.isAbstract;
        
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
            signature
            ;

        cb = cb || function() {};
            
        // Don't dispatch to unpatched delegates
        //if (this.getRefCount === undefined) return cb();

        // Don't dispatch to methods with $ prefix 
        if (call.method.charAt(0) === '$') return cb(); 

        // Check for method name prefixed with interface
        (this[method = call.interface + '.' + call.method] === undefined)
            ? (this[method = call.method] === undefined)
                ? method = undefined
                : undefined
            : undefined
            ;

            // Check method has a name
        (   method === undefined ||
            // Does the signature for the method exist
            (signature = this.$signatures[method]) === undefined ||
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
                // Last argument is prefix with $
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
            // Matched, make call
            : this[method].apply(
                this,
                call.args.concat(cb)
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
     * @param {(string|string[])} pattern
     * @param {string[]} backtrace
     */
    init: function(pattern, backtrace) {
        this.$super();
        this._pattern = pattern;
        this.property('backtrace', function() {
            return backtrace;
        });
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
        $thing.agent();
    },

    /**
     * @memberOf $thing
     * @method Agent#doDelete
     */
    doDelete: function(cb) {
        this.setState($thing.State.LIFE_DELETED);
        if (cb) cb();
        $thing.agent();
    },

    /**
     * @memberOf $thing
     * @method Agent#doSuspend
     */
    doSuspend: function(cb) {
        this.setState($thing.State.LIFE_SUSPENDED);
        if (cb) cb();
        $thing.agent();
    },

    /**
     * @memberOf $thing
     * @method Agent#doWait
     */
    doWait: function(cb) {
        this.setState($thing.State.LIFE_WAITING);
        if (cb) cb();
        $thing.agent();
    },

    /**
     * @memberOf $thing
     * @method Agent#doWake
     */
    doWake: function(cb) {
        this.unsetState($thing.State.LIFE_WAITING);
        if (cb) cb();
        $thing.agent();
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
            args = Array.prototype.slice.call(arguments, 0),
            def = new $thing.Definition(
                undefined,
                this,
                $thing.Behaviour,
                $thing.getBacktrace(1),
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
                
                $thing.agent();
            };
            
            funct();
            
            reset = obj.reset;
            
            obj.reset = function() {
                funct();
                reset.apply(obj, arguments);
            };
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
            var args = Array.prototype.slice.call(arguments, 0),
                def = new $thing.Definition(
                    undefined,
                    this,
                    $thing.Behaviour,
                    $thing.getBacktrace(1),
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

    block: function(cb) {
        this.setState($thing.State.LIFE_BLOCKED);
        if (cb) cb();
    },

    restart: function(cb) {
        this.unsetState($thing.State.LIFE_BLOCKED);
        if (cb) cb();
    },

    reset: function(cb) {
        if (cb) cb();
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
     * @param {object} container
     * @param {(string|string[]|$thing.Pattern)} pattern
     * @param {string[]} backtrace
     * @param {boolean} [includePassive=true]
     * @param {*[]} [heap=$thing.heap]
     */
    init: function(container, pattern, backtrace, includePassive) {
        var i,
            include,
            def,
            heap
            ;

        this.$super();

        this._exprs = [];
        this._selection = [];
        this._callbacks = [];
        this._backtrace = backtrace;
        this._source = this._backtrace !== undefined 
            ? this._backtrace[0] 
            : undefined
            ;
        
        if (pattern instanceof $thing.Pattern) {
            this._backtrace = pattern.backtrace;
            this._source = this._backtrace[0];
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
            for(i = 0; i < pattern.length; i++) {
                this.parseStack(pattern[i]);
            }
        }
        
        includePassive =
            (includePassive === undefined)
                ? true
                : includePassive
                ;
        
        heap = (container) 
            ? container.heap 
            : $thing.getContainer(this._backtrace).heap
            ;

        for(i = 0; i < heap.length; i++) {
            def = heap[i];
            
            include = (def.isPassive)
                ? (def.isPassive & includePassive) &&
                    def.state < $thing.State.LIFE_SUSPENDED
                : (includePassive)
                    ? def.state < $thing.State.LIFE_SUSPENDED
                    : def.state < $thing.State.LIFE_WAITING
                    ;

            if (!def.isAbstract &&
                def.refCount > 0 &&
                def.state & $thing.State.LIFE_ACTIVE &&
                include
            )
                def.refObject(this.bind(this.matchObject));

        }
        
        this.property('length', function() {
            return this._selection.length;
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

    dispatch: function(call, cbItem, cbDone) {
        $thing.async.setImmediate(this.bind(function() {

            if (call.filters & $thing.Filter.FIRST &&
                this._selection.length > 0
            ) {

                this._selection[0].obj.dispatch(
                    {   interface: this._selection[0].match,
                        method: call.method,
                        args: call.args
                    },
                    this.bind(function() {
                        return cbItem.apply(
                            this._selection[0].obj,
                            Array.prototype.slice.call(
                                arguments,
                                0
                            ).concat(cbDone)
                        );
                    })
                );

            }
            else if (   call.filters & $thing.Filter.LAST &&
                        this._selection.length > 0
            ) {
                var i = this._selection.length - 1;

                this._selection[i].obj.dispatch(
                    {   interface: this._selection[i].match,
                        method: call.method,
                        args: call.args
                    },
                    this.bind(function() {
                        return cbItem.apply(
                            this._selection[i].obj,
                            Array.prototype.slice.call(
                                arguments,
                                0
                            ).concat(cbDone)
                        );
                    })
                );
            }
            else if (   call.filters & $thing.Filter.ALL &&
                        this._selection.length > 0
            ) {

                $thing.async.each(
                    this._selection,
                    function(item, cbNext) {
                        item.obj.dispatch(
                            {   interface: item.match,
                                method: call.method,
                                args: call.args
                            },
                            function() {
                                return cbItem.apply(
                                    item.obj,
                                    Array.prototype.slice.call(
                                        arguments,
                                        0
                                    ).concat(cbNext)
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

        }));
    },

    release: function() {
        for(var i = 0; i < this._callbacks.length; i++)
            this._callbacks[i]();
        this._callbacks = [];
        this._selection = [];
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

    doWake: function(container) {
        var now = $thing.getMicroTime();

        if (!container.nextWakeTime || now >= container.nextWakeTime) {

            var selector = new $thing.Selector(
                    container,
                    [['Behaviour', 'and', 'Waker']], 
                    ['$container:0:0', '$thing'], 
                    false
                )
                ;

            if (selector.length === 0) {
                selector.release();
                selector = undefined;
            }
            else {
                selector.dispatch(
                    {   filters: $thing.Filter.ALL,
                        method: 'action',
                        args: []
                    },
                    function(cbNext) {
                        cbNext();
                    },
                    function() {
                        selector.release();
                        selector = undefined;
                    }
                );
            }

            container.nextWakeTime =   
                now + $thing.WAKE_MIN_PERIOD - (now % $thing.WAKE_MIN_PERIOD);
        }

    },

    doAction: function(container) {
        var self = this;

        if (container.isActionTaskQueued) return;
        container.isActionTaskQueued = true;

        $thing.async.setImmediate(function() {
            var selector = new $thing.Selector(
                    container,
                    [['Behaviour', 'not', 'Waker']], 
                    ['$container:0:0', '$thing'], 
                    false
                )
                ;
        
            if (selector.length === 0) {
                selector.release();
                selector = undefined;
                container.isActionTaskQueued = false;
            }
            else {
                selector.dispatch(
                    {   filters: $thing.Filter.ALL,
                        method: 'action',
                        args: []
                    },
                    function(cbNext) {
                        cbNext();
                    },
                    function() {
                        selector.release();
                        selector = undefined;
                        container.isActionTaskQueued = false;
                        self.doAction(container);
                    }
                );
            }

        });

    },

    thread: function() {
        var container = $thing.getContainer($thing.getBacktrace());

        this.doWake(container);
        this.doAction(container);
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
            
            this.keepAlive = this.addBehaviour('@passive', {});

            this.intervalId = setInterval(
                $thing.agent, 
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
                var self = this,
                    reset = this.reset,
                    getFlow = this.getFlow,
                    methods = [],
                    names = [],
                    args = Array.prototype.slice.call(arguments, 0)
                    ;
                    
                args.forEach(function(item) {
                    if (names.indexOf(item) === -1)
                        names.push(item);
                });
                    
                $thing.searchMeta(this, 'flow', function() {
                    Array.prototype.slice.call(arguments, 0).forEach(
                        function(item) {
                            if (names.indexOf(item) === -1)
                                names.push(item);
                        }
                    );
                });

                names.forEach(function(item) {
                    if (self.$signatures[item] !== undefined &&
                        self.$signatures[item]
                        [self.$signatures[item].length - 1].charAt(0) === '$'
                    )
                        methods.push(function() {
                            var cbYield = arguments[arguments.length - 1],
                                args = Array.prototype.slice.call(
                                    arguments,
                                    0,
                                    arguments.length - 1
                                )
                                ;
                                
                            args.push(function() {
                                var args = arguments;
                                    
                                return (args.length === 0)
                                    ? cbYield()
                                    : function() {
                                        // This needs improvement                                  
                                        $thing.agent(new ($thing.Agent.inherit({

                                            done: function($cb) {
                                                var i = names.indexOf(item);
                                                    
                                                names.splice(i, 1);
                                                methods.splice(i, 1);
                                                
                                                $cb();
                                                cbYield();
                                            },
                                                    
                                            yield: function($cb) {
                                                $cb();
                                                cbYield();
                                            }

                                        }))())
                                        .apply($thing, args)
                                        .apply($thing, [])
                                        ;
                                    }
                                    ;
                            });
                            
                            self[item].apply(self, args);
                        
                        });
                               
                });
                    
                this.reset = function(cb) {
                    this.getFlow = getFlow;
                    return reset.apply(this, [cb]);
                };
                    
                this.getFlow = function() {
                    return methods;
                };
                    
                return methods;
            },

            action: function($cb) {
                if (!this.getFlow().length)
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
                $thing.async.series(
                    this.getFlow(),
                    this.bind(function() {
                        this.$super($cb);
                    })
                );
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
                $thing.async.parallel(
                    this.getFlow(),
                    this.bind(function() {
                        this.$super($cb);
                    })
                );
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
                var self = this,
                    concurrency = 1,
                    limit = 0,
                    functs = [],
                    active = 0,
                    paused = false
                    ;

                $thing.searchMeta(this, 'concurrency', 'int', function(value) {
                    concurrency = value;
                });
            
                $thing.searchMeta(this, 'limit', 'int', function(value) {
                    limit = value;
                });
            
                var queue = {
                
                    push: function(item, cbItem) {
                    
                        if (limit && functs.length > limit - 1) {
                            cbItem(-1);
                            return;
                        }
                    
                        if (!paused)
                            self.unsetState($thing.State.LIFE_WAITING);
                    
                        functs.push(function(cbDone) {
                            var flow = self.getFlow();
                        
                            if (!flow.length) {
                                cbDone();
                                cbItem(-1);
                            }
                            else {
                                $thing.async.applyEach(
                                    flow,
                                    item,
                                    function(err) {
                                        cbDone();
                                        cbItem(err);
                                    }
                                );
                            }
                    
                        });
                
                    },
                
                    action: function(next, cb) {
                        var call = [],
                            length = (functs.length < concurrency)
                                ? functs.length
                                : concurrency
                                ;
                    
                        while(length--)
                            call.push(functs.shift());
                        
                        if (call.length > 0) {
                            active = call.length;
                            
                            $thing.async.parallel(call, function() {
                                active = 0; 
                                next(cb);
                            });
                        }
                        else {
                            self.setState($thing.State.LIFE_WAITING);
                            next(cb);
                        }
                    },
                
                    pause: function() {
                        if (!paused) {
                            paused = true;
                            self.setState($thing.State.LIFE_WAITING);
                        }
                    },
                
                    resume: function() {
                        if (paused) {
                            paused = false;
                            self.unsetState($thing.State.LIFE_WAITING);
                            $thing.agent();
                        }
                    }   
        
                };
        
                Object.defineProperty(queue, 'length', {
                    get: function() {
                        return active + functs.length;
                    }
                });
        
                this.getQueue = function() {
                    return queue;
                };
        
                return queue;
            },
    
            action: function($cb) {
                this.getQueue().action(this.bind(this.$super), $cb);
            },
    
            /**
             * @method Queue#push
             */
            push: function(items, $cb) {
                if (items instanceof Array) {
                    var self = this,
                        length = items.length,
                        errs = [],
                        ret
                        ;
            
                    items.forEach(function(item, i) {
                        self.getQueue().push(item, function(err) {
                            ret = (errs[i] = err) || ret;
                    
                            if (!--length)
                                (ret)
                                    ? $cb('doneWithError', errs)()
                                    : $cb('done')()
                                    ;            
                        });
                    });
                }
                else {
                    this.getQueue().push(items, function(err) {
                        (err)
                            ? $cb('doneWithError', err)()
                            : $cb('done')()
                            ;
                    });
                }
        
                $thing.agent();
            },
    
            pause: function($cb) {
                this.getQueue().pause();
                $cb();
            },
    
            resume: function($cb) {
                this.getQueue().resume();
                $cb();
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

$thing.WAKE_MIN_PERIOD = 50000;

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
         * @class Done
         * @mixes $thing.Behaviour
         */
        this.addBehaviour(
            '@passive',
            '@catchall catchAll',
            'Done', {
                catchAll: function(args, $cb) {
                    $cb('done')();
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
                    $cb('doneWithError', -1)();
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
//# sourceMappingURL=thingjs-agent-0.2.1.js.map