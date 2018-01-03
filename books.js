const jwt = require('jsonwebtoken'); // Json Web Token Library; Used for authentication
const fs = require('fs');
var exports = module.exports = {};

exports.addBook = async function(req, res, con, secret) {
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    var uuid;
    jwt.verify(token, secret, function(err, decoded) {
        if (err) {
            return res.json({ success: false, message: 'Failed to authenticate token.' });
        }
        else {
            // Everything is good
            uuid = decoded.uuid;
        }
    }); // Get's User Id From JWT Token
    var book = {};
    console.log(req.body);
    if (req.body.image) {
        book.image = req.body.image;
    }
    else {
        book.image = "/Images/books.jpeg";
    }
    if (req.body.ubid) { // If Book Already Exists and User Chooses This
        addUserbook(con, uuid, req.body.ubid, req.body.description, book.image);
        var message = {
            message: "Sucessfully Added"
        };
        res.status(200).json(message); // Exits Code Here
    }
    else {
        // By This Point We know book doesn't already Exsist


        if (req.body.uaid) { // Author Already Exsists
            book.uaid = req.body.uaid;
            let [author] = await con.query(`SELECT Name FROM Authors WHERE UAID=${book.uaid}`);
            book.author = author.Name;
        }
        else {
            book.author = req.body.author;
            let addAuthor = await con.query(`INSERT INTO Authors (Name) VALUES ("${book.author}")`);
            let [author] = await con.query(`SELECT UAID FROM Authors WHERE Name="${book.author}"`);
            book.uaid = author.UAID;
        }
        if (req.body.ugid) { // Genre Already Exsists
            book.ugid = req.body.ugid;
            let [genre] = await con.query(`SELECT Name FROM Genres WHERE UGID=${book.ugid}`);
            book.genre = genre.Name
        }
        else {
            book.genre = req.body.genre;
            let addGenres = await con.query(`INSERT INTO Genres (Name) VALUES ("${book.genre}")`);
            let [genre] = await con.query(`SELECT UGID FROM Genres WHERE Name="${book.genre}"`);
            book.ugid = genre.UGID;
        }
        // By This Point Books Author and Genre are Confirmed
        book.name = req.body.name;
        book.year = req.body.year;
        book.description = req.body.description;
        if (addNewBookDb(con, book.name, book.uaid, book.ugid, book.year)) {
            let [addedbook] = await con.query(`SELECT UBID FROM Books WHERE Name="${book.name}"`);
            book.ubid = addedbook.UBID;

            addUserbook(con, uuid, book.ubid, book.description, book.image);
            if (addNewBookFile(book.ubid, book.name, book.author, book.genre, book.year)) {
                var message = {
                    message: "Sucessfully Added"
                };
                res.status(200).json(message);
            }
        }

    }
}
var addUserbook = async function(con, uuid, ubid, description, image) {
    let [addUserBooks] = await con.query(`INSERT INTO ${"`User's Book`"} (User,Book,Description,Image) VALUES (${uuid},${ubid},"${description}","${image}")`);
}
var addNewBookDb = async function(con, name, uaid, ugid, year) {
    try {
        let [addBookDB] = await con.query(`INSERT INTO Books (Name,Author,Genre,Year) VALUES ("${name}",${uaid},${ugid},${year})`);
        return true;
    }
    catch (err) {
        return false;
    }

}
var addNewBookFile = async function(ubid, name, author, genre, year) {
    var books = JSON.parse(fs.readFileSync('books.json', 'utf8'));
    var newBook = {
        ubid: ubid,
        title: name,
        author: author,
        genre: genre,
        year: year
    };
    books.push(newBook);
    if (fs.writeFile("books.json", JSON.stringify(books), function(err) {
            if (err) throw err;
            return true;
        })) {
        return true;
    }

}
exports.getAuthor = async function(req, res, con) {
    var books = [];

    function NewBook(ubid, bookname, author, genre, year, description, image) {
        this.ubid = ubid;
        this.bookname = bookname;
        this.author = author;
        this.genre = genre;
        this.year = year;
        //   this.image = image
    }
    console.log("Uaid : " + req.query.author);
    let [author] = await con.query(`SELECT * FROM Authors WHERE Name="${req.query.author}"`)
    var getBooks = await con.query(`SELECT * FROM Books WHERE Author=${author.UAID}`);
    for (var book of getBooks) {
        let [genre] = await con.query(`SELECT * FROM Genres WHERE UGID=${book.Genre}`);
        books.push(new NewBook(book.UBID, book.Name, author, genre, book.Year));
    }
    res.status(200).json({
        books: books
    });

}
exports.getGenre = async function(req, res, con) {
    var books = [];

    function NewBook(ubid, bookname, author, genre, year, owners) {
        this.ubid = ubid;
        this.bookname = bookname;
        this.author = author;
        this.genre = genre;
        this.year = year;
        this.owners = owners;
    }

    function sameBooks(ownerName, description, Image) {
        this.ownername = ownerName;
        this.description = description;
        this.image = Image;
        console.log(this.image);
    }
    console.log("Uaid : " + req.query.genre);

    let genres = await con.query(`SELECT * FROM Genres WHERE Name="${req.query.genre}"`)
    var genreID = genres[0].UGID;
    console.log(genreID);
    var getBooks = await con.query(`SELECT * FROM Books WHERE Genre=${genreID}`);
    for (let i = 0; i < getBooks.length; i++) {
        var book = getBooks[i];
        var authorname = await con.query(`SELECT Name FROM Authors WHERE UAID=${book.Author}`);
        authorname = authorname[0].Name;
        console.log(authorname);
        books.push(new NewBook(book.UBID, book.Name, authorname, book.Genre, book.Year));
    }
    res.status(200).json({
        books: books
    });

}
// Featured Books
exports.getFeaturedBooks = async function(req, res, con,secret) {
    var books = [];

    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    var uuid;
    jwt.verify(token, secret, function(err, decoded) {
        if (err) {
            return res.json({ success: false, message: 'Failed to authenticate token.' });
        }
        else {
            // Everything is good
            uuid = decoded.uuid;
        }
    });
    var userId = req.body.userId || req.query.userId || req.headers['x-user-id']; // Copy
    if (userId != -1) {
        uuid = userId;
    }
    let featuredBooks = await con.query(`SELECT * FROM ${"`Featured Books`"} WHERE User="${uuid}"`); 

    function newBook(UBID, Name, Author, Genre, Year, Description, Image) {
        this.ubid = UBID;
        this.bookname = Name;
        this.author = Author;
        this.genre = Genre;
        this.year = Year;
        this.description = Description;
        this.image = Image;
    }

    for (let featuredBook of featuredBooks) {
        var UBID = featuredBook.User_Book;
        let [book] = await con.query(`SELECT * FROM ${"`User's Book`"}  WHERE Book="${UBID}" AND User="${uuid}"`);
        book = book;
        let [bookdetails] = await con.query(`SELECT * FROM Books WHERE UBID="${UBID}"`);
        bookdetails = bookdetails;
        let [authorname] = await con.query(`SELECT Name FROM Authors WHERE UAID="${bookdetails.Author}"`);
        authorname = authorname.Name;
        let [genrename] = await con.query(`SELECT Name FROM Genres WHERE UGID="${bookdetails.Genre}"`);
        genrename = genrename.Name;
        books.push(new newBook(UBID, bookdetails.Name, authorname, genrename, book.Year, book.Description, book.Image));
    }

    res.status(200).json({
        books: books
    });
}

exports.addFeaturedBook = async function(req, res, con, secret) {
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    var uuid;
    jwt.verify(token, secret, function(err, decoded) {
        if (err) {
            return res.json({ success: false, message: 'Failed to authenticate token.' });
        }
        else {
            // Everything is good
            uuid = decoded.uuid;
        }
    });

    var book = req.body.featuredbook;
    var bookid = book.ubid;
    var existing = await con.query(`SELECT * FROM ${"`Featured Books`"} WHERE User="${uuid}" AND User_Book=${bookid}`);
    if (existing.length == 0) {
        var querystring = `INSERT INTO ${"`Featured Books`"} (User, User_Book) VALUES ("${uuid}","${bookid}")`;
        let updatefeatured = await con.query(querystring)

        res.status(200).json({
            message: "Your request to add a featured book has been successful!!"
        });
    }
    else {
        res.status(200).json({
            message: "That book already is your featured book"
        });
    }
}

exports.removeFeaturedBook = async function(req, res, con, secret) {
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    var uuid;
    jwt.verify(token, secret, function(err, decoded) {
        if (err) {
            return res.json({ success: false, message: 'Failed to authenticate token.' });
        }
        else {
            // Everything is good
            uuid = decoded.uuid;
        }
    });

    var book = req.body.featuredbook;
    var bookid = book.ubid;
    var querystring = `DELETE FROM ${"`Featured Books`"} WHERE User="${uuid}" AND User_Book="${bookid}"`;
    let updatefeatured = await con.query(querystring);

    res.status(200).json({
        message: "Your request to remove a featured book has been successful!!"
    });
}
