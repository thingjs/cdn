/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

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
(function(_global) {

    'use strict';

    var _module,
        _getTicks,
        async
        ;

    if (typeof module !== 'undefined' && module.exports) {
        async = require('async');
        _global = GLOBAL;
        _module = module;
        _getTicks = function() {
            var hrtime = process.hrtime();
            return hrtime[0] * 1000000 + hrtime[1];
        };
    }
    else {
        async = _global.async;
        _getTicks = Date.now;
    }

    if (_global.$thing !== undefined) {
        (_module !== undefined)
            ? _module.exports = agent
            : undefined
            ;
        return;
    }

    // Mash by Johannes Baagøe <baagoe@baagoe.com>
    function Mash() {
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
    }

    /** @namespace $thing */
    var $thing = _global.$thing = {};

    $thing.heap = [];

    /**
     * @memberOf $thing
     * @method create64BitId
     */
    $thing.create64BitId = function() {
        var h1 = new Mash(),
            h2 = new Mash()
            ;
        for (var i = 0; i < arguments.length; i++) 
            h1(arguments[i] || '');
        return  h1('').toString(16).split('.')[1] +
                h2(_getTicks()).toString(16).split('.')[1]
                ;
    };

    /**
     * @memberOf $thing
     * @method getBacktrace
     */
    $thing.getBacktrace = function(first) {
        first = first || 0;
        try {
            0();
        }
        catch(e) {
            var trace;
            if ((trace = e.stack.match(/\S+\:\d+/g)) !== null)
                return trace.slice(1 + first);
            else if ((trace = e.stack.match(/\s+at /g)) !== null)
                return trace.slice(1 + first);
            return [];
        }
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

    /**
     * @memberOf $thing
     * @method attach
     */
    $thing.attach = function(def) {
        if (def._id !== undefined) return def._id;
        else {
            var length = $thing.heap.length;
            while(
                $thing.heap.length !== 0 &&
                $thing.heap[$thing.heap.length - 1]._refCount === 0
            ) ($thing.heap.pop())._id = undefined;
            if (!$thing.heap.length || $thing.heap.length !== length)
                def._id = $thing.heap.push(def) - 1;
            else {
                def._id = undefined;
                for(var i = $thing.heap.length - 1;
                    i > -1 && def._id === undefined;
                    i--
                )
                    if ($thing.heap[i]._refCount === 0) {
                        $thing.heap[i]._id = undefined;
                        $thing.heap[def._id = i] = def;
                    }
                (def._id === undefined)
                    ? def._id = $thing.heap.push(def) - 1
                    : undefined
                    ;
            }
            return def._id;
        }
    };

    /**
     * @memberOf $thing
     * @method search
     */
    $thing.search = function(obj) {
        var match;
        for(var i = $thing.heap.length - 1; i > -1; i--) {
            if ($thing.heap[i]._refCount > 0) {
                for(var k in obj)
                    if (!(match = obj[k] === $thing.heap[i][k]))
                        break;
                if (match)
                    return $thing.heap[i];
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
            if ((item = item.match(/\S+/g))[0] === predicate) {
                item = item.slice(1);
                switch(type) {
                    case 'int':
                        (!isNaN(item[0] = parseInt(item[0])))
                            ? cb.apply(obj, item)
                            : undefined
                            ;
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
                (signature !== null)
                    ? signatures[k] = (signature[1].length)
                        ? signature[1].split(/,\s*/)
                        : []
                    : undefined
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

    $thing.Filter = {
        ALL:            1,
        FIRST:          2,
        LAST:           4
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
        * @param {object} parent
        * @param {object} super
        * @param {string} source
        * @param {string[]} stack
        */
        init: function(parent, _super, source, stack) {
            var k,
                item,
                search,
                self = this
                ;
            this.$super();
            this._state = $thing.State.DEF_DESC;
            this._parent = parent;
            this._children = [];
            this._meta = [];
            this._interfaces = [];
            this._uses = [];
            this._super = _super;
            this._source = source;
            this._refCount = 0;
            this._isAgent = this._super === $thing.Agent;
            this._isAbstract = false;
            this._isPassive = false;
            this._isMobile = false;
            this._interfaces = [
                $thing.create64BitId(source, $thing.heap.length),
                source
            ];
            this._substitute = {
                $id: this._interfaces[0],
                $source: source
            };
            this.parseStack(stack);
            if (this._extends !== undefined) {
                item = $thing.search({_name: this._extends});
                if (item === undefined) throw(
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
            if (search !== undefined && (item = $thing.search(search))) {
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
                    ? this._class = this._factory.apply(_global, this._uses)
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
                    $thing.attach(this);
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
                (child.getRefCount())
                    ? length++
                    : undefined
                    ;
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
            while(  (this._state !== $thing.State.DEF_END) &&
                    ((item = stack.shift()) !== undefined)
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
                        this._uses.push(agent(item));
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
                if (
                    (interfaces[i] instanceof RegExp)
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
            if (call.method.charAt(0) === '$') return cb();
            (this[method = call.interface + '.' + call.method] === undefined)
                ? (this[method = call.method] === undefined)
                    ? method = undefined
                    : undefined
                : undefined
                ;
            (   method === undefined ||
                (signature = this.$signatures[method]) === undefined ||
                signature[signature.length - 1].charAt(0) !== '$' ||
                signature.length !== call.args.length + 1
            )
                ? ( this[method = this.$__catchall__] === undefined ||
                    (signature = this.$signatures[method]) === undefined ||
                    signature[1].charAt(0) !== '$' ||
                    signature.length !== 2
                )
                    ? cb()
                    : this[this.$__catchall__].apply(
                        this,
                        [call.args, cb]
                    )
                : this[method].apply(
                    this,
                    call.args.concat(cb)
                )
                ;
        }

    });

    $thing.Pattern = $thing.Delegate.inherit({

        getName: function() {
            return 'Pattern';
        },

        /**
         * @constructs Pattern
         * @mixes $thing.Delegate
         * @memberOf $thing
         * @param {(string|string[])} pattern
         * @param {string} source
         */
        init: function(pattern, source) {
            this.$super();
            this._pattern = pattern;
            this.property('source', function() {
                return source;
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
            agent();
        },

        /**
         * @memberOf $thing
         * @method Agent#doDelete
         */
        doDelete: function(cb) {
            this.setState($thing.State.LIFE_DELETED);
            if (cb) cb();
            agent();
        },

        /**
         * @memberOf $thing
         * @method Agent#doSuspend
         */
        doSuspend: function(cb) {
            this.setState($thing.State.LIFE_SUSPENDED);
            if (cb) cb();
            agent();
        },

        /**
         * @memberOf $thing
         * @method Agent#doWait
         */
        doWait: function(cb) {
            this.setState($thing.State.LIFE_WAITING);
            if (cb) cb();
            agent();
        },

        /**
         * @memberOf $thing
         * @method Agent#doWake
         */
        doWake: function(cb) {
            this.unsetState($thing.State.LIFE_WAITING);
            if (cb) cb();
            agent();
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
                args = Array.prototype.slice.call(arguments, 0)
                ;
            var def = new $thing.Definition(
                    this,
                    $thing.Behaviour,
                    $thing.getBacktrace(1)[0],
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
                    obj.setState(
                        self.getState() |
                        $thing.State.LIFE_ACTIVE
                    );
                    agent();
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
            if (    typeof arguments[0] === 'object' &&
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
                        this,
                        $thing.Behaviour,
                        $thing.getBacktrace(1)[0],
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
            return ['Behaviour'];
        },

        done: function() {
            return false;
        },

        action: function($cb) {
            (this.done())
                ? this.$owner.removeBehaviour(this)
                : undefined
                ;
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

    $thing.Selector = $thing.Base.inherit({

        getName: function() {
            return 'Selector';
        },

        /**
         * @constructs Selector
         * @mixes $thing.Base
         * @memberOf $thing
         * @param {(string|string[]|$thing.Pattern)} pattern
         * @param {string} source
         * @param {boolean} [includePassive=true]
         */
        init: function(pattern, source, includePassive) {
            var i,
                include,
                def
                ;
            this.$super();
            this._source = source;
            this._exprs = [];
            this._selection = [];
            this._callbacks = [];
            if (pattern instanceof $thing.Pattern) {
                this._source = pattern.source;
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
            for(i = 0; i < $thing.heap.length; i++) {
                def = $thing.heap[i];
                include = (def.isPassive)
                    ? (def.isPassive & includePassive) &&
                        def.state < $thing.State.LIFE_SUSPENDED
                    : (includePassive)
                        ? def.state < $thing.State.LIFE_SUSPENDED
                        : def.state < $thing.State.LIFE_WAITING
                    ;
                (   !def.isAbstract &&
                    def.refCount > 0 &&
                    def.state & $thing.State.LIFE_ACTIVE &&
                    include
                )
                    ? def.refObject(this.bind(this.matchObject))
                    : undefined
                    ;
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
                match;
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
            async.setImmediate(this.bind(function() {

                if (    call.filters & $thing.Filter.FIRST &&
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

                    async.each(
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

    $thing.WAKE_MIN_PERIOD = 500;
    $thing.nextWakeTime = Date.now();
    $thing.isActionTaskQueued = false;

    $thing.wakeTask = function() {
        var now = Date.now();

        if (now >= $thing.nextWakeTime) {

            var selector = new $thing.Selector(
                    [['Behaviour', 'and', 'Waker']], 
                    '$thing', 
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

            $thing.nextWakeTime = now % $thing.WAKE_MIN_PERIOD + now;
        }
    };

    $thing.enqueueActionTask = function() {
        if ($thing.isActionTaskQueued) return;
        $thing.isActionTaskQueued = true;

        async.setImmediate(function() {
            var selector = new $thing.Selector(
                    [['Behaviour', 'not', 'Waker']], 
                    '$thing', 
                    false
                )
                ;
        
            if (selector.length === 0) {
                selector.release();
                selector = undefined;
                $thing.isActionTaskQueued = false;
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
                        $thing.isActionTaskQueued = false;
                        $thing.enqueueActionTask();
                    }
                );
            }

        });

    };

    function cbBuilder(self, args, cbDone) {
        cbDone = cbDone || function(){};
        return function() {
            var self = this,
                args = arguments
                ;
            agent();
            return (!args.length)
                ? cbDone()
                : function() {
                    var cbObj = (arguments.length)
                        ? arguments
                        : [$thing.Container]
                        ;
                    async.setImmediate(function() {
                        agent(self)
                            .apply(_global, args)
                            .apply(_global, cbObj)
                            ;
                        cbDone();
                    });
                }
                ;
        }.apply(self, args);
    }

    /**
     * @method agent
     * @param {*}
     */
    var agent = _global.agent = function() {
        var def,
            source,
            selector,
            filter,
            pattern,
            selects,
            callChain,
            refCount = 0
            ;

        switch(arguments.length) {
            case 0:
                $thing.wakeTask();
                return $thing.enqueueActionTask();
            case 1:
                if (arguments[0] instanceof $thing.Pattern) {
                    selector = new $thing.Selector(pattern = arguments[0]);
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
                    $thing.Container,
                    $thing.Agent,
                    (source = $thing.getBacktrace(1)[0]),
                    args
                );
                if (def.class !== undefined)
                    return def.refObject(
                        function(obj, cbRelease){
                            cbRelease();
                        }
                    );
                else {
                    selects = [];
                    $thing.searchMeta(def, 'select', function() {
                        selects.push(Array.prototype.slice.call(arguments, 0));
                    });
                    selector = new $thing.Selector(
                        pattern = (selects.length)
                            ? selects
                            : def.name,
                        source
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
                        var source = $thing.getBacktrace(1)[0],
                            def = new $thing.Definition(
                                $thing.Container,
                                $thing.Agent,
                                source,
                                args
                            )
                            ;
                        if (def.class !== undefined) obj = def;
                        else {
                            selects = [];
                            $thing.searchMeta(def, 'select', function() {
                                selects.push(Array.prototype.slice.call(arguments, 0));
                            });
                            obj = new $thing.Pattern(
                                (selects.length)
                                    ? selects
                                    : def.name,
                                source
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
                                return cbBuilder(
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
                                return cbBuilder(
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

    (_module !== undefined)
        ? _module.exports = agent
        : _global.agent = agent
        ;

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

    agent({
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
             * @class Flow
             * @abstract
             * @mixes $thing.Behaviour
             */
            this.addBehaviour(
                'abstract Flow', {
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
                            (names.indexOf(item) === -1)
                                ? names.push(item)
                                : undefined
                                ;
                        });
                        $thing.searchMeta(this, 'flow', function() {
                            Array.prototype.slice.call(arguments, 0).forEach(
                                function(item) {
                                    (names.indexOf(item) === -1)
                                        ? names.push(item)
                                        : undefined
                                        ;
                                }
                            );
                        });
                        names.forEach(function(item) {
                            (   self.$signatures[item] !== undefined &&
                                self.$signatures[item]
                                    [self.$signatures[item].length - 1]
                                        .charAt(0) === '$'
                            )
                                ? methods.push(function() {
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
                                                agent(new ($thing.Agent.inherit({
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
                                                .apply(_global, args)
                                                .apply(_global, [])
                                                ;
                                            }
                                            ;
                                    });
                                    self[item].apply(self, args);
                                })
                                : undefined
                                ;
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
                        (!this.getFlow().length)
                            ? this.done = function() {
                                return true;
                            }
                            : undefined
                            ;
                        this.$super($cb);
                    },
                    done: function() {
                        return false;
                    }
                }
            );

            /**
             * @class Series
             * @mixes Flow
             * @abstract
             */
            this.addBehaviour(
                'abstract Series extends Flow', {
                    action: function($cb) {
                        async.series(
                            this.getFlow(),
                            this.bind(function() {
                                this.$super($cb);
                            })
                        );
                    }
                }
            );

            /**
             * @class Parallel
             * @mixes Flow
             * @abstract
             */
            this.addBehaviour(
                'abstract Parallel extends Flow', {
                    action: function($cb) {
                        async.parallel(
                            this.getFlow(),
                            this.bind(function() {
                                this.$super($cb);
                            })
                        );
                    }
                }
            );

            /**
             * @class Queue
             * @mixes Flow
             * @abstract
             */
            this.addBehaviour(
                'abstract Queue extends Flow', {
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
                        $thing.searchMeta(
                            this,
                            'concurrency',
                            'int',
                            function(value) {
                                concurrency = value;
                            }
                        );
                        $thing.searchMeta(
                            this,
                            'limit',
                            'int',
                            function(value) {
                                limit = value;
                            }
                        );
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
                                        async.applyEach(
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
                                    async.parallel(call, function() {
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
                                    agent();
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
                                    (!--length)
                                        ? (ret)
                                            ? $cb('doneWithError', errs)()
                                            : $cb('done')()
                                        : undefined
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
                        agent();
                    },
                    pause: function($cb) {
                        this.getQueue().pause();
                        $cb();
                    },
                    resume: function($cb) {
                        this.getQueue().resume();
                        $cb();
                    }
                }
            );

            /**
             * @class Waker
             * @mixes Behaviour
             * @abstract
             */
            this.addBehaviour(
                'abstract Waker', {

                    /**
                     * @method Waker#getWakeTime
                     */
                    getWakeTime: function() {
                        var time,
                            period = 1000,
                            now = Date.now()
                            ;

                        $thing.searchMeta(
                            this,
                            'period',
                            'int',
                            function(value) {
                                period = value;
                            }
                        );
                        
                        time = now % period + now;

                        this.getWakeTime = function() {
                            return time;
                        };
                        
                        return this.getWakeTime();
                    },

                    /**
                     * @method Waker#wake
                     */
                    wake: function($cb) {
                        var time = this.getWakeTime();

                        if (time === undefined)
                            this.$owner.removeBehaviour(this);

                        if ($cb !== undefined)
                            $cb();
                    },

                    action: function($cb) {
                        var now = Date.now(),
                            time = this.getWakeTime()
                            ;

                        if (time !== undefined) {
                            if (time - now <= 0) {
                                this.getWakeTime = function() {
                                    return undefined;
                                };
                                agent(this)('wake')();
                            }
                        }

                        this.$super($cb);
                    },

                    done: function() {
                        var now = Date.now(),
                            time = this.getWakeTime()
                            ;

                        if (time === undefined)
                            return false;
                        else if (time - now <= 0)
                            return true;
                        else
                            return false;
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
                        if ($cb !== undefined)
                            $cb();
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
        }
    });

})(this);

//# sourceMappingURL=thingjs-agent-0.1.0-withasync.js.map