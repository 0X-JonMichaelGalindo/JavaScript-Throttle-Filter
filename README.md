# Throttle and Filter

A library for throttling and filtering method calls to an api.

## Example
```JavaScript
//an API is an object whose methods return promises
const myAPI = { lookup(){/* ... */}, rename(){ /* ... */ }, /* ... */ }

//use Throttle() to automatically limit api bandwidth
const maxParallelCalls = 10; //await at most 10 queries open in parallel
const maxCallsPerSecond = 1; //call no more than 1 query per second
const api = new Throttle( myAPI, maxParallelCalls, maxCallsPerSecond );

//use your API normally
const myLookup = await api.lookup( /* ... */ );


//Use filters to collect query results

const selector = ( args ) => args[ 0 ] === 'image';
const filter = new Filter( api, selector );

for( const args of myQueries ) api.request( ...args );

await filter.all(); //resolves when all 'image' queries resolve

const errors = filter.getRejections();

```
# Throttle()

A Throttle reflects its API object parameter.

## Constructor
```TypeScript
const throttle = new Throttle( 
    api: object, 
    maxParallelCalls?: number = Infinity,
    maxCallsPerSecond?: number = Infinity,
): Throttle
```
## Example
```JavaScript
import { Throttle } from 'throttle.filter.min.module.js';

const maxParallelCalls = 10;
const maxCallsPerSecond = 1;
const api = new APIThrottle( myAPI, maxParallelCalls, maxCallsPerSecond );

api.myQueryFunction( 'my-query-parameters', 'etc' );

async () => {

    const a = await api.myQueryFunction( 'my-query-parameters', 'etc' );

    await Promise.all( [
        api.myQuery( 'a', 'b', 'c' ),
        api.myQuery( 'd', 'e', 'f' ),
        api.myQuery( 'g', 'h', 'i' ),
    ] );

}

```

# Filter()

Filters are disposable collections of queries to their api parameter.

## Constructor
```TypeScript
const filter = new Filter(
    api: Throttle,
    selector?: function = () => true,
    onResult?: function = () => {},
    onReject?: function = () => {}
): Filter
```

## Constructor Parameters

### selector

Any query for which `selector()` returns truthy will be collected in the filter.

`selector()` is called twice: Once when a query is made, and again when the query resolves, rejects, or throws.
If either call returns truthy, the query will be included in the filter.

When a query is made:
```TypeScript
selector( args ): Boolean
```

When a query resolves, rejects, or throws:
```JavaScript
selector( args, result, rejection ): Boolean
```

### onResult
When a query satisfying `selector()` resolves, `onResult()` will be called with its result.
```JavaScript
onResult( result )
```

### onReject
When a query satisfying `selector()` rejects or throws, `onReject()` will be called with its rejection or error.
```JavaScript
onReject( rejectionOrError )
```

## Methods

### Promise Methods

Call Promise.all() on array of all past queries satisfying `selector()`.
```JavaScript
filter.all(): Promise
```

Call Promise.allSettled() on an array of all past queries satisfying `selector()`.
```JavaScript
filter.allSettled(): Promise
```

Call Promise.any() on an array of all past queries satisfying `selector()`.
```JavaScript
filter.any(): Promise
```

Call Promise.race() on an array of all past queries satisfying `selector()`.
```JavaScript
filter.race(): Promise
```

### Collections

Returns an array of the results of all resolved past queries satisfying `selector()`;
```JavaScript
filter.getResults(): Array
```

Returns an array of the errors of all rejected past queries satisfying `selector()`;
```JavaScript
filter.getRejections(): Array
```

### Delete

Filters are garbage collected. However, a filter's resources and listeners can be immediately dropped using `delete()`

A deleted filter becomes an empty object.  

```JavaScript
filter.delete();
```

## Example

```JavaScript
import { APIThrottle, APIFilter } from 'apithrottle.min.module.js';

const maxParallelCalls = 10;
const maxCallsPerSecond = 1;
const throttledAPI = new APIThrottle( myAPI, maxParallelCalls, maxCallsPerSecond );

const imageSelector = ( args, result, rejection ) => args[ 0 ] === 'image-element';
const myImagesFilter = new APIFilter( throttledAPI, imageSelector );

throttledAPI.getElement( 'image-element', myImageUrl );

//wait for all images to finish resolving or rejecting
myImagesFilter.finish();

//get result and rejection arrays
const results = myImagesFilter.getResults();
const rejections = myImagesFilter.getRejections();

//force-dispose of filter (unnecessary if locally scoped)
myImagesFilter.delete()
```
