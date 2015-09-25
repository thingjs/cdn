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