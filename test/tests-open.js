﻿///<reference path="run-unit-tests.html" />

module("open", {
    setup: function () {
        stop();
        Dexie.delete("TestDB").then(function () {
            start();
        }).catch(function (e) {
            ok(false, "Could not delete database");
        });
    },
    teardown: function () {
        stop(); Dexie.delete("TestDB").then(start);
    }
});

asyncTest("open, add and query data without transaction", 6, function () {
    var db = new Dexie("TestDB");
    db.version(1).stores({ employees: "++id,first,last" });
    ok(true, "Simple version() and stores() passed");
    db.open().catch(function (e) {
        ok(false, "Could not open database: " + (e.stack || e));
        start();
    });

    db.employees.add({ first: "David", last: "Fahlander" }).then(function () {
        ok(true, "Could add employee");
        db.employees.where("first").equals("David").toArray(function (a) {
            ok(true, "Could retrieve employee based on where() clause");
            var first = a[0].first;
            var last = a[0].last;
            ok(first == "David" && last == "Fahlander", "Could get the same object");
            equal(a.length, 1, "Length of returned answer is 1");
            ok(a[0].id, "Got an autoincremented id value from the object");
            db.close();
            start();
        });
    });
});

asyncTest("open, add and query data using transaction", function () {
    var db = new Dexie("TestDB");
    db.version(1).stores({ employees: "++id,first,last" });
    db.open().catch(function () {
        ok(false, "Could not open database");
        start();
    });

    db.transaction("rw", db.employees, function () {

        // Add employee
        db.employees.add({ first: "David", last: "Fahlander" });

        // Query employee
        db.employees.where("first").equals("David").toArray(function (a) {
            equal(a.length, 1, "Could retrieve employee based on where() clause");
            var first = a[0].first;
            var last = a[0].last;
            ok(first == "David" && last == "Fahlander", "Could get the same object");
            equal(a.length, 1, "Length of returned answer is 1");
            ok(a[0].id, "Got an autoincremented id value from the object");
        });
    }).catch(function (e) {
        ok(false, e);
    }).finally(function() {
        db.close();
        start();
    });
});

asyncTest("test-if-database-exists", 3, function () {
    if (Dexie.Observable) {
        ok(false, "Dexie.Observable currently not compatible with this mode");
        return start();
    }
    var db = new Dexie("TestDB");
    var db2 = null;
    return db.open().then(function () {
        // Could open database without specifying any version. An existing database was opened.
        ok(false, "Expected database not to exist but it existed indeed");
        db.close();
    }).catch(function (err) {
        // An error happened. Database did not exist.
        ok(true, "Database did not exist");
        db = new Dexie("TestDB");
        db.version(1).stores({dummy: ""});
        return db.open();
    }).then(function () {
        // Database was created. Now open another instance to test if it exists
        ok(true, "Could create a dummy database");
        db2 = new Dexie("TestDB");
        return db2.open();
    }).then(function () {
        ok(true, "Dummy Database did exist.");
        db2.close();
    }).catch(function (err) {
        ok(false, "Error: " + err.stack || err);
    }).finally(function () {
        db.delete().then(function () {
            if (db2) return db2.delete();
        }).finally(start);
    });
});

asyncTest("open database without specifying version or schema", 10, function () {
    if (Dexie.Observable) {
        ok(false, "Dexie.Observable currently not compatible with this mode");
        return start();
    }
    var db = new Dexie("TestDB");
    var db2 = null;
    db.open().then(function () {
        ok(false, "Should not be able to open a non-existing database when not specifying any version schema");
    }).catch(function (err) {
        ok(true, "Got error when trying to open non-existing DB: " + err);
        // Create a non-empty database that we later on will open in other instance (see next then()-clause)...
        db = new Dexie("TestDB");
        db.version(1).stores({ friends: "++id,name", pets: "++,name,kind" });
        return db.open();
    }).then(function () {
        ok(true, "Could create TestDB with specified version schema.");
        db2 = new Dexie("TestDB"); // Opening another instans without specifying schema
        return db2.open().then(function () {
            equal(db2.tables.length, 2, "We got two tables in database");
            ok(db2.tables.every(function (table) { return table.name == "friends" || table.name == "pets" }), "db2 contains the tables friends and pets");
            equal(db2.table("friends").schema.primKey.name, "id", "Primary key of friends is 'id'");
            ok(true, "Primary key of friends is auto-incremented: " + db2.table("friends").schema.primKey.auto); // Just logging. Not important for functionality. I know this fails on IE11.
            equal(db2.table("friends").schema.indexes[0].name, "name", "First index of friends table is the 'name' index");
            ok(!db2.table("pets").schema.primKey.name, "Primary key of pets has no name (not inline)");
            ok(true, "Primary key of pets is auto-incremented: " + db2.table("pets").schema.primKey.auto); // Just logging. Not important for functionality. I know this fails on IE11.
            equal(db2.table("pets").schema.indexes.length, 2, "Pets table has two indexes");
        });
    }).catch(function (err) {
        ok(false, "Error: " + err);
    }).finally(function () {
        db.close();
        if (db2) db2.close();
        start();
    });
});

asyncTest("Dexie.getDatabaseNames", 11, function () {
    var defaultDatabases = [];
    var db1, db2;
    Dexie.getDatabaseNames(function (names) {
        defaultDatabases = [].slice.call(names, 0);
        ok(true, "Current databases: " + (defaultDatabases.length ? defaultDatabases.join(',') : "(none)"));
        db1 = new Dexie("TestDB1");
        db1.version(1).stores({});
        return db1.open();
    }).then(function () {
        // One DB created
        ok(true, "TestDB1 successfully created");
        return Dexie.getDatabaseNames();
    }).then(function (names) {
        equal(names.length, defaultDatabases.length + 1, "Another DB has been created");
        ok(names.indexOf("TestDB1") !== -1, "Database names now contains TestDB1");
        db2 = new Dexie("TestDB2");
        db2.version(1).stores({});
        return db2.open();
    }).then(function () {
        ok(true, "TestDB2 successfully created");
        return Dexie.getDatabaseNames();
    }).then(function (names) {
        equal(names.length, defaultDatabases.length + 2, "Yet another DB has been created");
        ok(names.indexOf("TestDB2") !== -1, "Database names now contains TestDB2");
        return db1.delete();
    }).then(function () {
        return Dexie.getDatabaseNames();
    }).then(function(names){
        equal(names.length, defaultDatabases.length + 1, "A database has been deleted");
        ok(!names.indexOf("TestDB1") !== -1, "TestDB1 not in database list anymore");
        return db2.delete();
    }).then(function () {
        return Dexie.getDatabaseNames();
    }).then(function (names) {
        equal(names.length, defaultDatabases.length, "All of our databases have been deleted");
        ok(!names.indexOf("TestDB2") !== -1, "TestDB2 not in database list anymore");
    }).catch(function (err) {
        ok(false, err.stack || err);
    }).finally(function () {
        (db1 ? db1.delete() : Dexie.Promise.resolve()).finally(function () {
            (db2 ? db2.delete() : Dexie.Promise.resolve()).finally(start);
        });
    });
});
