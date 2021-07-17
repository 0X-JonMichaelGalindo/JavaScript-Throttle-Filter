/*

JavaScript-Throttle-Filter

A library for throttling and filtering api method calls. 

MIT License

Copyright (c) 2021 0X-JonMichaelGalindo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

{

    const throttles = new WeakSet();
    const filters = new WeakSet();
    
    const addFilter = Symbol();
    const deleteFilter = Symbol();

    function Filter( api, selector = () => true, onResult = () => {}, onReject = () => {} ) {

        if( ! api instanceof Throttle ) throw 'Filter: Argument 1 expected instance of Throttle.';

        const filter = { queries: new Set(), results: [], rejections: [], onResult, onReject };

        api[ addFilter ]( selector, filter );

        const apifilter = {

            all: () => Promise.all( [ ...filter.queries ] ),
            allSettled: () => Promise.allSettled( [ ...filter.queries ] ),
            any: () => Promise.any( [ ...filter.queries ] ),
            race: () => Promise.race( [ ...filter.queries ] ),

            getResults: () => [ ...filter.results ],

            getRejections: () => [ ...filter.rejections ],

            delete: () => {

                filter.queries.clear();
                filter.results.length = 0;
                filter.rejections.length = 0;
                delete filter.onResult;
                delete filter.onReject;

                api[ deleteFilter ]( selector );

                delete apifilter.all;
                delete apifilter.allSettled;
                delete apifilter.any;
                delete apifilter.race;
                delete apifilter.getResults;
                delete apifilter.getRejections;
                delete apifilter.delete;

                filters.delete( apifilter );

            },
            
        }

        filters.add( apifilter );

        return apifilter;

    }

    Object.defineProperty( Filter, Symbol.hasInstance, { value: element => filters.has( element ) } );


    function Throttle( api, maxParallelCalls = Infinity, callsPerSecond = Infinity ) {


        if( typeof api !== 'object' ) throw 'Throttle: Argument 1 expected object.'

        let parallelCount = 0;
    
        const queue = [];
    
        const none = Symbol();
    
    
        const interval = async () => {
    
            if( queue.length > 0 && parallelCount < maxParallelCalls ) {
    
                const query = queue.shift();
                const [ key, args, resolve, reject ] = query;
                
                parallelCount ++;
    
                let result = none, rejection = none;

                try {
    
                    result = await api[ key ]( ...args );
    
                } catch ( e ) {

                    rejection = e;
    
                }
    
                parallelCount --;
    
                applyFilters( query, { result, rejection } );

                if( result !== none ) resolve( result );
    
                if( rejection !== none ) reject( rejection );

            }
    
        }
    
    
        let rate = 0;
    
        if( Number.isFinite( callsPerSecond ) && callsPerSecond > 0 ) {
    
            const secondsPerCall = 1 / callsPerSecond;
            const millisecondsPerCall = 1000 * secondsPerCall;
    
            if( millisecondsPerCall >= 1 ) rate = millisecondsPerCall;
        
        }
    
        if( rate > 0 ) {
    
            setInterval( interval, millisecondsPerCall )
        
        } else {
    
            const frame = () => {
    
                requestAnimationFrame( frame );
                interval();
    
            }
    
            requestAnimationFrame( frame );
    
        }
    

        const selectors = new Set();
        const filters = new Map();

        const initialQuery = Symbol();

        function applyFilters( query, end = initialQuery ) {

            for( const selector of selectors ) {

                const filter = filters.get( selector ).deref();

                if( filter === undefined ) {

                    selectors.delete( selector );
                    filters.delete( selector );
                    continue;

                }

                const [ , args, , , filterFinish, filterResolve, filterReject ] = query;

                if( end === initialQuery && selector( args ) ) {

                    filter.queries.add( filterFinish );

                }

                if( end !== initialQuery ) {

                    const { result, rejection } = end;

                    if( selector( args, result, rejection ) ) {

                        filter.queries.add( filterFinish );

                        if( result !== none ) {

                            filter.results.push( result );

                            filter.onResult( result, args );

                            filterResolve( result );

                        }

                        if( rejection !== none ) {
                            
                            filter.rejections.push( rejection );

                            filter.onReject( rejection, args );

                            filterReject( rejection );

                        }

                    }

                }

            }

        }
    
        const throttle = new Proxy( api, {

            get( api, key ) {

                if( key === addFilter ) {

                    return ( selector, filter ) => {

                        selectors.add( selector );
                        filters.set( selector, new WeakRef( filter ) );

                    }

                }

                if( key === deleteFilter ) {

                    return ( selector ) => {

                        selectors.delete( selector );
                        filters.delete( selector );
    
                    }

                }
    
                if( typeof api[ key ] === 'function' )

                    return ( ...args ) => {
                        
                        let control = {};

                        const promise = new Promise( 
                            ( resolve, reject ) => {
                                control.resolve = resolve;
                                control.reject = reject;
                            }
                        );

                        const filterFinish = new Promise(
                            ( filterResolve, filterReject ) => {
                                control.filterResolve = filterResolve;
                                control.filterReject = filterReject;
                            }
                        )

                        const { resolve, reject, filterResolve, filterReject } = control;

                        const query = [ key, args, resolve, reject, filterFinish, filterResolve, filterReject ];
        
                        applyFilters( query );
    
                        queue.push( query );
        
                        return promise;

                    }

                        

            },

        } );


        throttles.add( throttle );


        return throttle;
    
    }


    Object.defineProperty( Throttle, Symbol.hasInstance, { value: element => throttles.has( element ) } );


    window.Throttle = Throttle;
    window.Filter = Filter;

}