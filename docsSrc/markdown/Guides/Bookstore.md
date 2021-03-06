# Strat Bookstore Guide

In this guide we'll make a simple bookstore that uses a:
  
  - single page application frontend
  - frontend proxy
  - books service that depends on an external sales service

We'll take this application and run it locally and on the cloud via AWS.  Sounds like a lot of work, but we'll be done in less than 100 lines of code.

Here's a classic block diagram for what we're about to build:
![Bookstore](https://strat.world/StratBookstore.png)

To complete this guide make sure you've [installed stratc](./Getting%20Started), and if you plan on running in AWS do the AWS section of the [Hello World Guide](./Hello%20World).

## Books API

We'll start by creating a simple books service and a frontend proxy that we can use to access the service.  Our proxy will receive http events and route them to the books service.  Create a file and name it "Bookstore.st", and paste the following into it:

```st
service FrontendProxy {
  include "Http"
  Http { method: "get", path: "/api/books" } -> Books.getBooks
}

service Books {
  getBooks ():any -> "./getBooks.js"
}

```

Take a look at this code and try to figure out what it does.  You'll notice two of our boxes from the box diagram are "service"s in this file--FrontendProxy and Books.  By including Http into Frontend proxy we're telling strat that its a web server, and the following line states "get requests on the /api/books path should be proxied to Books.getBooks".  The Books service then sends those requests to the getBooks.js file, which you need to create with this content:

```js
const getSales = async () => [];
const books = [
  {
    "name": "The Grapes of Wrath",
    "author": "John Steinbeck"
  },
  {
    "name": "War and Peace",
    "author": "Leo Tolstoy"
  },
  {
    "name": "The C Programming Language",
    "author": "Brian Kernighan and Dennis Ritchie"
  }
];

module.exports = async function () {
  const sales = await getSales();
  const salesSet = new Set((sales || []));
  return books.map(book => {
    return {
      sale: salesSet.has(book.author),
      ...book
    };
  });
};
```

This is our humble Books service.  It has a stub getSales function that we'll fill out later, some mock books, and an exported function that gets sales then responds with the mock books adding whether or not a book is on sale.

We've already got enough to deploy our API.  Run the following in a terminal in the same directory as both of the files you've just created:

```sh
stratc Bookstore.st && stratc Bookstore.sa
```

You should see the output:

```
http source listening on http://localhost:3000
```
We declared the getBooks API to be on the path /api/books, so using a browser or curl navigate to [localhost:3000/api/books](http://localhost:3000/api/books).

```sh
curl localhost:3000/api/books
```

### Static Files

Now lets add the client "single page application".  We're going to avoid all the heavy-handed stuff like React and Webpack in this tutorial.  Those tools are compatible with Strat but they add a build step that can get hairy fast, so we're keeping it to basic html and javascript.

Here's our client html file "index.html":

```html
<head>
  <style>
    .sale::after {
      content: 'on sale!';
      color: orange;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <h1>Welcome to the Strat bookstore!</h1>
  <h3>Books for sale</h3>
  <div id="books"></div>
  <script src="client.js"></script>
</body>

```

And here's our javascript bundle "client.js":

```js
async function get (path) {
  return (await fetch(path)).json();
}

function getFactory (path) {
  return () => get(path);
}

const API = {
  getBooks: getFactory('api/books')
};

async function app () {
  const books = await API.getBooks();
  const booksElement = document.querySelector('#books');
  books.map(createBookElement)
    .forEach(bookElement => booksElement.appendChild(bookElement));
}

function createBookElement (bookJson) {
  const bookElement = document.createElement('div');
  const titleContainer = document.createElement('i');
  if (bookJson.sale) {
    titleContainer.className = 'sale';
  }
  const titleElement = document.createTextNode(bookJson.name);
  titleContainer.appendChild(titleElement);
  const author = document.createElement('div');
  const authorText = document.createTextNode(`by ${bookJson.author}`);
  author.appendChild(authorText);
  bookElement.appendChild(titleContainer);
  bookElement.appendChild(author);
  bookElement.appendChild(document.createElement('br'))
  return bookElement;
}

app();
```

Its all pretty basic stuff, and within createBookElement we can see the legacy of 90s OOP and a reminder of why tools like React are so popular.

The document element API might not be simple, but at least serving these files is a two liner in Strat!  Add the following lines to Bookstore.st after include "Http":

```st
Http { method: "get", path: "/"} -> "./index.html"
Http { method: "get", path: "/client.js"} -> "./client.js"
```
Your Bookstore.st file should look like this:

```st
service FrontendProxy {
  include "Http"
  Http { method: "get", path: "/"} -> "./index.html"
  Http { method: "get", path: "/client.js"} -> "./client.js"
  Http { method: "get", path: "/api/books" } -> Books.getBooks
}

service Books {
  getBooks ():any -> "./getBooks.js"
}
```

Build and run this to see your bookstore SPA at [localhost:3000](http://localhost:3000/):

```sh
stratc Bookstore.st && stratc Bookstore.sa
```

Strat can either host your code on compute infrastructure like Lambda or Docker containers or it can host static files on blob storage like S3.  You tell Strat if it should execute your code or just serve it as a static file by adding a function signature ("getBooks ():any ->") when you want the code executed.  Since we just want to serve index.html and client.js, we leave the signature off and Strat serves the files as they are.

### Sales Dependency

Let's spice things up by adding an external service dependency.  If you've ever worked on a large service-oriented architecture you know that no service exists in isolation, and connecting to external services can be a massive PITA.

Change the assignment of getSales in getBooks.js:1 from
```js
const getSales = async () => [];
```
to
```js
const Strat = require('strat').getResolver();
const getSales = Strat('Sales.getSales');
```

Build, run, and check out [localhost:3000/api/books](http://localhost:3000/api/books):

```
stratc Bookstore.st && stratc Bookstore.sa
```

I have led you astray!  You should see the error "Sales.getSales is undefined".  Strat brings the concept of scope to infrastructure.  Strat's implementation of scope is based on the lexical scope you're used to in regular languages.  When you deploy your systems onto cloud substrates like AWS Strat builds roles and access control to enforce the same scope you see when you write your Strat files.  Looking at Bookstore.st now, you can see inside FrontendProxy a reference to Books.getBooks.  This works because FrontendProxy and Books are defined at the top level of the same file.  The two services exist within the same scope, and any function inside Books can call any function inside FrontendProxy.  Sales exists elsewhere, and it's not included so Strat doesn't know how to resolve it within the service Books's scope.  Let's fix that by adding

```st
include "https://s0tjdzrsha.execute-api.us-west-2.amazonaws.com/Sales/Sales.st"
```

to the top of the Books service, just how we have include "Http" at the top of FrontendProxy.  Your Bookstore.st file should look like this:

```st
service FrontendProxy {
  include "Http"
  Http { method: "get", path: "/"} -> "./index.html"
  Http { method: "get", path: "/client.js"} -> "./client.js"
  Http { method: "get", path: "/api/books" } -> Books.getBooks
}

service Books {
  include "https://s0tjdzrsha.execute-api.us-west-2.amazonaws.com/Sales/Sales.st"
  getBooks ():any -> "./getBooks.js"
}
```

Build and run again, and you should see the api working [localhost:3000/api/books](http://localhost:3000/api/books), and if you check the SPA out you'll see a little on sale indicator next to one of the books.

Strat's lexical scope means now that you've included Sales inside Books, anything in Books can call anything in Sales, but Sales can't call (and doesn't know about) anything else inside your infrastructure.

This concludes the N-tier architecture sans database, which we'll cover in the advanced tutorial.

Now you're not the kind of person to just blindly copy and paste code without reading and understanding it first, right?  You surely noticed that you're including a Sales URL and not some file.  This is a great idea put forth by [Deno](https://deno.land/) and it works great for service inclusions.  Strat includes can be either relative files, URLs, or std library names like "Http".  Have a look at that [included url](https://s0tjdzrsha.execute-api.us-west-2.amazonaws.com/Sales/Sales.st)--its a Strat file and it specifies a service!  URL includes in Strat allow users to download entire services and run them inside their own infrastructure.  I know what you're thinking--this seems *wildly unsafe*!  Well, each service included this way gets its own isolated piece of infrastructure to run on that is:

  - devoid of any permissions
  - can only receive and respond with json
  - can only be accessed by the infrastructure that included it

Automatically creating and deploying to infrastructure prison ships like this is another of the many benefits of letting a compiler build your system for you.  In the future users may build Strat systems comprised of many open source services and event sources--managing the permissions for all of these would be too cumbersome.  Even today with vanilla serverless architectures developers give overly permissive roles so often that its [cited as one of the most common security vulnerabilities](https://www.owasp.org/images/5/5c/OWASP-Top-10-Serverless-Interpretation-en.pdf).

In [part 2](./Bookstore%20Part%202) we'll create a database and use it in our Books service.
